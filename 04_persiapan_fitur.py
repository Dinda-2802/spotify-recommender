
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

BATAS_UJI = None

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
    # 3. MEMBACA DATASET
    # ==========================================

    df = (
        spark.read
        .option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(INPUT_FILE)
    )

    print("\nKolom dataset:")
    print(df.columns)

    # Menyesuaikan nama kolom identitas
    kolom_nama = (
        "track_name" if "track_name" in df.columns
        else "name"
    )

    kolom_id = (
        "track_id" if "track_id" in df.columns
        else None
    )

    identitas = [
        kolom for kolom in [
            kolom_id,
            kolom_nama,
            "artists",
            "album_name"
        ]
        if kolom is not None and kolom in df.columns
    ]

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

    # Pastikan seluruh fitur tersedia
    kolom_wajib = identitas + fitur_audio
    kolom_hilang = [
        kolom for kolom in kolom_wajib
        if kolom not in df.columns
    ]

    if kolom_hilang:
        raise ValueError(
            f"Kolom tidak ditemukan: {kolom_hilang}"
        )

    # ==========================================
    # 4. MEMBATASI DATA UJI
    # ==========================================

    df = df.select(*kolom_wajib)

    if BATAS_UJI is not None:
        df = df.limit(BATAS_UJI)

    # ==========================================
    # 5. KONVERSI FITUR NUMERIK
    # ==========================================

    for kolom in fitur_audio:
        df = df.withColumn(
            kolom,
            F.col(kolom).cast("double")
        )

    # ==========================================
    # 6. VALIDASI DATA
    # ==========================================

    kondisi_valid = F.lit(True)

    for kolom in fitur_audio:
        kondisi_valid = (
            kondisi_valid
            & F.col(kolom).isNotNull()
            & ~F.isnan(F.col(kolom))
        )

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

    kondisi_valid = (
        kondisi_valid
        & (F.col("tempo") > 0)
    )

    # Memastikan loudness bernilai finite
    kondisi_valid = (
        kondisi_valid
        & (F.abs(F.col("loudness")) < float("inf"))
    )

    df_valid = df.filter(kondisi_valid)

    jumlah_uji = df.count()
    jumlah_valid = df_valid.count()

    print("\nJumlah data diuji :", jumlah_uji)
    print("Jumlah data valid :", jumlah_valid)
    print("Tidak valid       :", jumlah_uji - jumlah_valid)

    if jumlah_valid == 0:
        raise ValueError("Tidak ditemukan data valid.")

    # ==========================================
    # 7. VECTOR ASSEMBLER
    # ==========================================

    assembler = VectorAssembler(
        inputCols=fitur_audio,
        outputCol="fitur_mentah",
        handleInvalid="error"
    )

    data_vektor = assembler.transform(df_valid)

    # ==========================================
    # 8. STANDARDISASI FITUR
    # ==========================================

    print("\nMelakukan standardisasi...")

    scaler = StandardScaler(
        inputCol="fitur_mentah",
        outputCol="fitur_standar",
        withMean=True,
        withStd=True
    )

    model_scaler = scaler.fit(data_vektor)

    data_standar = model_scaler.transform(data_vektor)

    # ==========================================
    # 9. MENYIMPAN HASIL STANDARDISASI
    # ==========================================

    OUTPUT_DIR = os.path.join(
        BASE_DIR, "hasil_persiapan_fitur"
    )

    print("\nMenyimpan hasil standardisasi...")

    (
        data_standar
        .select(
            *identitas,
            *fitur_audio,
            "fitur_standar"
        )
        .write
        .mode("overwrite")
        .parquet(OUTPUT_DIR)
    )

    print("Hasil berhasil disimpan:", OUTPUT_DIR)

    # ==========================================
    # 10. MENAMPILKAN HASIL
    # ==========================================
    print("\n" + "=" * 55)
    print("PERSIAPAN FITUR BERHASIL")
    print("=" * 55)

    print("Jumlah fitur :", len(fitur_audio))
    print("Jumlah data  :", f"{jumlah_valid:,}")
    print("Batas uji    :", BATAS_UJI)

    print("Output       :", OUTPUT_DIR)

except Exception as e:
    print("\nPROSES GAGAL:", str(e))
    sys.exit(1)

finally:
    spark.stop()
