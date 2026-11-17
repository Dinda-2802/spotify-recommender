"""Spotify Recommender – Big Data Spark.

Redesigned desktop dashboard. The data pipeline, feature standardization,
cosine-similarity search, cluster filtering, and threaded loading/searching
remain compatible with the original application.
"""

from __future__ import annotations

import ast
import queue
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

import numpy as np
import pandas as pd
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.figure import Figure
from matplotlib.image import imread


# =============================================================================
# Application settings
# =============================================================================

PROJECT_DIR = Path(__file__).resolve().parent
CLUSTER_DIR = PROJECT_DIR / "hasil_clustering" / "lagu_dengan_cluster"
CLEAN_FILE = PROJECT_DIR / "data_clean" / "tracks_clean.csv"
EVAL_DIR = PROJECT_DIR / "hasil_evaluasi"

FEATURES = [
    "danceability",
    "energy",
    "loudness",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo",
]

# Modern SaaS Dashboard – Soft Blue & Lavender Purple
BG = "#F6F7FC"
SURFACE = "#FFFFFF"
SIDEBAR = "#FFFFFF"
PRIMARY = "#5278E8"
PRIMARY_DARK = "#344FA1"
PASTEL_BLUE = "#E8F0FF"
LAVENDER = "#A78BFA"
SOFT_PURPLE = "#F0EAFF"
NAVY = "#202A44"
TEXT_SECONDARY = "#7B849D"
BORDER = "#E8EAF2"
CYAN = "#75C9E7"
SUCCESS = "#42B883"
WARNING = "#F4B860"
SHADOW = "#E9EBF4"
CHART_BG = "#FBFCFF"

HEATMAP = LinearSegmentedColormap.from_list(
    "blue_lavender",
    [PRIMARY_DARK, PRIMARY, "#F7F8FC", LAVENDER, "#7254C7"],
)


# =============================================================================
# Data loading and recommendation engine
# =============================================================================


def read_clustered():
    """Read every Spark part CSV, preserving the original data contract."""
    files = sorted(CLUSTER_DIR.glob("part-*.csv"))
    if not files:
        raise FileNotFoundError(
            f"Hasil clustering tidak ditemukan di:\n{CLUSTER_DIR}\n\n"
            "Jalankan 05_clustering_kmeans.py terlebih dahulu."
        )

    df = pd.concat(
        [pd.read_csv(path, encoding="utf-8-sig", low_memory=False) for path in files],
        ignore_index=True,
    )
    required = ["name", "artists", "cluster"] + FEATURES
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError("Kolom tidak ditemukan: " + ", ".join(missing))

    for column in FEATURES:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df["cluster"] = pd.to_numeric(df["cluster"], errors="coerce")
    df["name"] = df["name"].fillna("(tanpa judul)").astype(str)
    df["artists"] = df["artists"].fillna("(tanpa artis)").astype(str)
    df = df.dropna(subset=FEATURES + ["cluster"]).reset_index(drop=True)
    df["cluster"] = df["cluster"].astype(int)
    return df, len(files)


def read_years():
    """Read release years from the clean dataset when the column is available."""
    try:
        if not CLEAN_FILE.exists():
            return None
        header = list(pd.read_csv(CLEAN_FILE, nrows=0).columns)
        if "year" not in header:
            return None
        years = pd.to_numeric(
            pd.read_csv(CLEAN_FILE, usecols=["year"])["year"], errors="coerce"
        ).dropna()
        return years[years > 0].astype(int)
    except Exception:
        return None


def fmt_artists(text):
    """Convert a serialized artist list into a readable label."""
    try:
        value = ast.literal_eval(text)
        if isinstance(value, (list, tuple)):
            return ", ".join(str(item) for item in value)
    except Exception:
        pass
    return text


def describe_cluster(zrow):
    """Summarize a cluster using its two strongest standardized features."""
    order = np.argsort(-np.abs(zrow))[:2]
    descriptions = []
    for index in order:
        if zrow[index] >= 0.4:
            descriptions.append(f"{FEATURES[index].title()} tinggi")
        elif zrow[index] <= -0.4:
            descriptions.append(f"{FEATURES[index].title()} rendah")
    return " · ".join(descriptions) if descriptions else "Mendekati rata-rata keseluruhan"


def format_number(value):
    return f"{int(value):,}".replace(",", ".")


class Engine:
    """Store standardized feature vectors and run cosine-similarity searches."""

    def __init__(self, df):
        self.df = df
        features = df[FEATURES].to_numpy(np.float32)
        mean, std = features.mean(axis=0), features.std(axis=0)
        std[std == 0] = 1
        self.Z = (features - mean) / std

        norm = np.linalg.norm(self.Z, axis=1, keepdims=True)
        norm[norm == 0] = 1
        self.U = (self.Z / norm).astype(np.float32)

        self.cl = df["cluster"].to_numpy()
        self.codes, _ = pd.factorize(df["name"] + "|" + df["artists"])
        self.clusters = np.unique(self.cl)
        self.idx_c = {cluster: np.flatnonzero(self.cl == cluster) for cluster in self.clusters}
        self.U_c = {cluster: self.U[self.idx_c[cluster]] for cluster in self.clusters}
        self.codes_c = {cluster: self.codes[self.idx_c[cluster]] for cluster in self.clusters}
        self.counts = np.array([len(self.idx_c[cluster]) for cluster in self.clusters])
        self.mean_z = np.vstack(
            [self.Z[self.idx_c[cluster]].mean(axis=0) for cluster in self.clusters]
        )
        self.search_text = (df["name"] + " " + df["artists"]).str.lower()

    @staticmethod
    def _top(similarities, amount):
        amount = min(amount, len(similarities) - 1)
        if amount <= 0:
            return np.array([], dtype=int)
        candidates = np.argpartition(-similarities, amount - 1)[:amount]
        ordered = candidates[np.argsort(-similarities[candidates])]
        return ordered[np.isfinite(similarities[ordered])]

    def search_all(self, query_index, amount):
        started = time.perf_counter()
        similarities = self.U @ self.U[query_index]
        similarities[self.codes == self.codes[query_index]] = -np.inf
        top = self._top(similarities, amount)
        return top, similarities[top], (time.perf_counter() - started) * 1000

    def search_cluster(self, query_index, amount):
        cluster = self.cl[query_index]
        started = time.perf_counter()
        similarities = self.U_c[cluster] @ self.U[query_index]
        similarities[self.codes_c[cluster] == self.codes[query_index]] = -np.inf
        top = self._top(similarities, amount)
        return (
            self.idx_c[cluster][top],
            similarities[top],
            (time.perf_counter() - started) * 1000,
        )


# =============================================================================
# Reusable visual components
# =============================================================================


def configure_axes(axis, title="", grid="y"):
    axis.set_facecolor(SURFACE)
    if title:
        axis.set_title(title, loc="left", fontsize=10, color=NAVY, fontweight="semibold", pad=12)
    if grid:
        axis.grid(axis=grid, color=BORDER, linewidth=0.8, alpha=0.9)
    axis.set_axisbelow(True)
    for side in ("top", "right"):
        axis.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        axis.spines[side].set_color(BORDER)
    axis.tick_params(colors=TEXT_SECONDARY, labelsize=8, length=3)
    axis.xaxis.label.set_color(TEXT_SECONDARY)
    axis.yaxis.label.set_color(TEXT_SECONDARY)


class GradientBanner(tk.Canvas):
    """A responsive, softly rounded-looking gradient header."""

    def __init__(self, parent, title, subtitle, height=104):
        super().__init__(
            parent,
            height=height,
            bg=BG,
            highlightthickness=0,
            bd=0,
        )
        self.title_text = title
        self.subtitle_text = subtitle
        self.bind("<Configure>", self._draw)

    @staticmethod
    def _hex_to_rgb(value):
        value = value.lstrip("#")
        return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))

    @staticmethod
    def _rgb_to_hex(value):
        return "#%02x%02x%02x" % value

    def _draw(self, _event=None):
        self.delete("all")
        width = max(self.winfo_width(), 2)
        height = max(self.winfo_height(), 2)
        left = self._hex_to_rgb(PRIMARY_DARK)
        right = self._hex_to_rgb(LAVENDER)
        for x in range(width):
            ratio = x / max(width - 1, 1)
            rgb = tuple(int(left[i] + (right[i] - left[i]) * ratio) for i in range(3))
            self.create_line(x, 0, x, height, fill=self._rgb_to_hex(rgb))
        self.create_oval(width - 190, -80, width + 30, 140, fill="#FFFFFF", outline="", stipple="gray75")
        self.create_oval(width - 280, 44, width - 155, 169, fill="#FFFFFF", outline="", stipple="gray75")
        self.create_text(
            28,
            30,
            anchor="w",
            text=self.title_text,
            fill="white",
            font=("Segoe UI", 20, "bold"),
        )
        self.create_text(
            28,
            66,
            anchor="w",
            text=self.subtitle_text,
            fill="#EEF2FF",
            font=("Segoe UI", 10),
        )


