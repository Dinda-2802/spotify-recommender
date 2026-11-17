
import os
import sys
import time
import glob
import argparse
import json
 
import numpy as np
import pandas as pd
 
# ==================================================
# 1. PENGATURAN (samakan dengan file 05)
# ==================================================
 
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CLEAN = os.path.join(BASE_DIR, "data_clean", "tracks_clean.csv")
CLUSTER_DIR = os.path.join(BASE_DIR, "hasil_clustering", "lagu_dengan_cluster")
TEST_DIR = os.path.join(BASE_DIR, "hasil_clustering", "hasil_prediksi_testing")
MODEL_JSON = os.path.join(BASE_DIR, "hasil_clustering", "model_kmeans.json")
OUT_DIR = os.path.join(BASE_DIR, "hasil_evaluasi")
TEMP_DIR = os.environ.get("SPARK_TEMP_DIR", r"D:\spark_temp")
 
SEED = 42
 
FITUR_AUDIO = [
    "danceability", "energy", "loudness", "speechiness", "acousticness",
    "instrumentalness", "liveness", "valence", "tempo",
]
FITUR_0_1 = [
    "danceability", "energy", "speechiness", "acousticness",
    "instrumentalness", "liveness", "valence",
]
 
# Bagian A
K_MIN, K_MAX = 2, 12
UKURAN_SAMPEL_SPARK = 150_000   # jumlah lagu yang dipakai untuk memilih k
UKURAN_SAMPEL_DBI = 30_000      # DBI dihitung pada sampel yang lebih kecil
UKURAN_SAMPEL_SILUET = 5_000   # batas sampel untuk silhouette
MAX_ITER_K = 20
 
# Bagian B
JUMLAH_QUERY = 300              # jumlah lagu acak yang dijadikan "lagu awal"
TOP_N = 10                      # banyaknya rekomendasi per lagu
MIN_LAGU_PER_ARTIS = 5          # lagu awal dipilih dari artis yang punya >= 5 lagu
 
# Warna grafik (satu warna utama, tenang)
BIRU = "#2a78d6"
ORANYE = "#eb6834"
TEKS = "#0b0b0b"
TEKS_2 = "#52514e"
GRID = "#e3e2de"
 
 
# ==================================================
# 2. FUNGSI BANTU
# ==================================================
 
def davies_bouldin(X, label, pusat):
    """Davies-Bouldin Index (semakin KECIL semakin baik).
    X: (n, d) titik, label: (n,), pusat: (k, d) pusat cluster."""
    ids = [c for c in range(len(pusat)) if np.any(label == c)]
    if len(ids) < 2:
        return float("nan")
    s = np.array([
        np.linalg.norm(X[label == c] - pusat[c], axis=1).mean() for c in ids
    ])
    p = pusat[ids]
    selisih = p[:, None, :] - p[None, :, :]
    m = np.linalg.norm(selisih, axis=2)
    np.fill_diagonal(m, np.inf)
    rasio = (s[:, None] + s[None, :]) / m
    np.fill_diagonal(rasio, -np.inf)
    return float(rasio.max(axis=1).mean())
 
 
def simpan_png(fig, nama):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, nama)
    fig.savefig(path, dpi=160, bbox_inches="tight", facecolor="white")
    print("  grafik disimpan:", path)
 
 
