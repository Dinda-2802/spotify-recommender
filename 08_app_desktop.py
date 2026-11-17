
import ast
import threading
import time
import queue
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk
 
import numpy as np
import pandas as pd
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.figure import Figure
from matplotlib.image import imread
 
# ==================================================
# 1. PENGATURAN
# ==================================================
 
PROJECT_DIR = Path(__file__).resolve().parent
CLUSTER_DIR = PROJECT_DIR / "hasil_clustering" / "lagu_dengan_cluster"
CLEAN_FILE = PROJECT_DIR / "data_clean" / "tracks_clean.csv"
EVAL_DIR = PROJECT_DIR / "hasil_evaluasi"
 
FEATURES = [
    "danceability", "energy", "loudness", "speechiness",
    "acousticness", "instrumentalness", "liveness", "valence", "tempo",
]
 
# Warna (satu warna utama + diverging biru-abu-oranye untuk heatmap)
BG = "#f4f5f7"
SURFACE = "#ffffff"
HEADER = "#1f2937"
INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e3e2de"
BLUE = "#2a78d6"
ORANGE = "#eb6834"
DIVERGING = LinearSegmentedColormap.from_list("div", [BLUE, "#f2f1ee", ORANGE])
 
 
# ==================================================
# 2. MEMUAT DATA DAN MESIN PENCARIAN
# ==================================================
 
def read_clustered():
    """Baca SEMUA file part-*.csv hasil file 05 (bukan hanya part-00000)."""
    files = sorted(CLUSTER_DIR.glob("part-*.csv"))
    if not files:
        raise FileNotFoundError(
            f"Hasil clustering tidak ditemukan di:\n{CLUSTER_DIR}\n\n"
            "Jalankan 05_clustering_kmeans.py terlebih dahulu."
        )
    df = pd.concat(
        [pd.read_csv(f, encoding="utf-8-sig", low_memory=False) for f in files],
        ignore_index=True,
    )
    need = ["name", "artists", "cluster"] + FEATURES
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise ValueError("Kolom tidak ditemukan: " + ", ".join(missing))
 
    for c in FEATURES:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["cluster"] = pd.to_numeric(df["cluster"], errors="coerce")
    df["name"] = df["name"].fillna("(tanpa judul)").astype(str)
    df["artists"] = df["artists"].fillna("(tanpa artis)").astype(str)
    df = df.dropna(subset=FEATURES + ["cluster"]).reset_index(drop=True)
    df["cluster"] = df["cluster"].astype(int)
    return df, len(files)
 
 
def read_years():
    """Ambil kolom year dari data bersih (untuk grafik per dekade). None jika tidak ada."""
    try:
        if not CLEAN_FILE.exists():
            return None
        header = list(pd.read_csv(CLEAN_FILE, nrows=0).columns)
        if "year" not in header:
            return None
        year = pd.to_numeric(
            pd.read_csv(CLEAN_FILE, usecols=["year"])["year"], errors="coerce"
        ).dropna()
        return year[year > 0].astype(int)
    except Exception:
        return None
 
 
def fmt_artists(text):
    """"['A', 'B']" -> "A, B"."""
    try:
        value = ast.literal_eval(text)
        if isinstance(value, (list, tuple)):
            return ", ".join(str(v) for v in value)
    except Exception:
        pass
    return text
 
 
def describe_cluster(zrow):
    """Ringkas ciri sebuah cluster dari rata-rata fitur terstandar."""
    order = np.argsort(-np.abs(zrow))[:2]
    parts = []
    for i in order:
        if zrow[i] >= 0.4:
            parts.append(f"{FEATURES[i]} tinggi")
        elif zrow[i] <= -0.4:
            parts.append(f"{FEATURES[i]} rendah")
    return ", ".join(parts) if parts else "mendekati rata-rata"
 
 
