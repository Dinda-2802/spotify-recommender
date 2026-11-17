import os
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# =====================================================
# 1. KONFIGURASI DATABASE
# =====================================================

DB_USER = "postgres"
DB_PASSWORD = "pSiakl4_?"
DB_HOST = "localhost"
DB_PORT = 5432
DB_NAME = "spotify_recommender"
CSV_PATH = "data_clean/tracks_clean.csv"
CHUNK_SIZE = 10000
if not DB_PASSWORD:
    raise ValueError(
        "Password PostgreSQL belum diatur. "
        "Atur environment variable PGPASSWORD."
    )
# URL.create menangani karakter khusus pada password
# seperti @, ?, #, dan karakter lainnya.
database_url = URL.create(
    drivername="postgresql+psycopg2",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME
)
engine = create_engine(
    database_url,
    pool_pre_ping=True
)

# =====================================================
# 2. PEMETAAN KOLOM CSV
# =====================================================

column_mapping = {
    "id": "track_id",
    "name": "track_name",
    "album": "album_name",
    "album_id": "album_id",
    "artists": "artists",
    "artist_ids": "artist_ids",
    "track_number": "track_number",
    "disc_number": "disc_number",
    "explicit": "explicit",
    "danceability": "danceability",
    "energy": "energy",
    "key": "key",
    "loudness": "loudness",
    "mode": "mode",
    "speechiness": "speechiness",
    "acousticness": "acousticness",
    "instrumentalness": "instrumentalness",
    "liveness": "liveness",
    "valence": "valence",
    "tempo": "tempo",
    "duration_ms": "duration_ms",
    "time_signature": "time_signature",
    "year": "year",
    "release_date": "release_date"
}
# Urutan kolom sesuai tabel PostgreSQL
db_columns = list(column_mapping.values())
integer_columns = [
    "track_number",
    "disc_number",
    "key",
    "mode",
    "duration_ms",
    "year"
]
float_columns = [
    "danceability",
    "energy",
    "loudness",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo",
    "time_signature"
]

# =====================================================
# 3. FUNGSI PEMBERSIHAN DATA
# =====================================================

def clean_chunk(chunk):
    # Ubah nama kolom CSV
    chunk = chunk.rename(columns=column_mapping)
    # Pastikan seluruh kolom tersedia
    missing_columns = [
        col for col in db_columns
        if col not in chunk.columns
    ]
    if missing_columns:
        raise ValueError(
            f"Kolom CSV tidak ditemukan: {missing_columns}"
        )
    # Ambil hanya kolom yang dibutuhkan
    chunk = chunk[db_columns].copy()
    # Bersihkan ID kosong
    chunk["track_id"] = (
        chunk["track_id"]
        .astype("string")
        .str.strip()
    )
    chunk = chunk.dropna(subset=["track_id"])
    chunk = chunk[
        chunk["track_id"] != ""
    ].copy()
    # Hilangkan duplikasi ID dalam satu chunk
    chunk = chunk.drop_duplicates(
        subset=["track_id"]
    )
    # Konversi kolom numerik integer
    for col in integer_columns:
        values = pd.to_numeric(
            chunk[col],
            errors="coerce"
        )
        chunk[col] = values.astype("Int64")
    # Konversi kolom numerik desimal
    for col in float_columns:
        chunk[col] = pd.to_numeric(
            chunk[col],
            errors="coerce"
        )
    # Pastikan explicit berupa boolean
    chunk["explicit"] = chunk["explicit"].map({
        True: True,
        False: False,
        "True": True,
        "False": False,
        "true": True,
        "false": False
    })
    # ==============================================
    # Pembersihan RELEASE DATE
    # ==============================================
    dates = (
        chunk["release_date"]
        .astype("string")
        .str.strip()
    )
    # Deteksi tahun 0000 secara eksplisit
    year_prefix = dates.str.extract(
        r"^(\d{4})",
        expand=False
    )
    invalid_year = year_prefix.eq("0000").fillna(False)
    dates = dates.mask(invalid_year)
    # Parse tanggal; tanggal tidak valid menjadi NaT
    parsed_dates = pd.to_datetime(
        dates,
        format="mixed",
        errors="coerce"
    )
    # Simpan sebagai string YYYY-MM-DD.
    # Hindari konversi ke Python datetime.date.
    chunk["release_date"] = (
        parsed_dates.dt.strftime("%Y-%m-%d")
    )
    # Pastikan NaT menjadi NULL saat masuk PostgreSQL
    chunk["release_date"] = (
        chunk["release_date"].where(
            parsed_dates.notna(),
            None
        )
    )
    return chunk

