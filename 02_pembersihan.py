
from pathlib import Path
import os
import csv

# ============================================================
# 1. PENGATURAN LOKASI
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
FILE_INPUT = BASE_DIR / "tracks_features.csv"
FOLDER_OUTPUT = BASE_DIR / "data_clean"
FILE_OUTPUT = FOLDER_OUTPUT / "tracks_clean.csv"
FILE_SEMENTARA = FOLDER_OUTPUT / "tracks_clean.tmp"

TEMP_SPARK = r"D:\spark_temp"
os.makedirs(TEMP_SPARK, exist_ok=True)

os.environ["TEMP"] = TEMP_SPARK
os.environ["TMP"] = TEMP_SPARK
os.environ["SPARK_LOCAL_DIRS"] = TEMP_SPARK

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = (
    SparkSession.builder
    .appName("PembersihanDatasetSpotify")
    .master("local[*]")
    .config("spark.local.dir", TEMP_SPARK)
    .config("spark.sql.shuffle.partitions", "8")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("ERROR")


def judul(teks):
    print("\n" + "=" * 62)
    print(teks.center(62))
    print("=" * 62)


try:
    # ========================================================
    # 2. VALIDASI DAN PEMBACAAN DATA
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

    kolom_wajib = [
        "id", "name", "album", "album_id", "artists",
        "artist_ids", "track_number", "disc_number",
        "explicit", "danceability", "energy", "key",
        "loudness", "mode", "speechiness", "acousticness",
        "instrumentalness", "liveness", "valence", "tempo",
        "duration_ms", "time_signature", "year", "release_date"
    ]

    if df.columns != kolom_wajib:
        raise ValueError(
            "Header atau urutan kolom CSV tidak sesuai.\n"
            f"Kolom ditemukan: {df.columns}"
        )

    judul("PEMBERSIHAN DATASET SPOTIFY")

    jumlah_awal = df.count()

    print(f"File input    : {FILE_INPUT.name}")
    print(f"Jumlah baris  : {jumlah_awal:,}")
    print(f"Jumlah kolom  : {len(df.columns)}")

    # ========================================================
    # 3. MEMBERSIHKAN TEKS KOSONG
    # ========================================================
    judul("1. MEMBERSIHKAN NILAI TEKS")

    kolom_teks = [
        "id", "name", "album", "album_id",
        "artists", "artist_ids", "release_date"
    ]

    for c in kolom_teks:
        nilai = F.trim(F.col(c))
        df = df.withColumn(
            c,
            F.when(
                nilai == "",
                F.lit(None).cast("string")
            ).otherwise(nilai)
        )

    print("Spasi di awal/akhir teks dibersihkan.")
    print("Teks kosong diubah menjadi NULL.")

    # ========================================================
    # 4. KONVERSI TIPE DATA
    # ========================================================
    judul("2. KONVERSI TIPE DATA")

    kolom_integer = [
        "track_number", "disc_number",
        "key", "mode", "year", "duration_ms"
    ]

    for c in kolom_integer:
        df = df.withColumn(
            c,
            F.expr(f"try_cast(`{c}` AS INT)")
        )

    df = df.withColumn(
        "time_signature",
        F.expr("try_cast(time_signature AS DOUBLE)")
    )

    kolom_double = [
        "danceability", "energy", "loudness",
        "speechiness", "acousticness",
        "instrumentalness", "liveness", "valence", "tempo"
    ]

    for c in kolom_double:
        df = df.withColumn(
            c,
            F.expr(f"try_cast(`{c}` AS DOUBLE)")
        )

    df = df.withColumn(
        "explicit",
        F.when(
            F.lower(F.trim(F.col("explicit"))).isin("true", "1"),
            F.lit(True)
        ).when(
            F.lower(F.trim(F.col("explicit"))).isin("false", "0"),
            F.lit(False)
        ).otherwise(F.lit(None).cast("boolean"))
    )

    print("Konversi numerik dan boolean selesai.")

    # ========================================================
    # 5. PEMERIKSAAN NILAI KOSONG
    # ========================================================
    judul("3. PEMERIKSAAN NILAI KOSONG")

    kolom_cek = [
        "id", "name", "album", "artists", "explicit",
        "danceability", "energy", "loudness",
        "speechiness", "acousticness", "instrumentalness",
        "liveness", "valence", "tempo", "duration_ms",
        "time_signature", "year"
    ]

    hasil_null = df.agg(*[
        F.sum(
            F.when(F.col(c).isNull(), 1).otherwise(0)
        ).alias(c)
        for c in kolom_cek
    ]).first().asDict()

    ada_null = False
    print(f"{'NAMA KOLOM':<25}{'JUMLAH NULL':>15}")
    print("-" * 40)

    for c in kolom_cek:
        jumlah = hasil_null[c] or 0
        if jumlah > 0:
            print(f"{c:<25}{jumlah:>15,}")
            ada_null = True

    if not ada_null:
        print("Tidak ditemukan NULL pada kolom yang diperiksa.")

    # ========================================================
    # 6. VALIDASI DATA
    # ========================================================
    judul("4. VALIDASI DATA")

    fitur_0_1 = [
        "danceability", "energy", "speechiness",
        "acousticness", "instrumentalness",
        "liveness", "valence"
    ]

    kondisi_valid = F.col("id").isNotNull()

    for c in fitur_0_1:
        kondisi_valid = (
            kondisi_valid
            & F.col(c).between(0, 1)
        )

    kondisi_valid = (
        kondisi_valid
        & F.col("tempo").isNotNull()
        & (F.col("tempo") > 0)
        & F.col("duration_ms").isNotNull()
        & (F.col("duration_ms") > 0)
        & F.col("loudness").isNotNull()
    )

    df_valid = df.filter(kondisi_valid)

    jumlah_setelah_validasi = df_valid.count()
    jumlah_tidak_valid = jumlah_awal - jumlah_setelah_validasi

    print(f"Jumlah baris sebelum validasi : {jumlah_awal:,}")
    print(f"Jumlah baris valid            : {jumlah_setelah_validasi:,}")
    print(f"Jumlah baris tidak valid      : {jumlah_tidak_valid:,}")

    # ========================================================
    # 7. MENGHAPUS DUPLIKASI ID
    # ========================================================
    judul("5. MENGHAPUS DUPLIKASI ID")

    df_bersih = df_valid.dropDuplicates(["id"])

    jumlah_setelah_duplikat = df_bersih.count()
    jumlah_duplikat = (
        jumlah_setelah_validasi - jumlah_setelah_duplikat
    )

    print(
        f"Baris sebelum hapus duplikat : "
        f"{jumlah_setelah_validasi:,}"
    )
    print(
        f"Baris setelah hapus duplikat : "
        f"{jumlah_setelah_duplikat:,}"
    )
    print(f"ID duplikat yang dihapus     : {jumlah_duplikat:,}")

    # ========================================================
    # 8. PEMBULATAN FITUR AUDIO
    # ========================================================
    judul("6. PEMBULATAN FITUR AUDIO")

    kolom_bulat = [
        "danceability", "energy", "loudness",
        "speechiness", "acousticness",
        "instrumentalness", "liveness", "valence", "tempo"
    ]

    for c in kolom_bulat:
        df_bersih = df_bersih.withColumn(
            c, F.round(F.col(c), 3)
        )

    jumlah_akhir = df_bersih.count()

    print("Pembulatan fitur audio menjadi 3 angka desimal selesai.")

    # ========================================================
    # 9. MENYIMPAN DATASET BERSIH
    # ========================================================
    judul("7. MENYIMPAN DATASET BERSIH")

    FOLDER_OUTPUT.mkdir(parents=True, exist_ok=True)

    if FILE_SEMENTARA.exists():
        FILE_SEMENTARA.unlink()

    try:
        with open(
            FILE_SEMENTARA,
            "w",
            newline="",
            encoding="utf-8-sig"
        ) as file:
            writer = csv.writer(file)
            writer.writerow(df_bersih.columns)

            for row in df_bersih.toLocalIterator():
                writer.writerow(row)

        # File lama diganti setelah file sementara selesai ditulis.
        os.replace(FILE_SEMENTARA, FILE_OUTPUT)

    except Exception:
        if FILE_SEMENTARA.exists():
            FILE_SEMENTARA.unlink()
        raise

    print("Penyimpanan berhasil.")
    print(f"Lokasi hasil: {FILE_OUTPUT}")

    # ========================================================
    # 10. LAPORAN AKHIR
    # ========================================================
    judul("LAPORAN AKHIR PEMBERSIHAN")

    print(f"{'Jumlah baris awal':<32}: {jumlah_awal:>12,}")
    print(
        f"{'Baris tidak lolos validasi':<32}: "
        f"{jumlah_tidak_valid:>12,}"
    )
    print(
        f"{'ID duplikat yang dihapus':<32}: "
        f"{jumlah_duplikat:>12,}"
    )
    print(f"{'Jumlah baris akhir':<32}: {jumlah_akhir:>12,}")
    print(f"{'Jumlah kolom':<32}: {len(df_bersih.columns):>12}")
    print(f"{'File hasil':<32}: {FILE_OUTPUT.name}")
    print(f"{'Folder hasil':<32}: {FOLDER_OUTPUT}")

    judul("CONTOH 10 BARIS DATA BERSIH")

    df_bersih.select(
        "name", "artists", "explicit",
        "danceability", "energy", "tempo", "year"
    ).show(10, truncate=25, vertical=False)

    print("\nPEMBERSIHAN DATASET SELESAI")

except Exception as e:
    print("\nPROSES PEMBERSIHAN GAGAL")
    print(f"Jenis error : {type(e).__name__}")
    print(f"Pesan       : {str(e)[:1200]}")
    raise

finally:
    spark.stop()
