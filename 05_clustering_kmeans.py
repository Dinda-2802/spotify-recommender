
import os
import sys
import csv
import json
import shutil

# ==================================================
# 1. PENGATURAN LOKASI
# ==================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "data_clean", "tracks_clean.csv")
OUTPUT_DIR = os.path.join(BASE_DIR, "hasil_clustering")
TEMP_DIR = r"D:\spark_temp"

JUMLAH_CLUSTER = 8
SEED = 42

FITUR_AUDIO = [
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

FITUR_0_1 = [
    "danceability",
    "energy",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
]

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

os.environ["TEMP"] = TEMP_DIR
os.environ["TMP"] = TEMP_DIR
os.environ["SPARK_LOCAL_DIRS"] = TEMP_DIR
os.environ["JAVA_TOOL_OPTIONS"] = f"-Djava.io.tmpdir={TEMP_DIR}"
os.environ["PYSPARK_PYTHON"] = sys.executable
os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable

from pyspark.sql import SparkSession, functions as F
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.clustering import KMeans
from pyspark.ml import Pipeline
from pyspark import TaskContext

# ==================================================
# 2. MEMBUAT SPARK
# ==================================================

spark = (
    SparkSession.builder
    .appName("SpotifyKMeansClustering")
    .master("local[2]")
    .config("spark.local.dir", TEMP_DIR)
    .config("spark.sql.shuffle.partitions", "4")
    .config("spark.driver.memory", "4g")
    .config(
        "spark.executor.extraJavaOptions",
        f"-Djava.io.tmpdir={TEMP_DIR}"
    )
    .getOrCreate()
)

spark.sparkContext.setLogLevel("ERROR")

df_valid = None
hasil = None

try:
    print("=" * 60)
    print("K-MEANS CLUSTERING DATASET SPOTIFY")
    print("=" * 60)
    print("Input :", INPUT_FILE)
    print("Output:", OUTPUT_DIR)
    print("Temp  :", TEMP_DIR)

    if not os.path.isfile(INPUT_FILE):
        raise FileNotFoundError(
            f"Dataset tidak ditemukan: {INPUT_FILE}"
        )

    # ==================================================
    # 3. MEMBACA DAN MEMVALIDASI DATA
    # ==================================================

    print("\n[1/7] Membaca dataset bersih...")

    df = (
        spark.read
        .option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(INPUT_FILE)
    )

    kolom_wajib = ["name", "artists"] + FITUR_AUDIO
    kolom_hilang = [
        c for c in kolom_wajib if c not in df.columns
    ]

    if kolom_hilang:
        raise ValueError(
            f"Kolom tidak ditemukan: {kolom_hilang}"
        )

    for kolom in FITUR_AUDIO:
        df = df.withColumn(
            kolom,
            F.expr(f"try_cast(`{kolom}` AS DOUBLE)")
        )

    print("Jumlah baris awal:", f"{df.count():,}")

    print("\n[2/7] Memvalidasi fitur audio...")

    kondisi_valid = F.lit(True)

    for kolom in FITUR_AUDIO:
        kondisi_valid = (
            kondisi_valid
            & F.col(kolom).isNotNull()
            & ~F.isnan(F.col(kolom))
        )

    for kolom in FITUR_0_1:
        kondisi_valid = (
            kondisi_valid
            & F.col(kolom).between(0, 1)
        )

    kondisi_valid = kondisi_valid & (F.col("tempo") > 0)

    df_valid = df.filter(kondisi_valid).cache()
    jumlah_valid = df_valid.count()

    print("Jumlah baris valid:", f"{jumlah_valid:,}")

    if jumlah_valid < JUMLAH_CLUSTER:
        raise ValueError(
            "Data valid terlalu sedikit untuk clustering."
        )

    # ==================================================
    # 4. VEKTORISASI DAN STANDARDISASI
    # ==================================================

    print("\n[3/7] Menyiapkan fitur dan standardisasi...")

    assembler = VectorAssembler(
        inputCols=FITUR_AUDIO,
        outputCol="fitur_mentah",
        handleInvalid="error"
    )

    scaler = StandardScaler(
        inputCol="fitur_mentah",
        outputCol="fitur_standar",
        withMean=True,
        withStd=True
    )

    # ==================================================
    # 5. MELATIH MODEL K-MEANS
    # ==================================================

    print(f"\n[4/7] Melatih K-Means, k={JUMLAH_CLUSTER}...")

    kmeans = KMeans(
        featuresCol="fitur_standar",
        predictionCol="cluster",
        k=JUMLAH_CLUSTER,
        seed=SEED,
        maxIter=30,
        initMode="k-means||"
    )

    pipeline = Pipeline(
        stages=[assembler, scaler, kmeans]
    )

    model = pipeline.fit(df_valid)

    scaler_model = model.stages[1]
    kmeans_model = model.stages[2]

    # Simpan parameter model menggunakan Python JSON.
    model_path = os.path.join(
        OUTPUT_DIR, "model_kmeans.json"
    )

    data_model = {
        "algoritma": "K-Means",
        "jumlah_cluster": JUMLAH_CLUSTER,
        "seed": SEED,
        "max_iter": 30,
        "fitur": FITUR_AUDIO,
        "with_mean": True,
        "with_std": True,
        "scaler_mean": scaler_model.mean.toArray().tolist(),
        "scaler_std": scaler_model.std.toArray().tolist(),
        "cluster_centers": [
            center.tolist()
            for center in kmeans_model.clusterCenters()
        ],
    }

    with open(model_path, "w", encoding="utf-8") as f:
        json.dump(
            data_model,
            f,
            ensure_ascii=False,
            indent=2
        )

    # ==================================================
    # 6. MEMBERI LABEL DAN MENYIMPAN CSV
    # ==================================================

    print("\n[5/7] Menentukan cluster setiap lagu...")

    hasil = (
        model.transform(df_valid)
        .select(
            "name",
            "artists",
            *FITUR_AUDIO,
            "cluster"
        )
        .cache()
    )

    jumlah_hasil = hasil.count()
    print("Lagu berhasil dikelompokkan:", f"{jumlah_hasil:,}")

    print("\n[6/7] Menyimpan CSV per partisi...")

    output_csv = os.path.join(
        OUTPUT_DIR, "lagu_dengan_cluster"
    )

    if os.path.exists(output_csv):
        shutil.rmtree(output_csv)

    os.makedirs(output_csv, exist_ok=True)

    header = ["name", "artists"] + FITUR_AUDIO + ["cluster"]

    # Setiap percobaan Spark menulis file sementara unik.
    # File final hanya dipindahkan setelah task berhasil.
    def tulis_partisi(index, rows):
        context = TaskContext.get()
        attempt_id = context.taskAttemptId()

        nama_tmp = os.path.join(
            output_csv,
            f"part-{index:05d}-attempt-{attempt_id}.tmp"
        )

        jumlah = 0

        with open(
            nama_tmp,
            "w",
            newline="",
            encoding="utf-8-sig"
        ) as f:
            writer = csv.writer(f)
            writer.writerow(header)

            for row in rows:
                writer.writerow([
                    row["name"],
                    row["artists"],
                    *[row[c] for c in FITUR_AUDIO],
                    row["cluster"],
                ])
                jumlah += 1

        yield (index, nama_tmp, jumlah)

    statistik_partisi = (
        hasil.rdd
        .mapPartitionsWithIndex(tulis_partisi)
        .collect()
    )

    # Pindahkan file percobaan yang berhasil menjadi file final.
    jumlah_tersimpan = 0

    for index, nama_tmp, jumlah in statistik_partisi:
        nama_final = os.path.join(
            output_csv,
            f"part-{index:05d}.csv"
        )

        os.replace(nama_tmp, nama_final)
        jumlah_tersimpan += jumlah

    # Hapus file sementara yang tersisa dari percobaan gagal.
    for nama in os.listdir(output_csv):
        if nama.endswith(".tmp"):
            try:
                os.remove(os.path.join(output_csv, nama))
            except OSError:
                pass

    with open(
        os.path.join(output_csv, "_SUCCESS"),
        "w",
        encoding="utf-8"
    ) as f:
        f.write("")

    if jumlah_tersimpan != jumlah_hasil:
        raise RuntimeError(
            f"Jumlah tersimpan ({jumlah_tersimpan}) "
            f"tidak sama dengan jumlah hasil ({jumlah_hasil})."
        )

    # ==================================================
    # 7. RINGKASAN DAN METRIK
    # ==================================================

    print("\n[7/7] Menghitung ringkasan cluster...")

    ringkasan = (
        hasil.groupBy("cluster")
        .count()
        .withColumnRenamed("count", "jumlah_lagu")
        .orderBy("cluster")
    )

    ringkasan.show(JUMLAH_CLUSTER, truncate=False)

    ringkasan_path = os.path.join(
        OUTPUT_DIR, "ringkasan_cluster.csv"
    )

    with open(
        ringkasan_path,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as f:
        writer = csv.writer(f)
        writer.writerow(["cluster", "jumlah_lagu"])

        for row in ringkasan.collect():
            writer.writerow([
                row["cluster"],
                row["jumlah_lagu"]
            ])

    metrik_path = os.path.join(
        OUTPUT_DIR, "metrik_model.csv"
    )

    with open(
        metrik_path,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as f:
        writer = csv.writer(f)
        writer.writerow(["metrik", "nilai"])
        writer.writerow(["k", JUMLAH_CLUSTER])
        writer.writerow([
            "within_set_sum_of_squared_errors",
            kmeans_model.summary.trainingCost
        ])
        writer.writerow(["jumlah_lagu_valid", jumlah_valid])
        writer.writerow(["jumlah_lagu_tersimpan", jumlah_tersimpan])
        writer.writerow(["seed", SEED])

    print("\n" + "=" * 60)
    print("CLUSTERING SELESAI")
    print("=" * 60)
    print("Folder hasil :", OUTPUT_DIR)
    print("Folder CSV   :", output_csv)
    print("Ringkasan    :", ringkasan_path)
    print("Metrik       :", metrik_path)
    print("Model JSON   :", model_path)
    print("Jumlah lagu  :", f"{jumlah_tersimpan:,}")
    print(
        "CSV lagu tersimpan sebagai beberapa file "
        "part-xxxxx.csv di folder lagu_dengan_cluster."
    )

finally:
    if hasil is not None:
        hasil.unpersist()

    if df_valid is not None:
        df_valid.unpersist()

    spark.stop()