class PrimaryButton(tk.Canvas):
    """Canvas button with a premium solid/hover treatment and disabled state."""

    def __init__(self, parent, text, command, width=172, height=38):
        super().__init__(
            parent,
            width=width,
            height=height,
            bg=parent.cget("bg") if "bg" in parent.keys() else SURFACE,
            highlightthickness=0,
            bd=0,
            cursor="hand2",
        )
        self.button_text = text
        self.command = command
        self.enabled = True
        self.hovered = False
        self.bind("<Enter>", self._enter)
        self.bind("<Leave>", self._leave)
        self.bind("<Button-1>", self._click)
        self._draw()

    def _draw(self):
        self.delete("all")
        color = PRIMARY if self.enabled else "#B8C5E7"
        if self.enabled and self.hovered:
            color = PRIMARY_DARK
        width = int(self.cget("width"))
        height = int(self.cget("height"))
        radius = 12
        self.create_polygon(
            radius,
            1,
            width - radius,
            1,
            width - 1,
            radius,
            width - 1,
            height - radius,
            width - radius,
            height - 1,
            radius,
            height - 1,
            1,
            height - radius,
            1,
            radius,
            smooth=True,
            fill=color,
            outline="",
        )
        self.create_text(
            width / 2,
            height / 2,
            text=self.button_text,
            fill="white",
            font=("Segoe UI", 9, "bold"),
        )

    def _enter(self, _event=None):
        self.hovered = True
        self._draw()

    def _leave(self, _event=None):
        self.hovered = False
        self._draw()

    def _click(self, _event=None):
        if self.enabled:
            self.command()

    def configure_state(self, enabled=None, text=None):
        if enabled is not None:
            self.enabled = enabled
            self.configure(cursor="hand2" if enabled else "arrow")
        if text is not None:
            self.button_text = text
        self._draw()


class ChartCard(tk.Frame):
    """White analytics card containing a Matplotlib figure."""

    def __init__(self, parent, title, subtitle="", figsize=(4, 2.7)):
        super().__init__(parent, bg=SHADOW, bd=0)
        self.inner = tk.Frame(
            self,
            bg=SURFACE,
            highlightthickness=1,
            highlightbackground=BORDER,
            bd=0,
        )
        self.inner.pack(fill="both", expand=True, padx=(0, 2), pady=(0, 2))
        heading = tk.Frame(self.inner, bg=SURFACE)
        heading.pack(fill="x", padx=18, pady=(14, 2))
        tk.Label(
            heading,
            text=title,
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 11, "bold"),
        ).pack(anchor="w")
        if subtitle:
            tk.Label(
                heading,
                text=subtitle,
                bg=SURFACE,
                fg=TEXT_SECONDARY,
                font=("Segoe UI", 8),
            ).pack(anchor="w", pady=(2, 0))

        self.figure = Figure(figsize=figsize, dpi=100, facecolor=SURFACE, layout="constrained")
        self.canvas = FigureCanvasTkAgg(self.figure, master=self.inner)
        widget = self.canvas.get_tk_widget()
        widget.configure(bg=SURFACE, highlightthickness=0)
        widget.pack(fill="both", expand=True, padx=12, pady=(4, 12))