class Engine:
    """Menyimpan matriks fitur dan melakukan pencarian lagu mirip."""
 
    def __init__(self, df):
        self.df = df
        X = df[FEATURES].to_numpy(np.float32)
        mean, std = X.mean(axis=0), X.std(axis=0)
        std[std == 0] = 1
        self.Z = (X - mean) / std                      # fitur terstandar
        norm = np.linalg.norm(self.Z, axis=1, keepdims=True)
        norm[norm == 0] = 1
        self.U = (self.Z / norm).astype(np.float32)    # vektor panjang 1 -> cosine = U @ q
 
        self.cl = df["cluster"].to_numpy()
        self.codes, _ = pd.factorize(df["name"] + "|" + df["artists"])  # lagu yang sama
        self.clusters = np.unique(self.cl)
        self.idx_c = {c: np.flatnonzero(self.cl == c) for c in self.clusters}
        self.U_c = {c: self.U[self.idx_c[c]] for c in self.clusters}
        self.codes_c = {c: self.codes[self.idx_c[c]] for c in self.clusters}
 
        self.counts = np.array([len(self.idx_c[c]) for c in self.clusters])
        self.mean_z = np.vstack([self.Z[self.idx_c[c]].mean(axis=0) for c in self.clusters])
        self.search_text = (df["name"] + " " + df["artists"]).str.lower()
 
    @staticmethod
    def _top(sims, n):
        n = min(n, len(sims) - 1)
        if n <= 0:
            return np.array([], dtype=int)
        part = np.argpartition(-sims, n - 1)[:n]
        order = part[np.argsort(-sims[part])]
        return order[np.isfinite(sims[order])]
 
    def search_all(self, qi, n):
        t0 = time.perf_counter()
        s = self.U @ self.U[qi]
        s[self.codes == self.codes[qi]] = -np.inf
        top = self._top(s, n)
        return top, s[top], (time.perf_counter() - t0) * 1000
 
    def search_cluster(self, qi, n):
        c = self.cl[qi]
        t0 = time.perf_counter()
        s = self.U_c[c] @ self.U[qi]
        s[self.codes_c[c] == self.codes[qi]] = -np.inf
        top = self._top(s, n)
        return self.idx_c[c][top], s[top], (time.perf_counter() - t0) * 1000
 
 
# ==================================================
# 3. APLIKASI
# ==================================================
 
def style_axes(ax, title, grid="y"):
    ax.set_title(title, loc="left", fontsize=10, color=INK, fontweight="bold")
    if grid:
        ax.grid(axis=grid, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID)
    ax.tick_params(colors=INK_2, labelsize=8)
    ax.xaxis.label.set_color(INK_2)
    ax.yaxis.label.set_color(INK_2)
 
 
