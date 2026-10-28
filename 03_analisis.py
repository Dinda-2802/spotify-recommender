
import os
import sys
import csv

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# ==================================================
# 1. KONFIGURASI
# ==================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(
    BASE_DIR, "data_clean", "tracks_clean.csv"
)
OUTPUT_DIR = os.path.join(BASE_DIR, "hasil_analisis")
TEMP_DIR = r"D:\spark_temp"

os.environ["TEMP"] = TEMP_DIR
os.environ["TMP"] = TEMP_DIR
os.environ["SPARK_LOCAL_DIRS"] = TEMP_DIR

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)


def judul(teks):
    print("\n" + "=" * 60)
    print(teks)
    print("=" * 60)


def simpan_csv(df, nama_file):
    """Menyimpan hasil analisis kecil menjadi satu file CSV."""
    tujuan = os.path.join(
        OUTPUT_DIR, f"{nama_file}.csv"
    )

    # Hasil agregasi atau daftar teratas berukuran kecil.
    baris = df.collect()

    with open(
        tujuan,
        mode="w",
        newline="",
        encoding="utf-8-sig"
    ) as file:
        writer = csv.writer(file)
        writer.writerow(df.columns)

        for row in baris:
            writer.writerow(list(row))

    print("Hasil disimpan:", tujuan)


spark = None

try:
    judul("ANALISIS DATASET SPOTIFY")

    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(
            f"Dataset tidak ditemukan: {INPUT_FILE}"
        )

    spark = (
        SparkSession.builder
        .appName("AnalisisDatasetSpotify")
        .master("local[*]")
        .config("spark.local.dir", TEMP_DIR)
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )

    spark.sparkContext.setLogLevel("ERROR")

    print("Membaca dataset bersih...")

    df = (
        spark.read
        .option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .option("mode", "PERMISSIVE")
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
        "tempo",
    ]

    for kolom in fitur_audio + ["year", "duration_ms"]:
        df = df.withColumn(
            kolom,
            F.expr(f"try_cast(`{kolom}` AS DOUBLE)")
        )

    # ==================================================
    # 2. RINGKASAN DATASET
    # ==================================================

    judul("1. RINGKASAN DATASET")

    jumlah_baris = df.count()
    jumlah_kolom = len(df.columns)

    print(f"Jumlah lagu : {jumlah_baris:,}")
    print(f"Jumlah kolom: {jumlah_kolom}")

    ringkasan = spark.createDataFrame(
        [
            ("jumlah_lagu", jumlah_baris),
            ("jumlah_kolom", jumlah_kolom),
        ],
        ["metrik", "nilai"],
    )

    simpan_csv(ringkasan, "ringkasan_dataset")

    # ==================================================
    # 3. JUMLAH LAGU PER TAHUN
    # ==================================================

    judul("2. JUMLAH LAGU PER TAHUN RILIS")

    lagu_per_tahun = (
        df.filter(
            F.col("year").isNotNull()
            & (F.col("year") > 0)
        )
        .groupBy("year")
        .agg(F.count("*").alias("jumlah_lagu"))
        .orderBy("year")
    )

    lagu_per_tahun.show(20, truncate=False)
    simpan_csv(lagu_per_tahun, "lagu_per_tahun")

    # ==================================================
    # 4. 20 ARTIS DENGAN LAGU TERBANYAK
    # ==================================================

    judul("3. ARTIS DENGAN JUMLAH LAGU TERBANYAK")

    artis_per_lagu = (
        df.select(
            F.explode(
                F.from_json(
                    F.col("artists"),
                    "array<string>"
                )
            ).alias("artis")
        )
        .filter(
            F.col("artis").isNotNull()
            & (F.trim(F.col("artis")) != "")
        )
    )

    artis_teratas = (
        artis_per_lagu
        .groupBy("artis")
        .agg(F.count("*").alias("jumlah_lagu"))
        .orderBy(
            F.desc("jumlah_lagu"),
            F.asc("artis")
        )
        .limit(20)
    )

    artis_teratas.show(20, truncate=False)
    simpan_csv(artis_teratas, "20_artis_teratas")

    # ==================================================
    # 5. RATA-RATA FITUR AUDIO
    # ==================================================

    judul("4. STATISTIK FITUR AUDIO")

    statistik_audio = df.select(
        *[
            F.round(F.avg(k), 4).alias(f"{k}_rata_rata")
            for k in fitur_audio
        ]
    )

    statistik_audio.show(truncate=False)

    statistik_panjang = (
        statistik_audio.select(
            F.explode(
                F.array(
                    *[
                        F.struct(
                            F.lit(k).alias("fitur"),
                            F.col(f"{k}_rata_rata").alias(
                                "rata_rata"
                            ),
                        )
                        for k in fitur_audio
                    ]
                )
            ).alias("hasil")
        )
        .select("hasil.*")
    )

    simpan_csv(
        statistik_panjang,
        "statistik_fitur_audio"
    )

    # ==================================================
    # 6. 10 LAGU DENGAN ENERGY TERTINGGI
    # ==================================================

    judul("5. 10 LAGU DENGAN ENERGY TERTINGGI")

    lagu_energi = (
        df.filter(
            F.col("energy").isNotNull()
            & F.col("name").isNotNull()
        )
        .select(
            "name",
            "artists",
            "year",
            "energy",
            "danceability"
        )
        .orderBy(F.desc("energy"))
        .limit(10)
    )

    lagu_energi.show(10, truncate=50)
    simpan_csv(
        lagu_energi,
        "10_lagu_energy_tertinggi"
    )

    # ==================================================
    # 7. STATISTIK DURASI
    # ==================================================

    judul("6. STATISTIK DURASI LAGU")

    statistik_durasi = df.agg(
        F.round(
            F.avg("duration_ms") / 60000, 2
        ).alias("rata_rata_durasi_menit"),
        F.round(
            F.min("duration_ms") / 60000, 2
        ).alias("durasi_minimum_menit"),
        F.round(
            F.max("duration_ms") / 60000, 2
        ).alias("durasi_maksimum_menit"),
    )

    statistik_durasi.show(truncate=False)
    simpan_csv(statistik_durasi, "statistik_durasi")

    judul("ANALISIS SELESAI")
    print("Folder hasil:", OUTPUT_DIR)
    print("Periksa file CSV di folder hasil_analisis.")

except Exception as e:
    print("\nANALISIS GAGAL:", str(e))
    sys.exit(1)

finally:
    if spark is not None:
        spark.stop()