# =====================================================
# 4. FUNGSI IMPOR PER CHUNK
# =====================================================

def import_chunk(chunk):
    # Bersihkan data
    chunk = clean_chunk(chunk)
    if chunk.empty:
        return 0, 0
    inserted = 0
    # Gunakan transaksi agar setiap chunk aman
    with engine.begin() as conn:
        # Buat tabel sementara
        chunk.to_sql(
            "tracks_import_stage",
            conn,
            if_exists="replace",
            index=False,
            chunksize=1000,
            method="multi"
        )
        # Masukkan hanya ID yang belum ada
        result = conn.execute(text("""
            INSERT INTO tracks (
                track_id,
                track_name,
                album_name,
                album_id,
                artists,
                artist_ids,
                track_number,
                disc_number,
                explicit,
                danceability,
                energy,
                key,
                loudness,
                mode,
                speechiness,
                acousticness,
                instrumentalness,
                liveness,
                valence,
                tempo,
                duration_ms,
                time_signature,
                year,
                release_date
            )
            SELECT
                track_id,
                track_name,
                album_name,
                album_id,
                artists,
                artist_ids,
                track_number,
                disc_number,
                explicit,
                danceability,
                energy,
                key,
                loudness,
                mode,
                speechiness,
                acousticness,
                instrumentalness,
                liveness,
                valence,
                tempo,
                duration_ms,
                time_signature,
                year,
                NULLIF(BTRIM(release_date), '')::DATE AS release_date
            FROM tracks_import_stage
            ON CONFLICT (track_id) DO NOTHING
        """))
        inserted = result.rowcount
        # Hapus tabel sementara
        conn.execute(text("""
            DROP TABLE tracks_import_stage
        """))
    return len(chunk), inserted

# =====================================================
# 5. PROSES IMPOR SELURUH CSV
# =====================================================

def main():
    print("=" * 60)
    print("IMPORT DATA SPOTIFY KE POSTGRESQL")
    print("=" * 60)
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"File CSV tidak ditemukan: {CSV_PATH}"
        )
    # Pastikan tabel tujuan tersedia
    with engine.connect() as conn:
        conn.execute(text("""
            SELECT 1 FROM tracks LIMIT 1
        """))
    print("Koneksi PostgreSQL berhasil.")
    print("Membaca dataset CSV...")
    print(f"Ukuran chunk: {CHUNK_SIZE:,} baris")
    print()
    total_read = 0
    total_inserted = 0
    total_skipped = 0
    chunk_number = 0
    try:
        reader = pd.read_csv(
            CSV_PATH,
            chunksize=CHUNK_SIZE,
            dtype={
                "id": "string",
                "release_date": "string"
            },
            low_memory=False
        )
        for chunk in reader:
            chunk_number += 1
            processed, inserted = import_chunk(chunk)
            total_read += processed
            total_inserted += inserted
            skipped = processed - inserted
            total_skipped += skipped
            print(
                f"Chunk {chunk_number}: "
                f"dibaca {processed:,} | "
                f"baru dimasukkan {inserted:,} | "
                f"sudah ada {skipped:,}"
            )
        print()
        print("=" * 60)
        print("PROSES IMPOR SELESAI")
        print("=" * 60)
        # Hitung total data sebenarnya di database
        with engine.connect() as conn:
            database_total = conn.execute(
                text("SELECT COUNT(*) FROM tracks")
            ).scalar()
            null_dates = conn.execute(text("""
                SELECT COUNT(*)
                FROM tracks
                WHERE release_date IS NULL
            """)).scalar()
        print(f"Total chunk diproses : {chunk_number:,}")
        print(f"Data dibaca          : {total_read:,}")
        print(f"Data baru dimasukkan : {total_inserted:,}")
        print(f"Data sudah tersedia  : {total_skipped:,}")
        print("-" * 60)
        print(f"TOTAL LAGU DI POSTGRESQL: {database_total:,}")
        print(f"Tanggal kosong/tidak valid: {null_dates:,}")
        print("=" * 60)
    except Exception as error:
        print()
        print("=" * 60)
        print("IMPOR TERHENTI KARENA ERROR")
        print("=" * 60)
        print("Chunk terakhir:", chunk_number)
        print("Pesan error:", error)
        print(
            "Data dari chunk yang sudah berhasil "
            "di-commit tetap tersimpan."
        )
        raise

if __name__ == "__main__":
    try:
        main()
    finally:
        engine.dispose()
