
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

# PEMBAGIAN DATASET
RASIO_TRAIN = 0.8
RASIO_TEST = 0.2

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
train_df = None
test_df = None
hasil_train = None
hasil_test = None
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

    print("\n[1/8] Membaca dataset bersih...")

    df = (
        spark.read
        .option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(INPUT_FILE)
    )

    kolom_wajib = ["id", "name", "artists"] + FITUR_AUDIO
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

    print("\n[2/8] Memvalidasi fitur audio...")

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
    # TAMBAHAN: PEMBAGIAN DATA TRAINING DAN TESTING
    # ==================================================

    print("\n[3/8] Membagi data training dan testing...")

    train_df, test_df = df_valid.randomSplit(
        [RASIO_TRAIN, RASIO_TEST],
        seed=SEED
    )

    train_df = train_df.cache()
    test_df = test_df.cache()

    jumlah_train = train_df.count()
    jumlah_test = test_df.count()

    jumlah_split = jumlah_train + jumlah_test

    if jumlah_train < JUMLAH_CLUSTER:
        raise ValueError(
            "Jumlah data training terlalu sedikit."
        )

    if jumlah_test == 0:
        raise ValueError(
            "Data testing kosong."
        )

    persentase_train = jumlah_train / jumlah_split * 100
    persentase_test = jumlah_test / jumlah_split * 100

    print("Jumlah data valid :", f"{jumlah_valid:,}")
    print("Jumlah training   :", f"{jumlah_train:,}")
    print("Jumlah testing    :", f"{jumlah_test:,}")
    print("Persentase training:", f"{persentase_train:.2f}%")
    print("Persentase testing :", f"{persentase_test:.2f}%")

    # ==================================================
    # 4. VEKTORISASI DAN STANDARDISASI
    # ==================================================

    print("\n[4/8] Menyiapkan fitur dan standardisasi...")

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

    print(
        f"\n[5/8] Melatih K-Means menggunakan data training, "
        f"k={JUMLAH_CLUSTER}..."
    )

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

    # PERUBAHAN UTAMA:
    # Model hanya dilatih menggunakan data training.
    model = pipeline.fit(train_df)

    scaler_model = model.stages[1]
    kmeans_model = model.stages[2]

    print("Pelatihan model selesai.")

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
        "rasio_training": RASIO_TRAIN,
        "rasio_testing": RASIO_TEST,
        "jumlah_training": jumlah_train,
        "jumlah_testing": jumlah_test,
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

    print("\n[6/8] Menentukan cluster data training...")

    hasil_train = (
        model.transform(train_df)
        .select(
            "id",
            "name",
            "artists",
            *FITUR_AUDIO,
            "cluster"
        )
        .cache()
    )

    jumlah_hasil_train = hasil_train.count()

    print(
        "Lagu training berhasil dikelompokkan:",
        f"{jumlah_hasil_train:,}"
    )

    # TAMBAHAN: PREDIKSI DATA TESTING
    print("\nMelakukan prediksi data testing...")

    hasil_test = (
        model.transform(test_df)
        .select(
            "id",
            "name",
            "artists",
            *FITUR_AUDIO,
            "cluster"
        )
        .cache()
    )

    jumlah_hasil_test = hasil_test.count()

    print(
        "Lagu testing berhasil diprediksi:",
        f"{jumlah_hasil_test:,}"
    )

    # Mempertahankan hasil seluruh lagu untuk aplikasi.
    hasil = hasil_train.unionByName(hasil_test).cache()

    jumlah_hasil = hasil.count()

    print(
        "Total lagu yang mendapatkan cluster:",
        f"{jumlah_hasil:,}"
    )

    print("\n[7/8] Menyimpan CSV per partisi...")

    header = ["id", "name", "artists"] + FITUR_AUDIO + ["cluster"]

    # Fungsi penyimpanan mempertahankan mekanisme asli.
    def simpan_csv_partisi(dataframe, output_csv):

        if os.path.exists(output_csv):
            shutil.rmtree(output_csv)

        os.makedirs(output_csv, exist_ok=True)

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
                        row["id"],
                        row["name"],
                        row["artists"],
                        *[row[c] for c in FITUR_AUDIO],
                        row["cluster"],
                    ])
                    jumlah += 1

            yield (index, nama_tmp, jumlah)

        statistik_partisi = (
            dataframe.rdd
            .mapPartitionsWithIndex(tulis_partisi)
            .collect()
        )

        jumlah_tersimpan = 0

        for index, nama_tmp, jumlah in statistik_partisi:
            nama_final = os.path.join(
                output_csv,
                f"part-{index:05d}.csv"
            )

            os.replace(nama_tmp, nama_final)
            jumlah_tersimpan += jumlah

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

        if jumlah_tersimpan != dataframe.count():
            raise RuntimeError(
                f"Jumlah tersimpan ({jumlah_tersimpan}) "
                f"tidak sama dengan jumlah hasil "
                f"({dataframe.count()})."
            )

        return jumlah_tersimpan

    # Hasil seluruh lagu untuk kompatibilitas aplikasi.
    output_csv = os.path.join(
        OUTPUT_DIR, "lagu_dengan_cluster"
    )

    jumlah_tersimpan = simpan_csv_partisi(
        hasil,
        output_csv
    )

    # Hasil khusus testing untuk evaluasi.
    output_testing = os.path.join(
        OUTPUT_DIR, "hasil_prediksi_testing"
    )

    jumlah_testing_tersimpan = simpan_csv_partisi(
        hasil_test,
        output_testing
    )

    if jumlah_testing_tersimpan != jumlah_hasil_test:
        raise RuntimeError(
            "Jumlah data prediksi testing tidak sesuai."
        )

    # ==================================================
    # 8. RINGKASAN DAN METRIK
    # ==================================================

    print("\n[8/8] Menghitung ringkasan cluster...")

    # Tetap menggunakan seluruh hasil agar ringkasan
    # lama dan kompatibilitas aplikasi tidak berubah.
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

    # Informasi metrik dan pembagian dataset.
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
        writer.writerow(["seed", SEED])
        writer.writerow(["rasio_training", RASIO_TRAIN])
        writer.writerow(["rasio_testing", RASIO_TEST])

        writer.writerow(["jumlah_lagu_valid", jumlah_valid])
        writer.writerow(["jumlah_training", jumlah_train])
        writer.writerow(["jumlah_testing", jumlah_test])

        writer.writerow([
            "persentase_training",
            round(persentase_train, 2)
        ])

        writer.writerow([
            "persentase_testing",
            round(persentase_test, 2)
        ])

        writer.writerow([
            "within_set_sum_of_squared_errors_training",
            kmeans_model.summary.trainingCost
        ])

        writer.writerow([
            "jumlah_lagu_tersimpan",
            jumlah_tersimpan
        ])

        writer.writerow([
            "jumlah_prediksi_testing",
            jumlah_testing_tersimpan
        ])

    print("\n" + "=" * 60)
    print("CLUSTERING DAN PREDIKSI SELESAI")
    print("=" * 60)
    print("Folder hasil :", OUTPUT_DIR)
    print("Folder CSV   :", output_csv)
    print("Folder test  :", output_testing)
    print("Ringkasan    :", ringkasan_path)
    print("Metrik       :", metrik_path)
    print("Model JSON   :", model_path)
    print("Jumlah lagu  :", f"{jumlah_tersimpan:,}")
    print("Data training:", f"{jumlah_train:,}")
    print("Data testing :", f"{jumlah_test:,}")

    print(
        "\nCSV seluruh lagu tersimpan dalam folder "
        "lagu_dengan_cluster."
    )

    print(
        "CSV prediksi testing tersimpan dalam folder "
        "hasil_prediksi_testing."
    )

finally:
    if hasil is not None:
        hasil.unpersist()

    if hasil_train is not None:
        hasil_train.unpersist()

    if hasil_test is not None:
        hasil_test.unpersist()

    if train_df is not None:
        train_df.unpersist()

    if test_df is not None:
        test_df.unpersist()

    if df_valid is not None:
        df_valid.unpersist()

    spark.stop()