class SpotifyApp:
    def __init__(self, root):
        self.root = root
        self.engine = None
        self.years = None
        self.match_idx = []
        self._after_id = None
        self.events = queue.Queue()
        self._recommend_busy = False
        self.status = tk.StringVar(value="Sedang memuat data lagu... (beberapa detik)")
 
        root.title("Spotify Recommender - Big Data Spark")
        root.geometry("1200x780")
        root.minsize(980, 640)
        root.configure(bg=BG)
        self._style()
 
        header = tk.Frame(root, bg=HEADER)
        header.pack(fill="x")
        tk.Label(
            header, text="Spotify Recommender", bg=HEADER, fg="white",
            font=("Segoe UI", 18, "bold"),
        ).pack(anchor="w", padx=18, pady=(12, 0))
        tk.Label(
            header,
            text="Analisis 1,2 juta lagu Spotify: clustering K-Means (Apache Spark) "
                 "dan rekomendasi berbasis kemiripan audio",
            bg=HEADER, fg="#cbd5e1", font=("Segoe UI", 10),
        ).pack(anchor="w", padx=18, pady=(0, 12))
 
        bottom = tk.Frame(root, bg=BG)
        bottom.pack(side="bottom", fill="x")
        ttk.Label(bottom, textvariable=self.status, style="Status.TLabel").pack(
            side="left", padx=14, pady=6
        )
        self.progress = ttk.Progressbar(bottom, mode="indeterminate", length=140)
        self.progress.pack(side="right", padx=14)
        self.progress.start(12)
 
        self.tabs = ttk.Notebook(root)
        self.tabs.pack(fill="both", expand=True, padx=12, pady=(10, 4))
 
        self.dash_tab = ttk.Frame(self.tabs, padding=10)
        self.cluster_tab = ttk.Frame(self.tabs, padding=10)
        self.rec_tab = ttk.Frame(self.tabs, padding=12)
        self.eval_tab = ttk.Frame(self.tabs, padding=10)
        self.tabs.add(self.dash_tab, text="  Dashboard  ")
        self.tabs.add(self.cluster_tab, text="  Cluster  ")
        self.tabs.add(self.rec_tab, text="  Rekomendasi  ")
        self.tabs.add(self.eval_tab, text="  Evaluasi  ")
 
        self.build_dashboard()
        self.build_cluster()
        self.build_recommend()
        self.build_eval()
 
        threading.Thread(target=self.load_worker, daemon=True).start()
        self.root.after(100, self.process_events)
 
    # ---------- tampilan dasar ----------
    def _style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        base = ("Segoe UI", 10)
        style.configure(".", font=base, background=BG)
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=INK)
        style.configure("Status.TLabel", background=BG, foreground=INK_2)
        style.configure("Hint.TLabel", background=BG, foreground=INK_2)
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", padding=(14, 7), font=("Segoe UI", 10, "bold"),
                        background="#e5e7eb", foreground=INK_2)
        style.map("TNotebook.Tab", background=[("selected", SURFACE)],
                  foreground=[("selected", BLUE)])
        style.configure("TRadiobutton", background=BG)
        style.configure("Accent.TButton", font=("Segoe UI", 10, "bold"),
                        background=BLUE, foreground="white", padding=(14, 6))
        style.map("Accent.TButton", background=[("active", "#1f63b5"), ("disabled", "#9db9dd")])
        style.configure("Treeview", rowheight=26, background=SURFACE,
                        fieldbackground=SURFACE, foreground=INK, borderwidth=0)
        style.configure("Treeview.Heading", font=("Segoe UI", 10, "bold"),
                        background="#e5e7eb", foreground=INK, padding=6)
        style.map("Treeview", background=[("selected", "#cfe0f5")],
                  foreground=[("selected", INK)])
 
    def make_canvas(self, parent, figsize):
        fig = Figure(figsize=figsize, dpi=100, facecolor=SURFACE, layout="constrained")
        canvas = FigureCanvasTkAgg(fig, master=parent)
        canvas.get_tk_widget().configure(highlightthickness=1, highlightbackground=GRID)
        return fig, canvas
 
    def kpi_card(self, parent, column, name):
        card = tk.Frame(parent, bg=SURFACE, highlightthickness=1, highlightbackground=GRID)
        card.grid(row=0, column=column, sticky="ew", padx=5, pady=(0, 8))
        value = tk.StringVar(value="...")
        tk.Label(card, textvariable=value, bg=SURFACE, fg=INK,
                 font=("Segoe UI", 20, "bold")).pack(anchor="w", padx=14, pady=(10, 0))
        tk.Label(card, text=name, bg=SURFACE, fg=INK_2,
                 font=("Segoe UI", 9)).pack(anchor="w", padx=14, pady=(0, 10))
        return value
 
    # ---------- tab 1: dashboard ----------
    def build_dashboard(self):
        tab = self.dash_tab
        tab.columnconfigure(0, weight=1)
        tab.rowconfigure(1, weight=1)
 
        kpis = ttk.Frame(tab)
        kpis.grid(row=0, column=0, sticky="ew")
        for i in range(4):
            kpis.columnconfigure(i, weight=1)
        self.kpi_songs = self.kpi_card(kpis, 0, "Jumlah lagu dianalisis")
        self.kpi_artists = self.kpi_card(kpis, 1, "Jumlah artis (unik)")
        self.kpi_clusters = self.kpi_card(kpis, 2, "Jumlah cluster (k)")
        self.kpi_years = self.kpi_card(kpis, 3, "Rentang tahun rilis")
 
        self.dash_fig, self.dash_canvas = self.make_canvas(tab, (9, 5.6))
        self.dash_canvas.get_tk_widget().grid(row=1, column=0, sticky="nsew", padx=5)
 
    def draw_dashboard(self):
        e = self.engine
        df = e.df
        self.kpi_songs.set(f"{len(df):,}".replace(",", "."))
        self.kpi_artists.set(f"{df['artists'].nunique():,}".replace(",", "."))
        self.kpi_clusters.set(str(len(e.clusters)))
        if self.years is not None and len(self.years):
            self.kpi_years.set(f"{int(self.years.min())} - {int(self.years.max())}")
        else:
            self.kpi_years.set("-")
 
        fig = self.dash_fig
        fig.clear()
        gs = fig.add_gridspec(2, 3, height_ratios=[1.1, 1])
 
        ax = fig.add_subplot(gs[0, :])
        if self.years is not None and len(self.years):
            decade = (self.years // 10 * 10).clip(lower=1940)
            counts = decade.value_counts().sort_index()
            labels = [("≤1940" if d == 1940 else f"{d}an") for d in counts.index]
            bars = ax.bar(labels, counts.values, color=BLUE, width=0.62)
            top = int(np.argmax(counts.values))
            ax.text(top, counts.values[top], f"{counts.values[top]:,}".replace(",", "."),
                    ha="center", va="bottom", fontsize=8, color=INK)
            ax.ticklabel_format(axis="y", style="plain")
            ax.set_ylabel("jumlah lagu")
            style_axes(ax, "Jumlah lagu per dekade rilis")
        else:
            ax.axis("off")
            ax.text(0.5, 0.5, "Kolom 'year' tidak ditemukan di data_clean/tracks_clean.csv",
                    ha="center", va="center", color=INK_2)
 
        for i, feat in enumerate(["energy", "danceability", "valence"]):
            a = fig.add_subplot(gs[1, i])
            a.hist(df[feat].to_numpy(), bins=40, color=BLUE, edgecolor=SURFACE, linewidth=0.5)
            a.ticklabel_format(axis="y", style="plain")
            a.set_xlabel(feat)
            style_axes(a, f"Sebaran {feat}")
        self.dash_canvas.draw_idle()
 
    # ---------- tab 2: cluster ----------
    def build_cluster(self):
        tab = self.cluster_tab
        tab.columnconfigure(0, weight=1)
        tab.rowconfigure(0, weight=1)
        tab.rowconfigure(1, weight=1)
 
        self.cl_fig, self.cl_canvas = self.make_canvas(tab, (9, 3.4))
        self.cl_canvas.get_tk_widget().grid(row=0, column=0, sticky="nsew", padx=5)
 
        low = ttk.Frame(tab)
        low.grid(row=1, column=0, sticky="nsew", padx=5, pady=(8, 0))
        low.columnconfigure(0, weight=1)
        low.rowconfigure(2, weight=1)
 
        top = ttk.Frame(low)
        top.grid(row=0, column=0, sticky="ew")
        ttk.Label(top, text="Lihat contoh lagu dari cluster:").pack(side="left")
        self.cluster_pick = tk.StringVar()
        self.cluster_combo = ttk.Combobox(top, textvariable=self.cluster_pick,
                                          state="readonly", width=8)
        self.cluster_combo.pack(side="left", padx=8)
        self.cluster_combo.bind("<<ComboboxSelected>>", self.show_cluster_samples)
        ttk.Button(top, text="Acak ulang", command=self.show_cluster_samples).pack(side="left")
 
        self.cluster_desc = tk.StringVar(value="")
        ttk.Label(low, textvariable=self.cluster_desc, style="Hint.TLabel").grid(
            row=1, column=0, sticky="w", pady=(4, 4))
 
        self.samples = ttk.Treeview(low, columns=("title", "artist"), show="headings", height=6)
        self.samples.heading("title", text="Judul lagu")
        self.samples.heading("artist", text="Artis")
        self.samples.column("title", width=420)
        self.samples.column("artist", width=300)
        self.samples.grid(row=2, column=0, sticky="nsew")
        sb_s = ttk.Scrollbar(low, orient="vertical", command=self.samples.yview)
        self.samples.configure(yscrollcommand=sb_s.set)
        sb_s.grid(row=2, column=1, sticky="ns")
 
    def draw_clusters(self):
        e = self.engine
        fig = self.cl_fig
        fig.clear()
        gs = fig.add_gridspec(1, 2, width_ratios=[1, 2.6])
        ax1 = fig.add_subplot(gs[0, 0])
        ax2 = fig.add_subplot(gs[0, 1])
 
        ys = np.arange(len(e.clusters))
        ax1.barh(ys, e.counts, color=BLUE, height=0.62)
        ax1.set_yticks(ys)
        ax1.set_yticklabels([f"Cluster {c}" for c in e.clusters])
        ax1.invert_yaxis()
        ax1.ticklabel_format(axis="x", style="plain")
        ax1.tick_params(axis="x", labelrotation=30)
        ax1.set_xlabel("jumlah lagu")
        style_axes(ax1, "Jumlah lagu per cluster", grid="x")
 
        lim = float(min(2.0, max(0.5, np.abs(e.mean_z).max())))
        im = ax2.imshow(e.mean_z, cmap=DIVERGING, vmin=-lim, vmax=lim, aspect="auto")
        ax2.set_xticks(range(len(FEATURES)))
        ax2.set_xticklabels(FEATURES, rotation=30, ha="right")
        ax2.set_yticks(ys)
        ax2.set_yticklabels([f"Cluster {c}" for c in e.clusters])
        for r in range(e.mean_z.shape[0]):
            for c in range(e.mean_z.shape[1]):
                v = e.mean_z[r, c]
                ax2.text(c, r, f"{v:.1f}", ha="center", va="center", fontsize=8,
                         color="white" if abs(v) > 0.65 * lim else INK)
        for side in ax2.spines.values():
            side.set_visible(False)
        ax2.tick_params(colors=INK_2, labelsize=8, length=0)
        ax2.set_title("Profil audio tiap cluster (di atas / di bawah rata-rata semua lagu)",
                      loc="left", fontsize=10, color=INK, fontweight="bold")
        cbar = fig.colorbar(im, ax=ax2, fraction=0.035, pad=0.02)
        cbar.ax.tick_params(labelsize=8, colors=INK_2)
        cbar.outline.set_visible(False)
 
        self.cl_canvas.draw_idle()
        self.cluster_combo.configure(values=[str(c) for c in e.clusters])
        self.cluster_combo.current(0)
        self.show_cluster_samples()
 
    def show_cluster_samples(self, event=None):
        e = self.engine
        if e is None or not self.cluster_pick.get():
            return
        c = int(self.cluster_pick.get())
        pos = int(np.where(e.clusters == c)[0][0])
        self.cluster_desc.set(f"Ciri utama cluster {c}: {describe_cluster(e.mean_z[pos])}")
        for item in self.samples.get_children():
            self.samples.delete(item)
        pick = np.random.choice(e.idx_c[c], size=min(30, len(e.idx_c[c])), replace=False)
        for i in pick:
            self.samples.insert("", "end", values=(e.df["name"].iat[i], fmt_artists(e.df["artists"].iat[i])))
 
    # ---------- tab 3: rekomendasi ----------
    def build_recommend(self):
        tab = self.rec_tab
        tab.columnconfigure(0, weight=1)
        tab.rowconfigure(4, weight=1)
 
        ttk.Label(tab, text="1. Cari judul lagu atau nama artis:",
                  font=("Segoe UI", 10, "bold")).grid(row=0, column=0, sticky="w")
        self.query = tk.StringVar()
        entry = ttk.Entry(tab, textvariable=self.query, font=("Segoe UI", 11))
        entry.grid(row=1, column=0, sticky="ew", pady=(4, 6))
        entry.bind("<KeyRelease>", self.on_type)
 
        box = ttk.Frame(tab)
        box.grid(row=2, column=0, sticky="ew")
        box.columnconfigure(0, weight=1)
        self.matches = tk.Listbox(box, height=6, exportselection=False, font=("Segoe UI", 10),
                                  activestyle="none", selectbackground="#cfe0f5",
                                  selectforeground=INK, highlightthickness=1,
                                  highlightbackground=GRID, relief="flat")
        self.matches.grid(row=0, column=0, sticky="ew")
        sb = ttk.Scrollbar(box, orient="vertical", command=self.matches.yview)
        sb.grid(row=0, column=1, sticky="ns")
        self.matches.configure(yscrollcommand=sb.set)
        self.matches.bind("<<ListboxSelect>>", self.on_select)
        self.matches.bind("<Double-Button-1>", lambda e: self.recommend())
 
        ctl = ttk.Frame(tab)
        ctl.grid(row=3, column=0, sticky="ew", pady=10)
        ttk.Label(ctl, text="2. Jumlah rekomendasi:").pack(side="left")
        self.amount = tk.StringVar(value="10")
        ttk.Combobox(ctl, textvariable=self.amount, values=["5", "10", "15", "20"],
                     state="readonly", width=4).pack(side="left", padx=(6, 18))
        self.mode = tk.StringVar(value="cluster")
        ttk.Radiobutton(ctl, text="Filter cluster (cepat)", value="cluster",
                        variable=self.mode).pack(side="left", padx=4)
        ttk.Radiobutton(ctl, text="Cari di semua lagu", value="all",
                        variable=self.mode).pack(side="left", padx=4)
        self.btn = ttk.Button(ctl, text="3. Cari Rekomendasi", style="Accent.TButton",
                              command=self.recommend, state="disabled")
        self.btn.pack(side="left", padx=18)
 
        frame = ttk.Frame(tab)
        frame.grid(row=4, column=0, sticky="nsew")
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(0, weight=1)
        cols = ("no", "title", "artist", "cluster", "score")
        self.results = ttk.Treeview(frame, columns=cols, show="headings")
        for col, label, width, anchor in [
            ("no", "#", 40, "center"), ("title", "Judul lagu", 380, "w"),
            ("artist", "Artis", 260, "w"), ("cluster", "Cluster", 80, "center"),
            ("score", "Kemiripan (kosinus)", 150, "center"),
        ]:
            self.results.heading(col, text=label)
            self.results.column(col, width=width, anchor=anchor)
        self.results.tag_configure("odd", background="#f7f8fa")
        scroll = ttk.Scrollbar(frame, orient="vertical", command=self.results.yview)
        self.results.configure(yscrollcommand=scroll.set)
        self.results.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")
 
        self.info = tk.StringVar(value="")
        ttk.Label(tab, textvariable=self.info, style="Hint.TLabel", wraplength=1100).grid(
            row=5, column=0, sticky="w", pady=(8, 0))
 
    def on_type(self, event=None):
        if self._after_id:
            self.root.after_cancel(self._after_id)
        self._after_id = self.root.after(300, self.search_songs)   # tunggu berhenti mengetik
 
    def search_songs(self):
        self.matches.delete(0, tk.END)
        self.match_idx = []
        self.btn.configure(state="disabled")
        if self.engine is None:
            return
        q = self.query.get().strip().lower()
        if len(q) < 2:
            self.info.set("Ketik minimal 2 karakter untuk mencari judul atau artis.")
            return
        mask = self.engine.search_text.str.contains(q, regex=False, na=False).to_numpy()
        found = np.flatnonzero(mask)[:100]
        df = self.engine.df
        for i in found:
            self.match_idx.append(int(i))
            self.matches.insert(
                tk.END,
                f"{df['name'].iat[i]}  —  {fmt_artists(df['artists'].iat[i])}   (cluster {df['cluster'].iat[i]})",
            )
        if not len(found):
            self.matches.insert(tk.END, "Tidak ada lagu yang cocok.")
            self.info.set("Lagu tidak ditemukan. Coba kata kunci judul atau artis lain.")
        else:
            self.info.set(f"{len(found)} lagu cocok. Pilih satu lagu untuk melihat rekomendasi.")
 
    def on_select(self, event=None):
        if self.matches.curselection() and self.match_idx:
            self.btn.configure(state="normal")
 
    def recommend(self):
        sel = self.matches.curselection()
        if self.engine is None or not sel or not self.match_idx:
            messagebox.showinfo("Pilih lagu", "Cari judul atau artis, lalu pilih satu lagu dari daftar.")
            return
        qi = self.match_idx[sel[0]]
        n = int(self.amount.get())
        e = self.engine
 
        if self._recommend_busy:
            return
        self._recommend_busy = True
        self.btn.configure(state="disabled", text="Menghitung...")
        self.info.set("Sedang menghitung kemiripan audio...")
        mode = self.mode.get()

        def worker():
            try:
                top_a, sim_a, t_a = e.search_all(qi, n)
                top_c, sim_c, t_c = e.search_cluster(qi, n)
                self.events.put(("recommend", (qi, mode, top_a, sim_a, t_a, top_c, sim_c, t_c)))
            except Exception as error:
                self.events.put(("recommend_error", str(error)))

        threading.Thread(target=worker, daemon=True).start()

    def show_recommendations(self, data):
        qi, mode, top_a, sim_a, t_a, top_c, sim_c, t_c = data
        e = self.engine
        top, sim = (top_c, sim_c) if mode == "cluster" else (top_a, sim_a)
 
        for item in self.results.get_children():
            self.results.delete(item)
        for rank, (i, s) in enumerate(zip(top, sim), start=1):
            self.results.insert(
                "", "end", tags=("odd",) if rank % 2 == 0 else (),
                values=(rank, e.df["name"].iat[int(i)], fmt_artists(e.df["artists"].iat[int(i)]),
                        int(e.cl[int(i)]), f"{float(s):.3f}"),
            )
 
        overlap = len(set(top_a.tolist()) & set(top_c.tolist()))
        share = len(e.idx_c[e.cl[qi]]) / len(e.df) * 100
        self.info.set(
            f"Lagu awal: {e.df['name'].iat[qi]} — {fmt_artists(e.df['artists'].iat[qi])} "
            f"(cluster {e.cl[qi]}).   Waktu pencarian: filter cluster {t_c:.1f} ms "
            f"(memeriksa {share:.0f}% lagu) vs semua lagu {t_a:.1f} ms.   "
            f"{overlap} dari {len(top_a)} rekomendasi terbaik tetap sama."
        )
 
    # ---------- tab 4: evaluasi ----------
    def build_eval(self):
        tab = self.eval_tab
        tab.columnconfigure(0, weight=1)
        tab.rowconfigure(1, weight=1)
        tab.rowconfigure(2, weight=1)
 
        top = ttk.Frame(tab)
        top.grid(row=0, column=0, sticky="ew", padx=5, pady=(0, 6))
        self.eval_note = tk.StringVar(value="")
        ttk.Label(top, textvariable=self.eval_note, style="Hint.TLabel").pack(side="left")
        ttk.Button(top, text="Lihat detail query", command=self.show_eval_detail).pack(side="right", padx=(6, 0))
        ttk.Button(top, text="Muat ulang hasil", command=self.draw_eval).pack(side="right")
 
        self.ev_fig, self.ev_canvas = self.make_canvas(tab, (9, 2.8))
        self.ev_canvas.get_tk_widget().grid(row=1, column=0, sticky="nsew", padx=5)
 
        self.ev_table = ttk.Treeview(tab, columns=("metrik", "nilai", "ket"), show="headings", height=7)
        sb_e = ttk.Scrollbar(tab, orient="vertical", command=self.ev_table.yview)
        self.ev_table.configure(yscrollcommand=sb_e.set)
        sb_e.grid(row=2, column=1, sticky="ns", pady=(8, 0))
        self.ev_table.heading("metrik", text="Metrik")
        self.ev_table.heading("nilai", text="Nilai")
        self.ev_table.heading("ket", text="Arti")
        self.ev_table.column("metrik", width=230)
        self.ev_table.column("nilai", width=100, anchor="center")
        self.ev_table.column("ket", width=620)
        self.ev_table.grid(row=2, column=0, sticky="nsew", padx=5, pady=(8, 0))
 
    def draw_eval(self):
        fig = self.ev_fig
        fig.clear()
        k_file = EVAL_DIR / "k_selection.csv"
        r_file = EVAL_DIR / "ringkasan_evaluasi.csv"
        chosen_k = len(self.engine.clusters) if self.engine is not None else None
 
        for item in self.ev_table.get_children():
            self.ev_table.delete(item)
 
        if not k_file.exists() and not r_file.exists():
            ax = fig.add_subplot(111)
            ax.axis("off")
            ax.text(0.5, 0.5, "Belum ada hasil evaluasi.\nJalankan:  python 08_evaluasi.py",
                    ha="center", va="center", fontsize=12, color=INK_2)
            self.eval_note.set("Hasil evaluasi dibuat oleh 08_evaluasi.py")
            self.ev_canvas.draw_idle()
            return
 
        axes = fig.subplots(1, 3)
        if k_file.exists():
            kt = pd.read_csv(k_file)
            for _, row in kt.iterrows():
                self.ev_table.insert(
                    "", "end",
                    values=(f"k={int(row['k'])} · Silhouette / DBI",
                            f"{row['silhouette']:.4f} / {row['davies_bouldin']:.4f}",
                            "Silhouette makin tinggi makin baik; Davies-Bouldin Index makin rendah makin baik."),
                )
            for ax, col, title in [
                (axes[0], "silhouette", "Silhouette (makin tinggi makin baik)"),
                (axes[1], "davies_bouldin", "Davies-Bouldin (makin rendah makin baik)"),
            ]:
                ax.plot(kt["k"], kt[col], color=BLUE, linewidth=2, marker="o", markersize=4)
                if chosen_k in set(kt["k"]):
                    row = kt[kt["k"] == chosen_k].iloc[0]
                    ax.plot([chosen_k], [row[col]], marker="o", markersize=9, color=ORANGE,
                            markeredgecolor=SURFACE, markeredgewidth=2)
                    ax.annotate(f"k = {chosen_k}", (chosen_k, row[col]), textcoords="offset points",
                                xytext=(8, 8), fontsize=8, color=INK)
                ax.set_xticks(kt["k"])
                ax.set_xlabel("jumlah cluster (k)")
                style_axes(ax, title)
        png_k = EVAL_DIR / "k_selection.png"
        if png_k.exists():
            axes[0].clear()
            axes[0].imshow(imread(png_k))
            axes[0].axis("off")
            axes[0].set_title("k_selection.png", loc="left", fontsize=9)
        else:
            for ax in axes[:2]:
                ax.axis("off")
                ax.text(0.5, 0.5, "Pemilihan k belum dijalankan.\nJalankan:\npython 08_evaluasi.py --hanya-k",
                        ha="center", va="center", fontsize=9, color=INK_2, transform=ax.transAxes)
 
        if r_file.exists():
            rt = pd.read_csv(r_file, encoding="utf-8-sig")
            val = dict(zip(rt["metrik"], rt["nilai"]))
            t_all, t_clu = val.get("waktu_rata2_semua_ms"), val.get("waktu_rata2_cluster_ms")
            if t_all is not None and t_clu is not None:
                axes[2].bar(["Semua lagu", "Satu cluster"], [t_all, t_clu], color=[ORANGE, BLUE], width=0.5)
                for x, v in enumerate([t_all, t_clu]):
                    axes[2].text(x, v, f"{float(v):.1f}", ha="center", va="bottom", fontsize=8, color=INK)
                axes[2].set_ylabel("milidetik")
                style_axes(axes[2], "Waktu rata-rata per pencarian")
            for _, row in rt.iterrows():
                nilai = row["nilai"]
                try:
                    f = float(nilai)
                    nilai = int(f) if f.is_integer() else nilai
                except (TypeError, ValueError):
                    pass
                self.ev_table.insert("", "end", values=(row["metrik"], nilai, row.get("keterangan", "")))
        else:
            axes[2].axis("off")
        png_compare = EVAL_DIR / "perbandingan.png"
        if png_compare.exists():
            axes[2].clear()
            axes[2].imshow(imread(png_compare))
            axes[2].axis("off")
            axes[2].set_title("perbandingan.png", loc="left", fontsize=9)

        for metric, explanation in [
            ("waktu_rata2_semua_ms", "Waktu pencarian rata-rata dengan membandingkan seluruh lagu."),
            ("waktu_rata2_cluster_ms", "Waktu pencarian rata-rata dengan membandingkan satu cluster."),
            ("percepatan_kali", "Rasio waktu pencarian semua lagu terhadap pencarian satu cluster."),
            ("recall_top10_persen", "Persentase hasil top-10 pencarian penuh yang juga muncul pada pencarian cluster."),
        ]:
            # Keterangan ini tetap tersedia walau CSV ringkasan lama belum memuat kolom keterangan.
            if not any(self.ev_table.item(item, "values")[0] == metric for item in self.ev_table.get_children()):
                self.ev_table.insert("", "end", values=(metric, "-", explanation))
 
        self.eval_note.set(f"Sumber: {EVAL_DIR.name}/   (titik oranye = k yang dipakai aplikasi)")
        self.ev_canvas.draw_idle()

    def show_eval_detail(self):
        path = EVAL_DIR / "detail_query.csv"
        if not path.exists():
            messagebox.showinfo("Detail query", "File detail_query.csv belum tersedia di hasil_evaluasi.")
            return
        try:
            detail = pd.read_csv(path, encoding="utf-8-sig").fillna("")
        except Exception as error:
            messagebox.showerror("Detail query", f"Gagal membaca detail_query.csv:\n{error}")
            return
        window = tk.Toplevel(self.root)
        window.title("Detail evaluasi query")
        window.geometry("1050x520")
        frame = ttk.Frame(window, padding=10)
        frame.pack(fill="both", expand=True)
        columns = list(detail.columns)
        tree = ttk.Treeview(frame, columns=columns, show="headings")
        for column in columns:
            tree.heading(column, text=column)
            tree.column(column, width=130, minwidth=90, stretch=True)
        yscroll = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        xscroll = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        tree.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)
        for row in detail.itertuples(index=False, name=None):
            tree.insert("", "end", values=tuple(row))
 
    # ---------- memuat data ----------
    def load_worker(self):
        try:
            df, n_files = read_clustered()
            engine = Engine(df)
            years = read_years()
            self.events.put(("loaded", (engine, years, n_files)))
        except Exception as error:
            msg = str(error)
            self.events.put(("load_error", msg))

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
                    self.btn.configure(state="normal", text="3. Cari Rekomendasi")
                    self.show_recommendations(payload)
                elif event == "recommend_error":
                    self._recommend_busy = False
                    self.btn.configure(state="normal", text="3. Cari Rekomendasi")
                    messagebox.showerror("Rekomendasi gagal", payload)
        except queue.Empty:
            pass
        self.root.after(100, self.process_events)
 
    def data_error(self, msg):
        self.progress.stop()
        self.progress.pack_forget()
        self.status.set("Gagal memuat data.")
        messagebox.showerror("Kesalahan data", msg)
 
    def data_loaded(self, engine, years, n_files):
        self.engine = engine
        self.years = years
        self.progress.stop()
        self.progress.pack_forget()
        self.status.set(
            f"Data siap: {len(engine.df):,} lagu dari {n_files} file hasil clustering".replace(",", ".")
        )
        self.draw_dashboard()
        self.draw_clusters()
        self.draw_eval()
 
 
def main():
    root = tk.Tk()
    SpotifyApp(root)
    root.mainloop()
 
 
if __name__ == "__main__":
    main()
 