def gaya_sumbu(ax, judul):
    ax.set_title(judul, loc="left", fontsize=10, color=TEKS, fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for sisi in ("top", "right"):
        ax.spines[sisi].set_visible(False)
    for sisi in ("left", "bottom"):
        ax.spines[sisi].set_color(GRID)
    ax.tick_params(colors=TEKS_2, labelsize=9)
    ax.xaxis.label.set_color(TEKS_2)
    ax.yaxis.label.set_color(TEKS_2)
 
 
# ==================================================
# 3. BAGIAN A - MEMILIH k DENGAN SPARK
# ==================================================
 
def evaluasi_k():
    print("=" * 60)
    print("BAGIAN A - Memilih jumlah cluster (k) dengan Spark")
    print("=" * 60)
 
    if not os.path.isfile(INPUT_CLEAN):
        raise FileNotFoundError(f"Dataset bersih tidak ditemukan: {INPUT_CLEAN}")
 
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.environ["TEMP"] = TEMP_DIR
    os.environ["TMP"] = TEMP_DIR
    os.environ["SPARK_LOCAL_DIRS"] = TEMP_DIR
    os.environ["JAVA_TOOL_OPTIONS"] = f"-Djava.io.tmpdir={TEMP_DIR}"
    os.environ["PYSPARK_PYTHON"] = sys.executable
    os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable
 
    from pyspark.sql import SparkSession, functions as F
    from pyspark.ml.feature import VectorAssembler, StandardScaler
    from pyspark.ml.clustering import KMeans
    from pyspark.ml.evaluation import ClusteringEvaluator
 
    spark = (
        SparkSession.builder
        .appName("SpotifyEvaluasiK")
        .master("local[2]")
        .config("spark.local.dir", TEMP_DIR)
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.driver.memory", "4g")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("ERROR")
 
    sampel = None
    scaled = None
    try:
        # --- baca dan validasi (sama seperti file 05) ---
        df = (
            spark.read.option("header", True)
            .option("multiLine", True)
            .option("escape", '"')
            .csv(INPUT_CLEAN)
        )
        for kolom in FITUR_AUDIO:
            df = df.withColumn(kolom, F.expr(f"try_cast(`{kolom}` AS DOUBLE)"))
 
        valid = F.lit(True)
        for kolom in FITUR_AUDIO:
            valid = valid & F.col(kolom).isNotNull() & ~F.isnan(F.col(kolom))
        for kolom in FITUR_0_1:
            valid = valid & F.col(kolom).between(0, 1)
        valid = valid & (F.col("tempo") > 0)
 
        df_valid = df.filter(valid).select(*FITUR_AUDIO)
 
        # Split identik dengan file 05; pemilihan k hanya dari data training.
        train_df, test_df = df_valid.randomSplit([0.8, 0.2], seed=SEED)
        jumlah_train = train_df.count()
        jumlah_test = test_df.count()

        frac = min(1.0, UKURAN_SAMPEL_SPARK / jumlah_train)
        print(f"Lagu valid        : {jumlah_train + jumlah_test:,}")
        print(f"Data training     : {jumlah_train:,}")
        print(f"Data testing      : {jumlah_test:,}")
        print(f"Sampel pemilihan k: sekitar {min(UKURAN_SAMPEL_SPARK, jumlah_train):,} lagu training")

        sampel = train_df.sample(False, frac, seed=SEED).cache()
        n = sampel.count()
 
        vec = VectorAssembler(inputCols=FITUR_AUDIO, outputCol="fitur_mentah").transform(sampel)
        scaler = StandardScaler(
            inputCol="fitur_mentah", outputCol="fitur_standar",
            withMean=True, withStd=True,
        ).fit(vec)
        scaled = scaler.transform(vec).select("fitur_standar").cache()
        scaled.count()
 
        evaluator = ClusteringEvaluator(
            featuresCol="fitur_standar", predictionCol="cluster",
            metricName="silhouette", distanceMeasure="squaredEuclidean",
        )
 
        hasil = []
        print(f"\n{'k':>3} {'Silhouette':>11} {'DBI':>8} {'WSSSE':>14} {'detik':>7}")
        for k in range(K_MIN, K_MAX + 1):
            km = KMeans(
                featuresCol="fitur_standar", predictionCol="cluster",
                k=k, seed=SEED, maxIter=MAX_ITER_K, initMode="k-means||",
            )
            t0 = time.time()
            model = km.fit(scaled)
            detik = time.time() - t0
 
            pred = model.transform(scaled)
            sil = evaluator.evaluate(pred)
 
            kecil = pred.sample(False, min(1.0, UKURAN_SAMPEL_DBI / n), seed=SEED).collect()
            X = np.array([r["fitur_standar"].toArray() for r in kecil])
            y = np.array([r["cluster"] for r in kecil])
            dbi = davies_bouldin(X, y, np.array(model.clusterCenters()))
 
            wssse = model.summary.trainingCost
            hasil.append((k, sil, dbi, wssse, detik))
            print(f"{k:>3} {sil:>11.4f} {dbi:>8.4f} {wssse:>14,.0f} {detik:>7.1f}")
 
        tabel = pd.DataFrame(
            hasil,
            columns=["k", "silhouette", "davies_bouldin", "wssse", "waktu_latih_detik"],
        )
        tabel.to_csv(os.path.join(OUT_DIR, "k_selection.csv"), index=False)
        print("\nTersimpan:", os.path.join(OUT_DIR, "k_selection.csv"))
 
        k_sil = int(tabel.loc[tabel.silhouette.idxmax(), "k"])
        k_dbi = int(tabel.loc[tabel.davies_bouldin.idxmin(), "k"])
        print(f"k terbaik menurut Silhouette (tertinggi) : {k_sil}")
        print(f"k terbaik menurut DBI (terendah)         : {k_dbi}")
 
        # --- grafik ---
        import matplotlib
        matplotlib.use("Agg")
        from matplotlib.figure import Figure
 
        fig = Figure(figsize=(11, 3.4))
        a1, a2, a3 = fig.subplots(1, 3)
        for ax, kolom, judul in [
            (a1, "silhouette", "Silhouette (semakin tinggi semakin baik)"),
            (a2, "davies_bouldin", "Davies-Bouldin (semakin rendah semakin baik)"),
            (a3, "wssse", "WSSSE (cari titik siku / elbow)"),
        ]:
            ax.plot(tabel.k, tabel[kolom], color=BIRU, linewidth=2, marker="o", markersize=5)
            gaya_sumbu(ax, judul)
            ax.set_xlabel("jumlah cluster (k)")
            ax.set_xticks(tabel.k)
        fig.tight_layout()
        simpan_png(fig, "k_selection.png")
 
    finally:
        if scaled is not None:
            scaled.unpersist()
        if sampel is not None:
            sampel.unpersist()
        spark.stop()
 
 
# ==================================================
# 4. BAGIAN B - KECEPATAN DAN KUALITAS REKOMENDASI
# ==================================================
 
def baca_hasil_cluster():
    files = sorted(glob.glob(os.path.join(CLUSTER_DIR, "part-*.csv")))
    if not files:
        raise FileNotFoundError(
            f"Hasil clustering tidak ditemukan di {CLUSTER_DIR}\n"
            "Jalankan 05_clustering_kmeans.py terlebih dahulu."
        )
    df = pd.concat(
        [pd.read_csv(f, encoding="utf-8-sig", low_memory=False) for f in files],
        ignore_index=True,
    )
    perlu = ["name", "artists", "cluster"] + FITUR_AUDIO
    hilang = [c for c in perlu if c not in df.columns]
    if hilang:
        raise ValueError(f"Kolom tidak ditemukan di hasil clustering: {hilang}")
 
    for c in FITUR_AUDIO:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["cluster"] = pd.to_numeric(df["cluster"], errors="coerce")
    df["name"] = df["name"].fillna("(tanpa judul)").astype(str)
    df["artists"] = df["artists"].fillna("(tanpa artis)").astype(str)
    df = df.dropna(subset=FITUR_AUDIO + ["cluster"]).reset_index(drop=True)
    df["cluster"] = df["cluster"].astype(int)
    return df, len(files)
 
 
def ambil_top(sims, n):
    """Indeks n nilai terbesar (terurut), mengabaikan -inf."""
    n = min(n, len(sims) - 1)
    if n <= 0:
        return np.array([], dtype=int)
    bagian = np.argpartition(-sims, n - 1)[:n]
    urut = bagian[np.argsort(-sims[bagian])]
    return urut[np.isfinite(sims[urut])]
 
 
def evaluasi_rekomendasi():
    print("\n" + "=" * 60)
    print("BAGIAN B - Kecepatan dan kualitas rekomendasi")
    print("=" * 60)
 
    os.makedirs(OUT_DIR, exist_ok=True)
 
    df, jumlah_part = baca_hasil_cluster()
    N = len(df)
    print(f"Lagu dimuat       : {N:,} (dari {jumlah_part} file part)")
 
    # --- siapkan matriks: standardisasi, lalu normalisasi panjang vektor = 1 ---
    X = df[FITUR_AUDIO].to_numpy(np.float32)
    mean, std = X.mean(axis=0), X.std(axis=0)
    std[std == 0] = 1
    Z = (X - mean) / std
    norma = np.linalg.norm(Z, axis=1, keepdims=True)
    norma[norma == 0] = 1
    U = (Z / norma).astype(np.float32)      # cosine similarity = U @ vektor_query
 
    cl = df["cluster"].to_numpy()
    kode, _ = pd.factorize(df["name"] + "|" + df["artists"])   # lagu yang sama (judul+artis)
    artis = df["artists"].to_numpy()
 
    klaster = np.unique(cl)
    idx_c = {c: np.flatnonzero(cl == c) for c in klaster}
    U_c = {c: U[idx_c[c]] for c in klaster}
    kode_c = {c: kode[idx_c[c]] for c in klaster}
    print(f"Jumlah cluster    : {len(klaster)}")
 
    # --- dua cara pencarian ---
    def cari_semua(qi):
        t0 = time.perf_counter()
        s = U @ U[qi]
        s[kode == kode[qi]] = -np.inf          # buang lagu yang sama (rilis ulang)
        top = ambil_top(s, TOP_N)
        return top, s[top], (time.perf_counter() - t0) * 1000
 
    def cari_cluster(qi):
        c = cl[qi]
        t0 = time.perf_counter()
        s = U_c[c] @ U[qi]
        s[kode_c[c] == kode[qi]] = -np.inf
        top_lokal = ambil_top(s, TOP_N)
        return idx_c[c][top_lokal], s[top_lokal], (time.perf_counter() - t0) * 1000
 
    # --- pilih lagu awal secara acak (dari artis yang punya cukup banyak lagu) ---
    rng = np.random.default_rng(SEED)
    jumlah_per_artis = df.groupby("artists")["artists"].transform("size").to_numpy()
    kandidat = np.flatnonzero(jumlah_per_artis >= MIN_LAGU_PER_ARTIS)
    if len(kandidat) < JUMLAH_QUERY:
        kandidat = np.arange(N)
    query = rng.choice(kandidat, size=min(JUMLAH_QUERY, len(kandidat)), replace=False)
    print(f"Lagu awal diuji   : {len(query)} (artis dengan >= {MIN_LAGU_PER_ARTIS} lagu)")
 
    cari_semua(int(query[0]))     # pemanasan, tidak dihitung
    cari_cluster(int(query[0]))
 
    baris = []
    for qi in query:
        qi = int(qi)
        top_f, sim_f, t_f = cari_semua(qi)
        top_c, sim_c, t_c = cari_cluster(qi)
 
        irisan = len(set(top_f.tolist()) & set(top_c.tolist()))
        baris.append({
            "indeks_lagu": qi,
            "judul": df["name"].iat[qi],
            "artis": artis[qi],
            "cluster": int(cl[qi]),
            "waktu_semua_ms": t_f,
            "waktu_cluster_ms": t_c,
            "irisan_top": irisan / TOP_N,
            "kosinus_semua": float(sim_f.mean()) if len(sim_f) else np.nan,
            "kosinus_cluster": float(sim_c.mean()) if len(sim_c) else np.nan,
            "hit_artis_semua": float(np.any(artis[top_f] == artis[qi])),
            "hit_artis_cluster": float(np.any(artis[top_c] == artis[qi])),
            "porsi_kandidat": len(idx_c[cl[qi]]) / N,
        })
 
    hasil = pd.DataFrame(baris)
    hasil.to_csv(os.path.join(OUT_DIR, "detail_query.csv"), index=False, encoding="utf-8-sig")
 
    t_all = hasil.waktu_semua_ms.mean()
    t_clu = hasil.waktu_cluster_ms.mean()
    cos_all = hasil.kosinus_semua.mean()
    cos_clu = hasil.kosinus_cluster.mean()
 
    ringkas = [
        ("jumlah_lagu", N, "Jumlah lagu yang dicari"),
        ("jumlah_cluster", len(klaster), "Jumlah cluster K-Means"),
        ("jumlah_lagu_uji", len(hasil), "Banyak lagu awal yang diuji"),
        ("waktu_rata2_semua_ms", round(t_all, 3), "Waktu rata-rata per pencarian, cari di semua lagu (ms)"),
        ("waktu_rata2_cluster_ms", round(t_clu, 3), "Waktu rata-rata per pencarian, hanya satu cluster (ms)"),
        ("percepatan_kali", round(t_all / t_clu, 2), "Berapa kali lebih cepat dengan filter cluster"),
        ("porsi_kandidat_persen", round(hasil.porsi_kandidat.mean() * 100, 1), "Rata-rata persen lagu yang diperiksa (cara cluster)"),
        ("recall_top10_persen", round(hasil.irisan_top.mean() * 100, 1), "Persen 10 lagu paling mirip (versi lengkap) yang tetap ketemu lewat cluster"),
        ("kosinus_rata2_semua", round(cos_all, 4), "Rata-rata kemiripan kosinus top-10, cari di semua lagu"),
        ("kosinus_rata2_cluster", round(cos_clu, 4), "Rata-rata kemiripan kosinus top-10, hanya satu cluster"),
        ("penurunan_kosinus_persen", round((cos_all - cos_clu) / abs(cos_all) * 100, 2), "Penurunan kemiripan akibat filter cluster"),
        ("hit_rate_artis_semua_persen", round(hasil.hit_artis_semua.mean() * 100, 1), "Persen query yang top-10-nya memuat artis yang sama (semua lagu)"),
        ("hit_rate_artis_cluster_persen", round(hasil.hit_artis_cluster.mean() * 100, 1), "Persen query yang top-10-nya memuat artis yang sama (cluster)"),
    ]
    pd.DataFrame(ringkas, columns=["metrik", "nilai", "keterangan"]).to_csv(
        os.path.join(OUT_DIR, "ringkasan_evaluasi.csv"), index=False, encoding="utf-8-sig"
    )
 
    print("\nRINGKASAN")
    for nama, nilai, ket in ringkas:
        print(f"  {nama:<32} {nilai:>12}   {ket}")
 
    # --- grafik perbandingan ---
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib.figure import Figure
 
    fig = Figure(figsize=(10, 3.6))
    a1, a2 = fig.subplots(1, 2)
 
    a1.bar(["Semua lagu", "Satu cluster"], [t_all, t_clu], color=[ORANYE, BIRU], width=0.5)
    gaya_sumbu(a1, "Waktu rata-rata per pencarian (ms)")
    a1.set_ylabel("milidetik")
    for x, v in enumerate([t_all, t_clu]):
        a1.text(x, v, f"{v:.1f}", ha="center", va="bottom", fontsize=9, color=TEKS)
 
    nama = ["Recall top-10", "Hit-rate artis\n(semua lagu)", "Hit-rate artis\n(cluster)"]
    nilai = [hasil.irisan_top.mean() * 100, hasil.hit_artis_semua.mean() * 100,
             hasil.hit_artis_cluster.mean() * 100]
    a2.bar(nama, nilai, color=[BIRU, ORANYE, BIRU], width=0.5)
    gaya_sumbu(a2, "Kualitas hasil (%)")
    a2.set_ylim(0, 105)
    for x, v in enumerate(nilai):
        a2.text(x, v, f"{v:.0f}%", ha="center", va="bottom", fontsize=9, color=TEKS)
    fig.tight_layout()
    simpan_png(fig, "perbandingan.png")
 
    print("\nSelesai. Hasil ada di:", OUT_DIR)
 
 


# ==================================================
# 5. BAGIAN C - EVALUASI PREDIKSI PADA DATA TESTING
# ==================================================

def baca_hasil_testing():
    files = sorted(glob.glob(os.path.join(TEST_DIR, "part-*.csv")))
    if not files:
        raise FileNotFoundError(
            f"Hasil prediksi testing tidak ditemukan di {TEST_DIR}\n"
            "Jalankan 05_clustering_kmeans.py versi train/test terlebih dahulu."
        )
    df = pd.concat(
        [pd.read_csv(f, encoding="utf-8-sig", low_memory=False) for f in files],
        ignore_index=True,
    )
    perlu = ["cluster"] + FITUR_AUDIO
    hilang = [c for c in perlu if c not in df.columns]
    if hilang:
        raise ValueError(f"Kolom tidak ditemukan pada hasil testing: {hilang}")
    for c in FITUR_AUDIO + ["cluster"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=FITUR_AUDIO + ["cluster"]).copy()
    df = df[np.isfinite(df[FITUR_AUDIO]).all(axis=1)]
    df["cluster"] = df["cluster"].astype(int)
    return df.reset_index(drop=True), len(files)


def evaluasi_testing():
    print("\n" + "=" * 60)
    print("BAGIAN C - Evaluasi prediksi pada data testing")
    print("=" * 60)
    os.makedirs(OUT_DIR, exist_ok=True)

    if not os.path.isfile(MODEL_JSON):
        raise FileNotFoundError(
            f"Parameter model tidak ditemukan: {MODEL_JSON}. "
            "Pastikan file 05 menyimpan model_kmeans.json."
        )
    with open(MODEL_JSON, "r", encoding="utf-8") as f:
        parameter = json.load(f)

    # Gunakan scaler dari training, jangan fit ulang pada data testing.
    mean = np.asarray(parameter["scaler_mean"], dtype=np.float64)
    std = np.asarray(parameter["scaler_std"], dtype=np.float64)
    if len(mean) != len(FITUR_AUDIO) or len(std) != len(FITUR_AUDIO):
        raise ValueError(f"scaler_mean dan scaler_std harus memiliki {len(FITUR_AUDIO)} nilai.")
    std[std == 0] = 1.0

    df, jumlah_part = baca_hasil_testing()
    if len(df) < 2:
        raise ValueError("Data testing valid kurang dari 2 baris.")
    print(f"Baris testing valid: {len(df):,} (dari {jumlah_part} file part)")

    X = df[FITUR_AUDIO].to_numpy(dtype=np.float64)
    Z = (X - mean) / std
    y = df["cluster"].to_numpy(dtype=int)
    rng = np.random.default_rng(SEED)

    # Silhouette dihitung pada sampel kecil karena kompleksitas komputasinya tinggi.
    n_sil = min(UKURAN_SAMPEL_SILUET, len(df))
    idx_sil = rng.choice(len(df), size=n_sil, replace=False) if n_sil < len(df) else np.arange(len(df))
    sil = float("nan")
    try:
        from sklearn.metrics import silhouette_score
    except ImportError as e:
        raise ImportError("Bagian C memerlukan scikit-learn: pip install scikit-learn") from e
    y_sil = y[idx_sil]
    if 1 < len(np.unique(y_sil)) < len(y_sil):
        sil = float(silhouette_score(Z[idx_sil], y_sil, metric="euclidean"))

    # DBI pada subset test; pusat cluster dihitung dari data test yang terpilih.
    n_dbi = min(UKURAN_SAMPEL_DBI, len(df))
    idx_dbi = rng.choice(len(df), size=n_dbi, replace=False) if n_dbi < len(df) else np.arange(len(df))
    X_dbi, y_dbi = Z[idx_dbi], y[idx_dbi]
    cluster_dbi = np.unique(y_dbi)
    dbi = float("nan")
    if len(cluster_dbi) >= 2:
        pusat = np.vstack([X_dbi[y_dbi == c].mean(axis=0) for c in cluster_dbi])
        remap = {c: i for i, c in enumerate(cluster_dbi)}
        label = np.array([remap[c] for c in y_dbi], dtype=int)
        dbi = davies_bouldin(X_dbi, label, pusat)

    distribusi = (
        df["cluster"].value_counts().sort_index()
        .rename_axis("cluster").reset_index(name="jumlah_lagu")
    )
    distribusi.to_csv(
        os.path.join(OUT_DIR, "distribusi_cluster_testing.csv"),
        index=False, encoding="utf-8-sig",
    )

    ringkasan = [
        ("jumlah_data_testing", len(df), "Jumlah baris testing valid"),
        ("jumlah_cluster_terprediksi", int(df["cluster"].nunique()), "Jumlah cluster yang muncul pada prediksi testing"),
        ("silhouette_testing", sil, f"Sampel maksimal {UKURAN_SAMPEL_SILUET:,}; semakin tinggi semakin baik"),
        ("davies_bouldin_testing", dbi, f"Sampel maksimal {UKURAN_SAMPEL_DBI:,}; semakin rendah semakin baik"),
        ("jumlah_sampel_silhouette", len(idx_sil), "Jumlah baris untuk Silhouette"),
        ("jumlah_sampel_dbi", len(idx_dbi), "Jumlah baris untuk Davies-Bouldin"),
    ]
    pd.DataFrame(ringkasan, columns=["metrik", "nilai", "keterangan"]).to_csv(
        os.path.join(OUT_DIR, "evaluasi_testing.csv"),
        index=False, encoding="utf-8-sig",
    )

    print("\nHASIL EVALUASI TESTING")
    for nama, nilai, ket in ringkasan:
        if isinstance(nilai, (float, np.floating)):
            tampil = f"{nilai:.4f}" if np.isfinite(nilai) else "NaN"
        else:
            tampil = f"{nilai:,}" if isinstance(nilai, (int, np.integer)) else str(nilai)
        print(f"  {nama:<32} {tampil:>12}   {ket}")
    print("\nFile tersimpan:")
    print(" ", os.path.join(OUT_DIR, "evaluasi_testing.csv"))
    print(" ", os.path.join(OUT_DIR, "distribusi_cluster_testing.csv"))


# ==================================================
# 6. MAIN
# ==================================================
 
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Evaluasi sistem rekomendasi Spotify")
    ap.add_argument("--lewati-k", action="store_true", help="lewati Bagian A (pemilihan k)")
    ap.add_argument("--hanya-k", action="store_true", help="hanya jalankan Bagian A")
    ap.add_argument("--lewati-testing", action="store_true", help="lewati Bagian C")
    ap.add_argument("--hanya-testing", action="store_true", help="hanya jalankan Bagian C")
    arg = ap.parse_args()

    if arg.hanya_testing:
        evaluasi_testing()
    else:
        if not arg.lewati_k:
            evaluasi_k()
        if not arg.hanya_k:
            evaluasi_rekomendasi()
        if not arg.lewati_testing:
            evaluasi_testing()
