
from pathlib import Path
import os

# ============================================================
# 1. PENGATURAN LOKASI
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
FILE_INPUT = BASE_DIR / "tracks_features.csv"

TEMP_SPARK = r"D:\spark_temp"
os.makedirs(TEMP_SPARK, exist_ok=True)

os.environ["TEMP"] = TEMP_SPARK
os.environ["TMP"] = TEMP_SPARK
os.environ["SPARK_LOCAL_DIRS"] = TEMP_SPARK

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = (
    SparkSession.builder
    .appName("EksplorasiDatasetSpotify")
    .master("local[*]")
    .config("spark.local.dir", TEMP_SPARK)
    .config("spark.sql.shuffle.partitions", "8")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("ERROR")


def judul(teks):
    print("\n" + "=" * 64)
    print(teks.center(64))
    print("=" * 64)


try:
    # ========================================================
    # 2. MEMBACA DATASET
    # ========================================================
    if not FILE_INPUT.exists():
        raise FileNotFoundError(
            f"Dataset tidak ditemukan: {FILE_INPUT}"
        )

    df = (
        spark.read
        .option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .option("mode", "PERMISSIVE")
        .csv(str(FILE_INPUT))
    )

    judul("EKSPLORASI DATASET SPOTIFY")

    print(f"Nama file     : {FILE_INPUT.name}")
    print(f"Lokasi        : {FILE_INPUT}")
    print(f"Jumlah kolom  : {len(df.columns)}")

    jumlah_baris = df.count()
    print(f"Jumlah baris  : {jumlah_baris:,}")

    # ========================================================
    # 3. STRUKTUR DATA
    # ========================================================
    judul("1. STRUKTUR DATA")

    print(f"{'NO.':<5}{'NAMA KOLOM':<25}{'TIPE DATA':<15}")
    print("-" * 45)

    for nomor, (kolom, tipe) in enumerate(df.dtypes, start=1):
        print(f"{nomor:<5}{kolom:<25}{tipe:<15}")

    # ========================================================
    # 4. NILAI KOSONG
    # ========================================================
    judul("2. PEMERIKSAAN NILAI KOSONG")

    ekspresi_kosong = [
        F.sum(
            F.when(
                F.col(c).isNull() | (F.trim(F.col(c)) == ""),
                1
            ).otherwise(0)
        ).alias(c)
        for c in df.columns
    ]

    hasil_kosong = df.agg(*ekspresi_kosong).first().asDict()

    kolom_kosong = [
        (kolom, jumlah)
        for kolom, jumlah in hasil_kosong.items()
        if jumlah is not None and jumlah > 0
    ]

    if kolom_kosong:
        print(f"{'NAMA KOLOM':<28}{'JUMLAH KOSONG':>18}")
        print("-" * 46)

        for kolom, jumlah in kolom_kosong:
            print(f"{kolom:<28}{jumlah:>18,}")
    else:
        print("Tidak ditemukan nilai kosong.")

    # ========================================================
    # 5. RENTANG TAHUN RILIS
    # ========================================================
    judul("3. RENTANG TAHUN RILIS")

    hasil_tahun = df.agg(
        F.min(F.expr("try_cast(year AS INT)")).alias("minimum"),
        F.max(F.expr("try_cast(year AS INT)")).alias("maksimum")
    ).first()

    print(f"Tahun minimum : {hasil_tahun['minimum']}")
    print(f"Tahun maksimum: {hasil_tahun['maksimum']}")

    # ========================================================
    # 6. PEMERIKSAAN NAMA LAGU DAN ARTIS
    # ========================================================
    judul("4. PEMERIKSAAN NAMA LAGU DAN ARTIS")

    pasangan_valid = df.filter(
        F.col("name").isNotNull()
        & (F.trim(F.col("name")) != "")
        & F.col("artists").isNotNull()
        & (F.trim(F.col("artists")) != "")
    )

    # Satu agregasi untuk menghitung jumlah baris valid
    # dan jumlah pasangan nama-artis yang berbeda.
    hasil_pasangan = pasangan_valid.agg(
        F.count("*").alias("baris_valid"),
        F.countDistinct("name", "artists").alias("pasangan_unik")
    ).first()

    jumlah_valid = hasil_pasangan["baris_valid"]
    jumlah_unik = hasil_pasangan["pasangan_unik"]

    print(f"Baris dengan nama dan artis : {jumlah_valid:,}")
    print(f"Pasangan nama-artis unik    : {jumlah_unik:,}")
    print(f"Selisih pasangan berulang   : {jumlah_valid - jumlah_unik:,}")
    print("Catatan: selisih bukan jumlah pasti ID lagu duplikat.")

    # ========================================================
    # 7. STATISTIK FITUR AUDIO
    # ========================================================
    judul("5. STATISTIK FITUR AUDIO")

    fitur_audio = [
        "danceability",
        "energy",
        "loudness",
        "speechiness",
        "acousticness",
        "instrumentalness",
        "liveness",
        "valence",
        "tempo",
        "duration_ms"
    ]

    df_audio = df.select(
        *[
            F.expr(f"try_cast(`{kolom}` AS DOUBLE)").alias(kolom)
            for kolom in fitur_audio
        ]
    )

    df_audio.describe().show(truncate=False)

    # ========================================================
    # 8. CONTOH DATA
    # ========================================================
    judul("6. CONTOH 10 BARIS DATASET")

    df.select(
        "name",
        "artists",
        "danceability",
        "energy",
        "tempo",
        "year"
    ).show(10, truncate=25, vertical=False)

    judul("EKSPLORASI DATASET SELESAI")

except Exception as e:
    print("\nPROSES EKSPLORASI GAGAL")
    print(f"Jenis error : {type(e).__name__}")
    print(f"Pesan       : {str(e)[:1000]}")
    raise

finally:
    spark.stop()
