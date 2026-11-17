
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from dotenv import load_dotenv
import os

# Lokasi folder hasil clustering
BASE_DIR = Path(__file__).resolve().parent
folder = BASE_DIR / "hasil_clustering" / "lagu_dengan_cluster"

# Membaca seluruh file CSV
files = sorted(folder.glob("part-*.csv"))

if not files:
    raise FileNotFoundError("File hasil clustering tidak ditemukan!")

data_list = []

for file in files:
    print("Membaca:", file.name)
    df = pd.read_csv(file)
    data_list.append(df)

# Menggabungkan data
data = pd.concat(data_list, ignore_index=True)

# Membersihkan nama kolom
data.columns = data.columns.str.strip().str.replace("\ufeff", "")

print("Total data:", len(data))
print("Kolom awal:", data.columns.tolist())

# Menyesuaikan nama kolom
data = data.rename(columns={
    "id": "track_id",
    "name": "track_name"
})

# Validasi
assert "track_id" in data.columns, "Kolom track_id tidak ditemukan!"
assert "track_name" in data.columns, "Kolom track_name tidak ditemukan!"
assert "cluster" in data.columns, "Kolom cluster tidak ditemukan!"

# Memeriksa duplikasi
if data["track_id"].duplicated().any():
    raise ValueError("Terdapat track_id duplikat!")

print("Validasi berhasil!")
print("Jumlah data:", len(data))

# Koneksi PostgreSQL
load_dotenv()

connection_url = URL.create(
    drivername="postgresql+psycopg2",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    database=os.getenv("DB_NAME")
)

engine = create_engine(connection_url)

# Tes koneksi PostgreSQL
try:
    with engine.connect() as conn:
        print("BERHASIL TERHUBUNG KE POSTGRESQL!")
except Exception as e:
    print("KONEKSI GAGAL:", e)
    raise

# Import ke PostgreSQL
data.to_sql(
    "tracks_clustered",
    engine,
    schema="public",
    if_exists="append",
    index=False,
    chunksize=5000,
    method="multi"
)

print("Import hasil clustering berhasil!")

engine.dispose()
