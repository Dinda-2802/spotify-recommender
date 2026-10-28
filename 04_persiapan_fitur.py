
import os
import sys

from pyspark.sql import SparkSession, functions as F
from pyspark.ml.feature import VectorAssembler, StandardScaler

# ==========================================
# 1. PENGATURAN LOKASI
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

INPUT_FILE = os.path.join(
    BASE_DIR, "data_clean", "tracks_clean.csv"
)

TEMP_DIR = r"D:\spark_temp"

BATAS_UJI = 100_000

os.environ["TEMP"] = TEMP_DIR
os.environ["TMP"] = TEMP_DIR
os.environ["SPARK_LOCAL_DIRS"] = TEMP_DIR

os.makedirs(TEMP_DIR, exist_ok=True)

# ==========================================
# 2. MEMBUAT SPARK SESSION
# ==========================================

spark = (
    SparkSession.builder
    .appName("PersiapanFiturSpotify")
    .master("local[2]")
    .config("spark.local.dir", TEMP_DIR)
    .config("spark.sql.shuffle.partitions", "4")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("ERROR")

try:
    print("=" * 55)
    print("PERSIAPAN FITUR AUDIO SPOTIFY")
    print("=" * 55)

    # ==========================================
    # 3. MEMBACA DATASET BERSIH
    # ==========================================

    if not os.path.isfile(INPUT_FILE):
        raise FileNotFoundError(
            f"Dataset tidak ditemukan: {INPUT_FILE}"
        )

    print("\nMembaca dataset bersih...")

    df = (
        spark.read
        .option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(INPUT_FILE)
    )

    fitur_audio = [
        "danceability",
        "energy",
        "loudness",
        "speechiness",
        "acousticness",
        "instrumentalness",
        "liveness",
        "valence",
        "tempo"
    ]

    # Uji awal menggunakan maksimal 100.000 baris
    df = df.limit(BATAS_UJI)

    # ==========================================
    # 4. MENGUBAH FITUR MENJADI ANGKA
    # ==========================================

    for kolom in fitur_audio:
        df = df.withColumn(
            kolom,
            F.expr(f"try_cast(`{kolom}` AS DOUBLE)")
        )

    # ==========================================
    # 5. MEMERIKSA VALIDITAS FITUR
    # ==========================================

    kondisi_valid = F.lit(True)

    for kolom in fitur_audio:
        kondisi_valid = (
            kondisi_valid
            & F.col(kolom).isNotNull()
            & ~F.isnan(F.col(kolom))
        )

    # Fitur berikut seharusnya berada pada rentang 0 sampai 1
    fitur_rentang = [
        "danceability",
        "energy",
        "speechiness",
        "acousticness",
        "instrumentalness",
        "liveness",
        "valence"
    ]

    for kolom in fitur_rentang:
        kondisi_valid = (
            kondisi_valid
            & F.col(kolom).between(0, 1)
        )

    # Tempo harus bernilai positif
    kondisi_valid = kondisi_valid & (F.col("tempo") > 0)

    df_valid = df.filter(kondisi_valid)

    jumlah_uji = df.count()
    jumlah_valid = df_valid.count()

    print("\nJumlah baris yang diuji :", jumlah_uji)
    print("Jumlah baris valid      :", jumlah_valid)
    print("Jumlah baris tidak valid:", jumlah_uji - jumlah_valid)

    if jumlah_valid == 0:
        raise ValueError(
            "Tidak ada baris valid. Periksa nama kolom "
            "dan nilai fitur dalam dataset."
        )

    # ==========================================
    # 6. MENGGABUNGKAN FITUR AUDIO
    # ==========================================

    assembler = VectorAssembler(
        inputCols=fitur_audio,
        outputCol="fitur_mentah",
        handleInvalid="error"
    )

    data_vektor = assembler.transform(df_valid)

    # ==========================================
    # 7. STANDARDISASI FITUR
    # ==========================================

    print("\nMelakukan standardisasi fitur audio...")

    scaler = StandardScaler(
        inputCol="fitur_mentah",
        outputCol="fitur_standar",
        withMean=True,
        withStd=True
    )

    model_scaler = scaler.fit(data_vektor)
    data_standar = model_scaler.transform(data_vektor)

    # ==========================================
    # 8. MENAMPILKAN HASIL UJI
    # ==========================================

    print("\nContoh hasil persiapan fitur:")

    data_standar.select(
        "name",
        "artists",
        "fitur_standar"
    ).show(5, truncate=50)

    print("\n" + "=" * 55)
    print("PERSIAPAN FITUR BERHASIL")
    print("=" * 55)

    print("Fitur audio:", ", ".join(fitur_audio))
    print("Batas uji:", f"{BATAS_UJI:,}", "baris")
    print(
        "\nCatatan: ini masih uji awal, "
        "belum merupakan model rekomendasi."
    )

except Exception as e:
    print("\nPROSES GAGAL:", str(e))
    sys.exit(1)

finally:
    spark.stop()