class SpotifyApp:
    def __init__(self, root):
        self.root = root
        self.engine = None
        self.years = None
        self.match_idx = []
        self._after_id = None
        self.events = queue.Queue()
        self._recommend_busy = False
        self.current_page = "dashboard"
        self.status = tk.StringVar(value="Memuat data lagu dan menyiapkan model rekomendasi...")
        self.page_title = tk.StringVar(value="Overview Dashboard")
        self.page_context = tk.StringVar(value="Ringkasan dataset dan karakteristik audio Spotify")

        root.title("Spotify Recommender – Big Data Spark")
        root.geometry("1360x850")
        root.minsize(1080, 680)
        root.configure(bg=BG)
        root.option_add("*tearOff", False)
        self._style()

        root.grid_rowconfigure(0, weight=1)
        root.grid_columnconfigure(1, weight=1)
        self.sidebar = tk.Frame(root, bg=SIDEBAR, width=238, highlightbackground=BORDER, highlightthickness=1)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_propagate(False)

        self.shell = tk.Frame(root, bg=BG)
        self.shell.grid(row=0, column=1, sticky="nsew")
        self.shell.grid_rowconfigure(1, weight=1)
        self.shell.grid_columnconfigure(0, weight=1)

        self._build_sidebar()
        self._build_topbar()

        self.page_host = tk.Frame(self.shell, bg=BG)
        self.page_host.grid(row=1, column=0, sticky="nsew", padx=24, pady=(0, 14))
        self.page_host.grid_rowconfigure(0, weight=1)
        self.page_host.grid_columnconfigure(0, weight=1)

        self.pages = {}
        for key in ("dashboard", "cluster", "recommend", "evaluation"):
            page = tk.Frame(self.page_host, bg=BG)
            page.grid(row=0, column=0, sticky="nsew")
            self.pages[key] = page

        self.build_dashboard()
        self.build_cluster()
        self.build_recommend()
        self.build_eval()
        self.show_page("dashboard")

        threading.Thread(target=self.load_worker, daemon=True).start()
        self.root.after(100, self.process_events)

    # ------------------------------------------------------------------ styles
    def _style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        style.configure(".", font=("Segoe UI", 9), background=BG, foreground=NAVY)
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=SURFACE)
        style.configure("TLabel", background=BG, foreground=NAVY)
        style.configure("Card.TLabel", background=SURFACE, foreground=NAVY)
        style.configure("Muted.TLabel", background=SURFACE, foreground=TEXT_SECONDARY)
        style.configure(
            "TEntry",
            fieldbackground=SURFACE,
            foreground=NAVY,
            bordercolor=BORDER,
            lightcolor=BORDER,
            darkcolor=BORDER,
            padding=10,
        )
        style.map("TEntry", bordercolor=[("focus", PRIMARY)], lightcolor=[("focus", PRIMARY)])
        style.configure(
            "TCombobox",
            fieldbackground=SURFACE,
            background=SURFACE,
            foreground=NAVY,
            bordercolor=BORDER,
            arrowcolor=PRIMARY,
            padding=7,
        )
        style.map(
            "TCombobox",
            bordercolor=[("focus", PRIMARY)],
            fieldbackground=[("readonly", SURFACE)],
            selectbackground=[("readonly", SURFACE)],
            selectforeground=[("readonly", NAVY)],
        )
        style.configure(
            "Secondary.TButton",
            background=PASTEL_BLUE,
            foreground=PRIMARY_DARK,
            borderwidth=0,
            padding=(13, 8),
            font=("Segoe UI", 9, "bold"),
        )
        style.map(
            "Secondary.TButton",
            background=[("active", "#D9E5FF"), ("pressed", "#CFDEFF")],
        )
        style.configure(
            "Ghost.TButton",
            background=SURFACE,
            foreground=TEXT_SECONDARY,
            bordercolor=BORDER,
            padding=(12, 8),
            font=("Segoe UI", 9, "bold"),
        )
        style.map(
            "Ghost.TButton",
            foreground=[("active", PRIMARY)],
            background=[("active", PASTEL_BLUE)],
        )
        style.configure(
            "Modern.TRadiobutton",
            background=SURFACE,
            foreground=NAVY,
            indicatorcolor=SURFACE,
            padding=5,
        )
        style.map(
            "Modern.TRadiobutton",
            indicatorcolor=[("selected", PRIMARY)],
            foreground=[("selected", PRIMARY_DARK)],
        )
        style.configure(
            "Treeview",
            rowheight=34,
            background=SURFACE,
            fieldbackground=SURFACE,
            foreground=NAVY,
            borderwidth=0,
            relief="flat",
            font=("Segoe UI", 9),
        )
        style.configure(
            "Treeview.Heading",
            background="#F4F6FB",
            foreground=TEXT_SECONDARY,
            borderwidth=0,
            relief="flat",
            padding=(8, 10),
            font=("Segoe UI", 8, "bold"),
        )
        style.map(
            "Treeview",
            background=[("selected", PASTEL_BLUE)],
            foreground=[("selected", PRIMARY_DARK)],
        )
        style.map("Treeview.Heading", background=[("active", "#EDF1FA")])
        style.configure(
            "Vertical.TScrollbar",
            background="#DDE3F2",
            troughcolor="#F4F6FB",
            bordercolor="#F4F6FB",
            arrowcolor=TEXT_SECONDARY,
        )
        style.configure(
            "Horizontal.TScrollbar",
            background="#DDE3F2",
            troughcolor="#F4F6FB",
            bordercolor="#F4F6FB",
            arrowcolor=TEXT_SECONDARY,
        )
        style.configure(
            "App.Horizontal.TProgressbar",
            background=PRIMARY,
            troughcolor=PASTEL_BLUE,
            bordercolor=PASTEL_BLUE,
            lightcolor=PRIMARY,
            darkcolor=PRIMARY,
        )

    # ------------------------------------------------------------- application
    def _build_sidebar(self):
        brand = tk.Frame(self.sidebar, bg=SIDEBAR)
        brand.pack(fill="x", padx=20, pady=(24, 30))
        logo = tk.Canvas(brand, width=42, height=42, bg=SIDEBAR, highlightthickness=0)
        logo.pack(side="left")
        logo.create_oval(2, 2, 40, 40, fill=PRIMARY, outline="")
        logo.create_arc(11, 11, 34, 25, start=20, extent=140, style="arc", width=2, outline="white")
        logo.create_arc(12, 17, 33, 30, start=20, extent=140, style="arc", width=2, outline="white")
        logo.create_arc(14, 23, 31, 34, start=20, extent=140, style="arc", width=2, outline="white")
        brand_text = tk.Frame(brand, bg=SIDEBAR)
        brand_text.pack(side="left", padx=(10, 0))
        tk.Label(
            brand_text,
            text="Spotify",
            bg=SIDEBAR,
            fg=NAVY,
            font=("Segoe UI", 13, "bold"),
        ).pack(anchor="w")
        tk.Label(
            brand_text,
            text="RECOMMENDER",
            bg=SIDEBAR,
            fg=PRIMARY,
            font=("Segoe UI", 7, "bold"),
        ).pack(anchor="w")

        tk.Label(
            self.sidebar,
            text="WORKSPACE",
            bg=SIDEBAR,
            fg="#A1A8BA",
            font=("Segoe UI", 7, "bold"),
        ).pack(anchor="w", padx=24, pady=(0, 8))

        self.nav_buttons = {}
        nav_items = [
            ("dashboard", "OV", "Dashboard", "Overview & insight"),
            ("cluster", "CA", "Cluster Analysis", "K-Means profiling"),
            ("recommend", "MR", "Music Recommendation", "Audio similarity"),
            ("evaluation", "EV", "Evaluation", "Model performance"),
        ]
        for key, symbol, label, detail in nav_items:
            frame = tk.Frame(self.sidebar, bg=SIDEBAR, cursor="hand2")
            frame.pack(fill="x", padx=12, pady=3)
            frame.columnconfigure(1, weight=1)
            accent = tk.Frame(frame, bg=SIDEBAR, width=4, height=48)
            accent.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(0, 8))
            badge = tk.Label(
                frame,
                text=symbol,
                bg="#F0F3FB",
                fg=TEXT_SECONDARY,
                width=3,
                height=2,
                font=("Segoe UI", 8, "bold"),
            )
            badge.grid(row=0, column=1, rowspan=2, padx=(0, 10), pady=7)
            title = tk.Label(
                frame,
                text=label,
                bg=SIDEBAR,
                fg=NAVY,
                font=("Segoe UI", 9, "bold"),
            )
            title.grid(row=0, column=2, sticky="sw")
            sub = tk.Label(
                frame,
                text=detail,
                bg=SIDEBAR,
                fg=TEXT_SECONDARY,
                font=("Segoe UI", 7),
            )
            sub.grid(row=1, column=2, sticky="nw")
            frame.columnconfigure(2, weight=1)
            widgets = (frame, accent, badge, title, sub)
            for widget in widgets:
                widget.bind("<Button-1>", lambda _event, page=key: self.show_page(page))
                widget.bind("<Enter>", lambda _event, page=key: self._nav_hover(page, True))
                widget.bind("<Leave>", lambda _event, page=key: self._nav_hover(page, False))
            self.nav_buttons[key] = widgets

        footer = tk.Frame(
            self.sidebar,
            bg=SOFT_PURPLE,
            highlightthickness=1,
            highlightbackground="#E2D9FB",
        )
        footer.pack(side="bottom", fill="x", padx=16, pady=18)
        tk.Label(
            footer,
            text="BIG DATA ENGINE",
            bg=SOFT_PURPLE,
            fg="#7254C7",
            font=("Segoe UI", 7, "bold"),
        ).pack(anchor="w", padx=14, pady=(12, 3))
        tk.Label(
            footer,
            text="Apache Spark + K-Means",
            bg=SOFT_PURPLE,
            fg=NAVY,
            font=("Segoe UI", 9, "bold"),
        ).pack(anchor="w", padx=14)
        tk.Label(
            footer,
            text="Audio-feature recommendation\nwith cosine similarity",
            bg=SOFT_PURPLE,
            fg=TEXT_SECONDARY,
            justify="left",
            font=("Segoe UI", 7),
        ).pack(anchor="w", padx=14, pady=(3, 12))

    def _build_topbar(self):
        topbar = tk.Frame(self.shell, bg=BG, height=86)
        topbar.grid(row=0, column=0, sticky="ew", padx=24, pady=(8, 0))
        topbar.grid_columnconfigure(0, weight=1)
        topbar.grid_propagate(False)

        title_box = tk.Frame(topbar, bg=BG)
        title_box.grid(row=0, column=0, sticky="w", pady=13)
        tk.Label(
            title_box,
            textvariable=self.page_title,
            bg=BG,
            fg=NAVY,
            font=("Segoe UI", 17, "bold"),
        ).pack(anchor="w")
        tk.Label(
            title_box,
            textvariable=self.page_context,
            bg=BG,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 9),
        ).pack(anchor="w", pady=(2, 0))

        status_card = tk.Frame(
            topbar,
            bg=SURFACE,
            highlightbackground=BORDER,
            highlightthickness=1,
        )
        status_card.grid(row=0, column=1, sticky="e", pady=14)
        self.status_dot = tk.Canvas(status_card, width=18, height=18, bg=SURFACE, highlightthickness=0)
        self.status_dot.pack(side="left", padx=(12, 2), pady=9)
        self.status_dot.create_oval(5, 5, 13, 13, fill=WARNING, outline="")
        tk.Label(
            status_card,
            textvariable=self.status,
            bg=SURFACE,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 8),
        ).pack(side="left", padx=(2, 12), pady=9)

    def _nav_hover(self, key, entered):
        if key == self.current_page:
            return
        widgets = self.nav_buttons[key]
        color = "#F8F9FD" if entered else SIDEBAR
        widgets[0].configure(bg=color)
        widgets[1].configure(bg=color)
        widgets[3].configure(bg=color)
        widgets[4].configure(bg=color)

    def show_page(self, key):
        metadata = {
            "dashboard": (
                "Overview Dashboard",
                "Ringkasan dataset dan karakteristik audio Spotify",
            ),
            "cluster": (
                "Cluster Analysis",
                "Eksplorasi segmen musik hasil K-Means Apache Spark",
            ),
            "recommend": (
                "Music Recommendation",
                "Temukan lagu dengan karakter audio paling serupa",
            ),
            "evaluation": (
                "Model Evaluation",
                "Kualitas cluster dan efisiensi pencarian rekomendasi",
            ),
        }
        self.current_page = key
        self.page_title.set(metadata[key][0])
        self.page_context.set(metadata[key][1])
        self.pages[key].tkraise()

        for nav_key, widgets in self.nav_buttons.items():
            active = nav_key == key
            bg = PASTEL_BLUE if active else SIDEBAR
            widgets[0].configure(bg=bg)
            widgets[1].configure(bg=PRIMARY if active else SIDEBAR)
            widgets[2].configure(
                bg=PRIMARY if active else "#F0F3FB",
                fg="white" if active else TEXT_SECONDARY,
            )
            widgets[3].configure(bg=bg, fg=PRIMARY_DARK if active else NAVY)
            widgets[4].configure(bg=bg)

    def _page_banner(self, parent, title, subtitle):
        banner = GradientBanner(parent, title, subtitle)
        banner.pack(fill="x", pady=(0, 16))
        return banner

    def _card(self, parent):
        shadow = tk.Frame(parent, bg=SHADOW)
        card = tk.Frame(
            shadow,
            bg=SURFACE,
            highlightthickness=1,
            highlightbackground=BORDER,
        )
        card.pack(fill="both", expand=True, padx=(0, 2), pady=(0, 2))
        return shadow, card

    def _kpi_card(self, parent, column, label, symbol, tint, accent):
        shadow, card = self._card(parent)
        shadow.grid(row=0, column=column, sticky="nsew", padx=(0 if column == 0 else 6, 0), pady=0)
        parent.columnconfigure(column, weight=1, uniform="kpi")

        top = tk.Frame(card, bg=SURFACE)
        top.pack(fill="x", padx=16, pady=(14, 0))
        tk.Label(
            top,
            text=symbol,
            bg=tint,
            fg=accent,
            width=4,
            height=2,
            font=("Segoe UI", 8, "bold"),
        ).pack(side="left")
        tk.Label(
            top,
            text="LIVE DATA",
            bg=SURFACE,
            fg=SUCCESS,
            font=("Segoe UI", 7, "bold"),
        ).pack(side="right")
        value = tk.StringVar(value="—")
        tk.Label(
            card,
            textvariable=value,
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 20, "bold"),
        ).pack(anchor="w", padx=16, pady=(9, 0))
        tk.Label(
            card,
            text=label,
            bg=SURFACE,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 8),
        ).pack(anchor="w", padx=16, pady=(0, 14))
        return value

    # --------------------------------------------------------------- dashboard
    def build_dashboard(self):
        page = self.pages["dashboard"]
        self._page_banner(
            page,
            "Your music data, beautifully understood.",
            "Analisis clustering dan distribusi fitur dari seluruh katalog Spotify.",
        )

        kpis = tk.Frame(page, bg=BG)
        kpis.pack(fill="x", pady=(0, 14))
        self.kpi_songs = self._kpi_card(kpis, 0, "Total Songs", "SONG", PASTEL_BLUE, PRIMARY)
        self.kpi_artists = self._kpi_card(kpis, 1, "Total Artists", "ART", SOFT_PURPLE, "#7254C7")
        self.kpi_clusters = self._kpi_card(kpis, 2, "Total Clusters", "K", "#E8F7FC", "#3A9FC2")
        self.kpi_years = self._kpi_card(kpis, 3, "Release Year Range", "YR", "#FFF4E5", "#C8852D")

        charts = tk.Frame(page, bg=BG)
        charts.pack(fill="both", expand=True)
        charts.grid_columnconfigure(0, weight=1, uniform="dash")
        charts.grid_columnconfigure(1, weight=1, uniform="dash")
        charts.grid_columnconfigure(2, weight=1, uniform="dash")
        charts.grid_rowconfigure(0, weight=3)
        charts.grid_rowconfigure(1, weight=2)

        self.decade_card = ChartCard(
            charts,
            "Release Timeline",
            "Jumlah lagu berdasarkan dekade rilis",
            figsize=(9, 2.4),
        )
        self.decade_card.grid(row=0, column=0, columnspan=3, sticky="nsew", pady=(0, 8))

        self.feature_cards = {}
        specs = [
            ("energy", "Energy Distribution", "Intensitas dan aktivitas audio"),
            ("danceability", "Danceability Distribution", "Kesesuaian ritme untuk menari"),
            ("valence", "Valence Distribution", "Nuansa positif pada lagu"),
        ]
        for column, (feature, title, subtitle) in enumerate(specs):
            card = ChartCard(charts, title, subtitle, figsize=(3.1, 2.15))
            card.grid(
                row=1,
                column=column,
                sticky="nsew",
                padx=(0 if column == 0 else 4, 0 if column == 2 else 4),
            )
            self.feature_cards[feature] = card

    def draw_dashboard(self):
        engine = self.engine
        df = engine.df
        self.kpi_songs.set(format_number(len(df)))
        self.kpi_artists.set(format_number(df["artists"].nunique()))
        self.kpi_clusters.set(str(len(engine.clusters)))
        if self.years is not None and len(self.years):
            self.kpi_years.set(f"{int(self.years.min())} – {int(self.years.max())}")
        else:
            self.kpi_years.set("Not available")

        figure = self.decade_card.figure
        figure.clear()
        axis = figure.add_subplot(111)
        if self.years is not None and len(self.years):
            decades = (self.years // 10 * 10).clip(lower=1940)
            counts = decades.value_counts().sort_index()
            labels = ["≤1940" if decade == 1940 else f"{decade}s" for decade in counts.index]
            colors = [PRIMARY if i != len(labels) - 1 else LAVENDER for i in range(len(labels))]
            bars = axis.bar(labels, counts.values, color=colors, width=0.62, zorder=3)
            peak = int(np.argmax(counts.values))
            bars[peak].set_color(PRIMARY_DARK)
            axis.text(
                peak,
                counts.values[peak],
                format_number(counts.values[peak]),
                ha="center",
                va="bottom",
                fontsize=8,
                color=NAVY,
                fontweight="bold",
            )
            axis.ticklabel_format(axis="y", style="plain")
            axis.set_ylabel("Jumlah lagu", fontsize=8)
            configure_axes(axis, grid="y")
        else:
            axis.axis("off")
            axis.text(
                0.5,
                0.55,
                "Release year belum tersedia",
                ha="center",
                va="center",
                color=NAVY,
                fontsize=11,
                fontweight="bold",
            )
            axis.text(
                0.5,
                0.4,
                "Kolom 'year' tidak ditemukan di data_clean/tracks_clean.csv",
                ha="center",
                va="center",
                color=TEXT_SECONDARY,
                fontsize=8,
            )
        self.decade_card.canvas.draw_idle()

        chart_colors = {
            "energy": PRIMARY,
            "danceability": LAVENDER,
            "valence": CYAN,
        }
        for feature, card in self.feature_cards.items():
            card.figure.clear()
            axis = card.figure.add_subplot(111)
            values = df[feature].to_numpy()
            axis.hist(
                values,
                bins=34,
                color=chart_colors[feature],
                alpha=0.9,
                edgecolor=SURFACE,
                linewidth=0.4,
            )
            axis.axvline(
                values.mean(),
                color=PRIMARY_DARK,
                linestyle="--",
                linewidth=1.3,
                alpha=0.85,
            )
            axis.text(
                0.97,
                0.92,
                f"Mean {values.mean():.2f}",
                transform=axis.transAxes,
                ha="right",
                va="top",
                color=PRIMARY_DARK,
                fontsize=7,
                fontweight="bold",
            )
            axis.ticklabel_format(axis="y", style="plain")
            axis.set_xlabel(feature.title(), fontsize=8)
            configure_axes(axis, grid="y")
            card.canvas.draw_idle()

    # ---------------------------------------------------------- cluster analysis
    def build_cluster(self):
        page = self.pages["cluster"]
        self._page_banner(
            page,
            "Discover the shape of your music catalog.",
            "Bandingkan ukuran cluster dan profil audio terstandar secara berdampingan.",
        )

        charts = tk.Frame(page, bg=BG)
        charts.pack(fill="both", expand=True)
        charts.grid_columnconfigure(0, weight=2)
        charts.grid_columnconfigure(1, weight=5)
        charts.grid_rowconfigure(0, weight=1)
        self.cluster_count_card = ChartCard(
            charts,
            "Cluster Size",
            "Jumlah lagu dalam setiap cluster",
            figsize=(3.4, 3.0),
        )
        self.cluster_count_card.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        self.cluster_heat_card = ChartCard(
            charts,
            "Audio Profile Heatmap",
            "Nilai di atas atau di bawah rata-rata seluruh lagu",
            figsize=(7.0, 3.0),
        )
        self.cluster_heat_card.grid(row=0, column=1, sticky="nsew", padx=(5, 0))

        shadow, panel = self._card(page)
        shadow.pack(fill="both", expand=True, pady=(12, 0))
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_rowconfigure(2, weight=1)

        controls = tk.Frame(panel, bg=SURFACE)
        controls.grid(row=0, column=0, sticky="ew", padx=18, pady=(15, 10))
        tk.Label(
            controls,
            text="Explore cluster",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 11, "bold"),
        ).pack(side="left")
        tk.Label(
            controls,
            text="Pilih cluster untuk melihat karakteristik dan sampel lagu",
            bg=SURFACE,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 8),
        ).pack(side="left", padx=(12, 18))
        self.cluster_pick = tk.StringVar()
        self.cluster_combo = ttk.Combobox(
            controls,
            textvariable=self.cluster_pick,
            state="readonly",
            width=9,
        )
        self.cluster_combo.pack(side="left")
        self.cluster_combo.bind("<<ComboboxSelected>>", self.show_cluster_samples)
        ttk.Button(
            controls,
            text="Acak sampel",
            style="Secondary.TButton",
            command=self.show_cluster_samples,
        ).pack(side="right")

        insight = tk.Frame(controls, bg=SOFT_PURPLE, highlightbackground="#E1D6FC", highlightthickness=1)
        insight.pack(side="right", padx=10)
        self.cluster_desc = tk.StringVar(value="Data cluster sedang disiapkan")
        tk.Label(
            insight,
            textvariable=self.cluster_desc,
            bg=SOFT_PURPLE,
            fg="#6848B8",
            font=("Segoe UI", 8, "bold"),
        ).pack(padx=12, pady=8)

        separator = tk.Frame(panel, height=1, bg=BORDER)
        separator.grid(row=1, column=0, sticky="ew")

        table_box = tk.Frame(panel, bg=SURFACE)
        table_box.grid(row=2, column=0, sticky="nsew", padx=18, pady=(8, 16))
        table_box.grid_columnconfigure(0, weight=1)
        table_box.grid_rowconfigure(0, weight=1)
        self.samples = ttk.Treeview(
            table_box,
            columns=("no", "title", "artist"),
            show="headings",
            height=5,
        )
        self.samples.heading("no", text="#")
        self.samples.heading("title", text="JUDUL LAGU")
        self.samples.heading("artist", text="ARTIS")
        self.samples.column("no", width=44, anchor="center", stretch=False)
        self.samples.column("title", width=440)
        self.samples.column("artist", width=320)
        self.samples.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(table_box, orient="vertical", command=self.samples.yview)
        self.samples.configure(yscrollcommand=scrollbar.set)
        scrollbar.grid(row=0, column=1, sticky="ns")

    def draw_clusters(self):
        engine = self.engine

        self.cluster_count_card.figure.clear()
        axis = self.cluster_count_card.figure.add_subplot(111)
        positions = np.arange(len(engine.clusters))
        colors = [PRIMARY if index % 2 == 0 else LAVENDER for index in range(len(positions))]
        bars = axis.barh(positions, engine.counts, color=colors, height=0.58)
        axis.set_yticks(positions)
        axis.set_yticklabels([f"Cluster {cluster}" for cluster in engine.clusters])
        axis.invert_yaxis()
        axis.ticklabel_format(axis="x", style="plain")
        for bar, count in zip(bars, engine.counts):
            axis.text(
                count,
                bar.get_y() + bar.get_height() / 2,
                f"  {format_number(count)}",
                va="center",
                fontsize=7,
                color=TEXT_SECONDARY,
            )
        axis.set_xlabel("Jumlah lagu", fontsize=8)
        configure_axes(axis, grid="x")
        self.cluster_count_card.canvas.draw_idle()

        self.cluster_heat_card.figure.clear()
        axis = self.cluster_heat_card.figure.add_subplot(111)
        limit = float(min(2.0, max(0.5, np.abs(engine.mean_z).max())))
        image = axis.imshow(
            engine.mean_z,
            cmap=HEATMAP,
            vmin=-limit,
            vmax=limit,
            aspect="auto",
        )
        axis.set_xticks(range(len(FEATURES)))
        axis.set_xticklabels(
            [feature.title() for feature in FEATURES],
            rotation=32,
            ha="right",
        )
        axis.set_yticks(positions)
        axis.set_yticklabels([f"Cluster {cluster}" for cluster in engine.clusters])
        for row in range(engine.mean_z.shape[0]):
            for column in range(engine.mean_z.shape[1]):
                value = engine.mean_z[row, column]
                axis.text(
                    column,
                    row,
                    f"{value:.1f}",
                    ha="center",
                    va="center",
                    fontsize=7,
                    color="white" if abs(value) > 0.58 * limit else NAVY,
                )
        for spine in axis.spines.values():
            spine.set_visible(False)
        axis.tick_params(colors=TEXT_SECONDARY, labelsize=7, length=0)
        colorbar = self.cluster_heat_card.figure.colorbar(
            image,
            ax=axis,
            fraction=0.025,
            pad=0.02,
        )
        colorbar.ax.tick_params(labelsize=7, colors=TEXT_SECONDARY)
        colorbar.outline.set_visible(False)
        self.cluster_heat_card.canvas.draw_idle()

        self.cluster_combo.configure(values=[str(cluster) for cluster in engine.clusters])
        self.cluster_combo.current(0)
        self.show_cluster_samples()

    def show_cluster_samples(self, _event=None):
        engine = self.engine
        if engine is None or not self.cluster_pick.get():
            return
        cluster = int(self.cluster_pick.get())
        position = int(np.where(engine.clusters == cluster)[0][0])
        self.cluster_desc.set(f"Cluster {cluster}  ·  {describe_cluster(engine.mean_z[position])}")
        self._clear_tree(self.samples)
        samples = np.random.choice(
            engine.idx_c[cluster],
            size=min(30, len(engine.idx_c[cluster])),
            replace=False,
        )
        for rank, index in enumerate(samples, start=1):
            self.samples.insert(
                "",
                "end",
                values=(
                    rank,
                    engine.df["name"].iat[index],
                    fmt_artists(engine.df["artists"].iat[index]),
                ),
                tags=("even",) if rank % 2 == 0 else (),
            )
        self.samples.tag_configure("even", background="#FAFBFE")

    # ------------------------------------------------------ music recommendation
    def build_recommend(self):
        page = self.pages["recommend"]
        self._page_banner(
            page,
            "Find your next favorite track.",
            "Cari lagu awal, pilih strategi pencarian, lalu bandingkan kemiripan audionya.",
        )

        workspace = tk.Frame(page, bg=BG)
        workspace.pack(fill="x", pady=(0, 12))
        workspace.grid_columnconfigure(0, weight=3)
        workspace.grid_columnconfigure(1, weight=2)

        search_shadow, search_card = self._card(workspace)
        search_shadow.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        tk.Label(
            search_card,
            text="Search a song or artist",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 12, "bold"),
        ).pack(anchor="w", padx=18, pady=(16, 3))
        tk.Label(
            search_card,
            text="Ketik minimal dua karakter, kemudian pilih satu lagu dari hasil.",
            bg=SURFACE,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 8),
        ).pack(anchor="w", padx=18)

        entry_shell = tk.Frame(search_card, bg=PASTEL_BLUE)
        entry_shell.pack(fill="x", padx=18, pady=(12, 8))
        tk.Label(
            entry_shell,
            text="SEARCH",
            bg=PASTEL_BLUE,
            fg=PRIMARY,
            font=("Segoe UI", 7, "bold"),
        ).pack(side="left", padx=(12, 6))
        self.query = tk.StringVar()
        self.search_entry = ttk.Entry(
            entry_shell,
            textvariable=self.query,
            font=("Segoe UI", 10),
        )
        self.search_entry.pack(side="left", fill="x", expand=True, padx=(0, 2), pady=2)
        self.search_entry.bind("<KeyRelease>", self.on_type)

        list_shell = tk.Frame(search_card, bg=SURFACE)
        list_shell.pack(fill="both", expand=True, padx=18, pady=(0, 16))
        list_shell.grid_columnconfigure(0, weight=1)
        self.matches = tk.Listbox(
            list_shell,
            height=5,
            exportselection=False,
            font=("Segoe UI", 9),
            activestyle="none",
            selectbackground=PASTEL_BLUE,
            selectforeground=PRIMARY_DARK,
            highlightthickness=1,
            highlightbackground=BORDER,
            relief="flat",
            bd=0,
            fg=NAVY,
            bg=SURFACE,
        )
        self.matches.grid(row=0, column=0, sticky="nsew")
        match_scroll = ttk.Scrollbar(list_shell, orient="vertical", command=self.matches.yview)
        match_scroll.grid(row=0, column=1, sticky="ns")
        self.matches.configure(yscrollcommand=match_scroll.set)
        self.matches.bind("<<ListboxSelect>>", self.on_select)
        self.matches.bind("<Double-Button-1>", lambda _event: self.recommend())

        settings_shadow, settings_card = self._card(workspace)
        settings_shadow.grid(row=0, column=1, sticky="nsew", padx=(6, 0))
        tk.Label(
            settings_card,
            text="Recommendation settings",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 12, "bold"),
        ).pack(anchor="w", padx=18, pady=(16, 3))
        tk.Label(
            settings_card,
            text="Atur jumlah hasil dan ruang pencarian.",
            bg=SURFACE,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 8),
        ).pack(anchor="w", padx=18)

        amount_row = tk.Frame(settings_card, bg=SURFACE)
        amount_row.pack(fill="x", padx=18, pady=(16, 10))
        tk.Label(
            amount_row,
            text="Jumlah rekomendasi",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 9, "bold"),
        ).pack(side="left")
        self.amount = tk.StringVar(value="10")
        ttk.Combobox(
            amount_row,
            textvariable=self.amount,
            values=["5", "10", "15", "20"],
            state="readonly",
            width=5,
        ).pack(side="right")

        mode_box = tk.Frame(
            settings_card,
            bg="#F8F9FD",
            highlightthickness=1,
            highlightbackground=BORDER,
        )
        mode_box.pack(fill="x", padx=18, pady=(0, 14))
        self.mode = tk.StringVar(value="cluster")
        ttk.Radiobutton(
            mode_box,
            text="Filter cluster  ·  Lebih cepat",
            value="cluster",
            variable=self.mode,
            style="Modern.TRadiobutton",
        ).pack(anchor="w", padx=10, pady=(8, 2))
        ttk.Radiobutton(
            mode_box,
            text="Semua lagu  ·  Cakupan penuh",
            value="all",
            variable=self.mode,
            style="Modern.TRadiobutton",
        ).pack(anchor="w", padx=10, pady=(2, 8))
        self.recommend_button = PrimaryButton(
            settings_card,
            "Cari Rekomendasi",
            self.recommend,
            width=190,
            height=40,
        )
        self.recommend_button.pack(anchor="e", padx=18, pady=(0, 16))
        self.recommend_button.configure_state(enabled=False)

        result_shadow, result_card = self._card(page)
        result_shadow.pack(fill="both", expand=True)
        result_card.grid_columnconfigure(0, weight=1)
        result_card.grid_rowconfigure(2, weight=1)

        result_heading = tk.Frame(result_card, bg=SURFACE)
        result_heading.grid(row=0, column=0, sticky="ew", padx=18, pady=(15, 10))
        tk.Label(
            result_heading,
            text="Recommendation results",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 11, "bold"),
        ).pack(side="left")
        self.result_count = tk.StringVar(value="Belum ada hasil")
        tk.Label(
            result_heading,
            textvariable=self.result_count,
            bg=PASTEL_BLUE,
            fg=PRIMARY_DARK,
            font=("Segoe UI", 7, "bold"),
            padx=9,
            pady=4,
        ).pack(side="right")

        self.info = tk.StringVar(value="Cari dan pilih lagu untuk memulai rekomendasi.")
        self.performance_panel = tk.Frame(
            result_card,
            bg=SOFT_PURPLE,
            highlightbackground="#E1D6FC",
            highlightthickness=1,
        )
        self.performance_panel.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 10))
        tk.Label(
            self.performance_panel,
            text="PERFORMANCE",
            bg=SOFT_PURPLE,
            fg="#7254C7",
            font=("Segoe UI", 7, "bold"),
        ).pack(side="left", padx=(12, 8), pady=8)
        tk.Label(
            self.performance_panel,
            textvariable=self.info,
            bg=SOFT_PURPLE,
            fg=NAVY,
            font=("Segoe UI", 8),
            wraplength=900,
            justify="left",
        ).pack(side="left", fill="x", expand=True, padx=(0, 12), pady=8)

        table_box = tk.Frame(result_card, bg=SURFACE)
        table_box.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 16))
        table_box.grid_columnconfigure(0, weight=1)
        table_box.grid_rowconfigure(0, weight=1)
        columns = ("no", "title", "artist", "cluster", "score", "visual")
        self.results = ttk.Treeview(table_box, columns=columns, show="headings", height=7)
        definitions = [
            ("no", "RANK", 58, "center"),
            ("title", "JUDUL LAGU", 310, "w"),
            ("artist", "ARTIS", 230, "w"),
            ("cluster", "CLUSTER", 80, "center"),
            ("score", "COSINE", 90, "center"),
            ("visual", "SIMILARITY", 180, "w"),
        ]
        for column, label, width, anchor in definitions:
            self.results.heading(column, text=label)
            self.results.column(column, width=width, anchor=anchor)
        self.results.grid(row=0, column=0, sticky="nsew")
        result_scroll = ttk.Scrollbar(table_box, orient="vertical", command=self.results.yview)
        result_scroll.grid(row=0, column=1, sticky="ns")
        self.results.configure(yscrollcommand=result_scroll.set)
        self.results.tag_configure("even", background="#FAFBFE")
        self.results.tag_configure("top", foreground=PRIMARY_DARK, font=("Segoe UI", 9, "bold"))

    def on_type(self, _event=None):
        if self._after_id:
            self.root.after_cancel(self._after_id)
        self._after_id = self.root.after(300, self.search_songs)

    def search_songs(self):
        self.matches.delete(0, tk.END)
        self.match_idx = []
        self.recommend_button.configure_state(enabled=False)
        if self.engine is None:
            return
        query = self.query.get().strip().lower()
        if len(query) < 2:
            self.info.set("Ketik minimal 2 karakter untuk mencari judul atau artis.")
            return
        mask = self.engine.search_text.str.contains(query, regex=False, na=False).to_numpy()
        found = np.flatnonzero(mask)[:100]
        df = self.engine.df
        for index in found:
            self.match_idx.append(int(index))
            self.matches.insert(
                tk.END,
                f"  {df['name'].iat[index]}  —  {fmt_artists(df['artists'].iat[index])}"
                f"   ·   Cluster {df['cluster'].iat[index]}",
            )
        if not len(found):
            self.matches.insert(tk.END, "  Tidak ada lagu yang cocok.")
            self.info.set("Lagu tidak ditemukan. Coba kata kunci judul atau artis lain.")
        else:
            self.info.set(f"{len(found)} lagu cocok. Pilih satu lagu untuk melihat rekomendasi.")

    def on_select(self, _event=None):
        if self.matches.curselection() and self.match_idx:
            self.recommend_button.configure_state(enabled=True)

    def recommend(self):
        selection = self.matches.curselection()
        if self.engine is None or not selection or not self.match_idx:
            messagebox.showinfo(
                "Pilih lagu",
                "Cari judul atau artis, lalu pilih satu lagu dari daftar.",
            )
            return
        query_index = self.match_idx[selection[0]]
        amount = int(self.amount.get())
        engine = self.engine
        if self._recommend_busy:
            return

        self._recommend_busy = True
        self.recommend_button.configure_state(enabled=False, text="Menghitung...")
        self.info.set("Menghitung kemiripan audio pada background thread...")
        mode = self.mode.get()

        def worker():
            try:
                top_all, similarity_all, time_all = engine.search_all(query_index, amount)
                top_cluster, similarity_cluster, time_cluster = engine.search_cluster(
                    query_index, amount
                )
                self.events.put(
                    (
                        "recommend",
                        (
                            query_index,
                            mode,
                            top_all,
                            similarity_all,
                            time_all,
                            top_cluster,
                            similarity_cluster,
                            time_cluster,
                        ),
                    )
                )
            except Exception as error:
                self.events.put(("recommend_error", str(error)))

        threading.Thread(target=worker, daemon=True).start()

    def show_recommendations(self, data):
        (
            query_index,
            mode,
            top_all,
            similarity_all,
            time_all,
            top_cluster,
            similarity_cluster,
            time_cluster,
        ) = data
        engine = self.engine
        top, similarities = (
            (top_cluster, similarity_cluster) if mode == "cluster" else (top_all, similarity_all)
        )
        self._clear_tree(self.results)

        for rank, (index, similarity) in enumerate(zip(top, similarities), start=1):
            normalized = max(0.0, min(1.0, (float(similarity) + 1) / 2))
            blocks = int(round(normalized * 10))
            meter = "■" * blocks + "□" * (10 - blocks)
            tags = ("top",) if rank <= 3 else (("even",) if rank % 2 == 0 else ())
            self.results.insert(
                "",
                "end",
                tags=tags,
                values=(
                    f"{rank:02d}",
                    engine.df["name"].iat[int(index)],
                    fmt_artists(engine.df["artists"].iat[int(index)]),
                    f"C{int(engine.cl[int(index)])}",
                    f"{float(similarity):.3f}",
                    meter,
                ),
            )

        overlap = len(set(top_all.tolist()) & set(top_cluster.tolist()))
        share = len(engine.idx_c[engine.cl[query_index]]) / len(engine.df) * 100
        source = f"{engine.df['name'].iat[query_index]} — {fmt_artists(engine.df['artists'].iat[query_index])}"
        self.result_count.set(f"{len(top)} rekomendasi")
        self.info.set(
            f"{source}  ·  Cluster {engine.cl[query_index]}  |  "
            f"Cluster mode {time_cluster:.1f} ms ({share:.0f}% katalog) vs "
            f"all songs {time_all:.1f} ms  |  Overlap top result {overlap}/{len(top_all)}"
        )

    # --------------------------------------------------------------- evaluation
    def build_eval(self):
        page = self.pages["evaluation"]
        self._page_banner(
            page,
            "Measure what matters.",
            "Pantau kualitas segmentasi dan dampak cluster terhadap performa pencarian.",
        )

        toolbar_shadow, toolbar = self._card(page)
        toolbar_shadow.pack(fill="x", pady=(0, 12))
        self.eval_note = tk.StringVar(value="Menunggu hasil evaluasi")
        tk.Label(
            toolbar,
            text="Evaluation workspace",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 10, "bold"),
        ).pack(side="left", padx=(16, 8), pady=11)
        tk.Label(
            toolbar,
            textvariable=self.eval_note,
            bg=SURFACE,
            fg=TEXT_SECONDARY,
            font=("Segoe UI", 8),
        ).pack(side="left", pady=11)
        ttk.Button(
            toolbar,
            text="Lihat Detail Query",
            style="Secondary.TButton",
            command=self.show_eval_detail,
        ).pack(side="right", padx=(6, 16), pady=7)
        ttk.Button(
            toolbar,
            text="Muat Ulang Hasil",
            style="Ghost.TButton",
            command=self.draw_eval,
        ).pack(side="right", pady=7)

        charts = tk.Frame(page, bg=BG)
        charts.pack(fill="both", expand=True)
        for column in range(3):
            charts.grid_columnconfigure(column, weight=1, uniform="evaluation")
        charts.grid_rowconfigure(0, weight=1)
        self.eval_cards = [
            ChartCard(
                charts,
                "Silhouette Score",
                "Semakin tinggi, semakin baik",
                figsize=(3.5, 2.45),
            ),
            ChartCard(
                charts,
                "Davies-Bouldin Index",
                "Semakin rendah, semakin baik",
                figsize=(3.5, 2.45),
            ),
            ChartCard(
                charts,
                "Search Performance",
                "Rata-rata waktu pencarian",
                figsize=(3.5, 2.45),
            ),
        ]
        for column, card in enumerate(self.eval_cards):
            card.grid(
                row=0,
                column=column,
                sticky="nsew",
                padx=(0 if column == 0 else 5, 0 if column == 2 else 5),
            )

        table_shadow, table_card = self._card(page)
        table_shadow.pack(fill="both", expand=True, pady=(12, 0))
        table_card.grid_columnconfigure(0, weight=1)
        table_card.grid_rowconfigure(1, weight=1)
        table_header = tk.Frame(table_card, bg=SURFACE)
        table_header.grid(row=0, column=0, sticky="ew", padx=18, pady=(13, 8))
        tk.Label(
            table_header,
            text="Evaluation summary",
            bg=SURFACE,
            fg=NAVY,
            font=("Segoe UI", 11, "bold"),
        ).pack(side="left")
        tk.Label(
            table_header,
            text="METRIC DEFINITIONS & RESULTS",
            bg=SOFT_PURPLE,
            fg="#7254C7",
            font=("Segoe UI", 7, "bold"),
            padx=9,
            pady=4,
        ).pack(side="right")

        table_box = tk.Frame(table_card, bg=SURFACE)
        table_box.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 16))
        table_box.grid_columnconfigure(0, weight=1)
        table_box.grid_rowconfigure(0, weight=1)
        self.ev_table = ttk.Treeview(
            table_box,
            columns=("metric", "value", "meaning"),
            show="headings",
            height=6,
        )
        self.ev_table.heading("metric", text="METRIK")
        self.ev_table.heading("value", text="NILAI")
        self.ev_table.heading("meaning", text="INTERPRETASI")
        self.ev_table.column("metric", width=260)
        self.ev_table.column("value", width=140, anchor="center")
        self.ev_table.column("meaning", width=650)
        self.ev_table.grid(row=0, column=0, sticky="nsew")
        eval_scroll = ttk.Scrollbar(table_box, orient="vertical", command=self.ev_table.yview)
        eval_scroll.grid(row=0, column=1, sticky="ns")
        self.ev_table.configure(yscrollcommand=eval_scroll.set)
        self.ev_table.tag_configure("even", background="#FAFBFE")

    def _empty_eval_chart(self, card, title, detail):
        card.figure.clear()
        axis = card.figure.add_subplot(111)
        axis.axis("off")
        axis.text(
            0.5,
            0.58,
            title,
            ha="center",
            va="center",
            color=NAVY,
            fontsize=10,
            fontweight="bold",
        )
        axis.text(
            0.5,
            0.4,
            detail,
            ha="center",
            va="center",
            color=TEXT_SECONDARY,
            fontsize=8,
        )
        card.canvas.draw_idle()

    def draw_eval(self):
        k_file = EVAL_DIR / "k_selection.csv"
        summary_file = EVAL_DIR / "ringkasan_evaluasi.csv"
        chosen_k = len(self.engine.clusters) if self.engine is not None else None
        self._clear_tree(self.ev_table)

        for card in self.eval_cards:
            card.figure.clear()

        if not k_file.exists() and not summary_file.exists():
            for card in self.eval_cards:
                self._empty_eval_chart(card, "Belum ada hasil", "Jalankan python 08_evaluasi.py")
            self.eval_note.set("Hasil dibuat oleh 08_evaluasi.py")
            return

        if k_file.exists():
            selection = pd.read_csv(k_file)
            for row_index, (_, row) in enumerate(selection.iterrows()):
                self.ev_table.insert(
                    "",
                    "end",
                    tags=("even",) if row_index % 2 else (),
                    values=(
                        f"k={int(row['k'])} · Silhouette / DBI",
                        f"{row['silhouette']:.4f} / {row['davies_bouldin']:.4f}",
                        "Silhouette lebih tinggi dan Davies-Bouldin lebih rendah menandakan cluster lebih baik.",
                    ),
                )

            for card_index, (column, color) in enumerate(
                [("silhouette", PRIMARY), ("davies_bouldin", LAVENDER)]
            ):
                card = self.eval_cards[card_index]
                axis = card.figure.add_subplot(111)
                axis.plot(
                    selection["k"],
                    selection[column],
                    color=color,
                    linewidth=2.2,
                    marker="o",
                    markersize=5,
                    markerfacecolor=SURFACE,
                    markeredgewidth=1.5,
                )
                if chosen_k in set(selection["k"]):
                    row = selection[selection["k"] == chosen_k].iloc[0]
                    axis.scatter(
                        [chosen_k],
                        [row[column]],
                        s=80,
                        color=PRIMARY_DARK,
                        edgecolor=SURFACE,
                        linewidth=2,
                        zorder=5,
                    )
                    axis.annotate(
                        f"k={chosen_k}",
                        (chosen_k, row[column]),
                        textcoords="offset points",
                        xytext=(7, 8),
                        fontsize=8,
                        color=PRIMARY_DARK,
                        fontweight="bold",
                    )
                axis.set_xticks(selection["k"])
                axis.set_xlabel("Jumlah cluster (k)", fontsize=8)
                configure_axes(axis)
                card.canvas.draw_idle()
        else:
            self._empty_eval_chart(
                self.eval_cards[0],
                "Pemilihan k belum tersedia",
                "Jalankan 08_evaluasi.py --hanya-k",
            )
            self._empty_eval_chart(
                self.eval_cards[1],
                "Pemilihan k belum tersedia",
                "Jalankan 08_evaluasi.py --hanya-k",
            )

        # Preserve support for image outputs produced by the existing evaluation script.
        k_png = EVAL_DIR / "k_selection.png"
        if k_png.exists():
            card = self.eval_cards[0]
            card.figure.clear()
            axis = card.figure.add_subplot(111)
            axis.imshow(imread(k_png))
            axis.axis("off")
            card.canvas.draw_idle()

        if summary_file.exists():
            summary = pd.read_csv(summary_file, encoding="utf-8-sig")
            values = dict(zip(summary["metrik"], summary["nilai"]))
            time_all = values.get("waktu_rata2_semua_ms")
            time_cluster = values.get("waktu_rata2_cluster_ms")
            card = self.eval_cards[2]
            if time_all is not None and time_cluster is not None:
                axis = card.figure.add_subplot(111)
                bars = axis.bar(
                    ["Semua lagu", "Satu cluster"],
                    [float(time_all), float(time_cluster)],
                    color=[LAVENDER, PRIMARY],
                    width=0.52,
                )
                for bar, value in zip(bars, [float(time_all), float(time_cluster)]):
                    axis.text(
                        bar.get_x() + bar.get_width() / 2,
                        value,
                        f"{value:.1f} ms",
                        ha="center",
                        va="bottom",
                        fontsize=8,
                        color=NAVY,
                        fontweight="bold",
                    )
                axis.set_ylabel("Milidetik", fontsize=8)
                configure_axes(axis)
                card.canvas.draw_idle()
            else:
                self._empty_eval_chart(card, "Waktu belum tersedia", "Lengkapi ringkasan_evaluasi.csv")

            start_index = len(self.ev_table.get_children())
            for offset, (_, row) in enumerate(summary.iterrows()):
                value = row["nilai"]
                try:
                    number = float(value)
                    value = int(number) if number.is_integer() else value
                except (TypeError, ValueError):
                    pass
                self.ev_table.insert(
                    "",
                    "end",
                    tags=("even",) if (start_index + offset) % 2 else (),
                    values=(row["metrik"], value, row.get("keterangan", "")),
                )
        else:
            self._empty_eval_chart(
                self.eval_cards[2],
                "Performa belum tersedia",
                "Lengkapi ringkasan_evaluasi.csv",
            )

        comparison_png = EVAL_DIR / "perbandingan.png"
        if comparison_png.exists():
            card = self.eval_cards[2]
            card.figure.clear()
            axis = card.figure.add_subplot(111)
            axis.imshow(imread(comparison_png))
            axis.axis("off")
            card.canvas.draw_idle()

        definitions = [
            (
                "waktu_rata2_semua_ms",
                "Waktu pencarian rata-rata dengan membandingkan seluruh lagu.",
            ),
            (
                "waktu_rata2_cluster_ms",
                "Waktu pencarian rata-rata dengan membandingkan satu cluster.",
            ),
            (
                "percepatan_kali",
                "Rasio waktu pencarian semua lagu terhadap pencarian satu cluster.",
            ),
            (
                "recall_top10_persen",
                "Persentase top-10 pencarian penuh yang juga muncul pada pencarian cluster.",
            ),
        ]
        existing = {
            self.ev_table.item(item, "values")[0] for item in self.ev_table.get_children()
        }
        for metric, explanation in definitions:
            if metric not in existing:
                self.ev_table.insert("", "end", values=(metric, "—", explanation))

        self.eval_note.set(
            f"Sumber: {EVAL_DIR.name}/  ·  Penanda biru tua menunjukkan k yang digunakan aplikasi"
        )

    def show_eval_detail(self):
        path = EVAL_DIR / "detail_query.csv"
        if not path.exists():
            messagebox.showinfo(
                "Detail query",
                "File detail_query.csv belum tersedia di hasil_evaluasi.",
            )
            return
        try:
            detail = pd.read_csv(path, encoding="utf-8-sig").fillna("")
        except Exception as error:
            messagebox.showerror(
                "Detail query",
                f"Gagal membaca detail_query.csv:\n{error}",
            )
            return

        window = tk.Toplevel(self.root)
        window.title("Detail Evaluasi Query")
        window.geometry("1100x600")
        window.minsize(800, 440)
        window.configure(bg=BG)
        window.transient(self.root)

        header = tk.Frame(window, bg=PRIMARY_DARK)
        header.pack(fill="x")
        tk.Label(
            header,
            text="Detail Evaluasi Query",
            bg=PRIMARY_DARK,
            fg="white",
            font=("Segoe UI", 16, "bold"),
        ).pack(anchor="w", padx=22, pady=(16, 2))
        tk.Label(
            header,
            text="Data pengujian individual dari detail_query.csv",
            bg=PRIMARY_DARK,
            fg="#DCE5FF",
            font=("Segoe UI", 9),
        ).pack(anchor="w", padx=22, pady=(0, 16))

        shadow, card = self._card(window)
        shadow.pack(fill="both", expand=True, padx=20, pady=20)
        frame = tk.Frame(card, bg=SURFACE)
        frame.pack(fill="both", expand=True, padx=16, pady=16)
        frame.grid_rowconfigure(0, weight=1)
        frame.grid_columnconfigure(0, weight=1)
        columns = list(detail.columns)
        tree = ttk.Treeview(frame, columns=columns, show="headings")
        for column in columns:
            tree.heading(column, text=column.upper())
            tree.column(column, width=140, minwidth=90, stretch=True)
        yscroll = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        xscroll = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        tree.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        for row_index, row in enumerate(detail.itertuples(index=False, name=None)):
            tree.insert(
                "",
                "end",
                values=tuple(row),
                tags=("even",) if row_index % 2 else (),
            )
        tree.tag_configure("even", background="#FAFBFE")

    # ------------------------------------------------------------- async events
    @staticmethod
    def _clear_tree(tree):
        children = tree.get_children()
        if children:
            tree.delete(*children)

    def load_worker(self):
        try:
            df, file_count = read_clustered()
            engine = Engine(df)
            years = read_years()
            self.events.put(("loaded", (engine, years, file_count)))
        except Exception as error:
            self.events.put(("load_error", str(error)))

    def process_events(self):
        try:
            while True:
                event, payload = self.events.get_nowait()
                if event == "loaded":
                    self.data_loaded(*payload)
                elif event == "load_error":
                    self.data_error(payload)
                elif event == "recommend":
                    self._recommend_busy = False
                    self.recommend_button.configure_state(
                        enabled=True,
                        text="Cari Rekomendasi",
                    )
                    self.show_recommendations(payload)
                elif event == "recommend_error":
                    self._recommend_busy = False
                    self.recommend_button.configure_state(
                        enabled=True,
                        text="Cari Rekomendasi",
                    )
                    messagebox.showerror("Rekomendasi gagal", payload)
        except queue.Empty:
            pass
        self.root.after(100, self.process_events)

    def data_error(self, message):
        self.status.set("Gagal memuat data")
        self.status_dot.delete("all")
        self.status_dot.create_oval(5, 5, 13, 13, fill="#E66A6A", outline="")
        messagebox.showerror("Kesalahan data", message)

    def data_loaded(self, engine, years, file_count):
        self.engine = engine
        self.years = years
        self.status.set(
            f"Data ready  ·  {format_number(len(engine.df))} lagu  ·  {file_count} file"
        )
        self.status_dot.delete("all")
        self.status_dot.create_oval(5, 5, 13, 13, fill=SUCCESS, outline="")
        self.draw_dashboard()
        self.draw_clusters()
        self.draw_eval()


def main():
    root = tk.Tk()
    SpotifyApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
