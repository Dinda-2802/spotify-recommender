
import os
import csv
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FOLDER_CSV = os.path.join(
    BASE_DIR, "hasil_clustering", "lagu_dengan_cluster"
)
OUTPUT_FILE = os.path.join(
    BASE_DIR, "hasil_clustering", "profil_cluster.csv"
)

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

# Akumulasi jumlah dan total nilai fitur tiap cluster.
statistik = defaultdict(
    lambda: {
        "jumlah": 0,
        "total": {fitur: 0.0 for fitur in FITUR_AUDIO}
    }
)

print("Membaca CSV hasil clustering...")

file_csv = [
    nama for nama in os.listdir(FOLDER_CSV)
    if nama.lower().endswith(".csv")
    and nama.lower().startswith("part-")
]

if not file_csv:
    raise FileNotFoundError(
        f"Tidak ditemukan file part-*.csv di {FOLDER_CSV}"
    )

for nama in file_csv:
    path = os.path.join(FOLDER_CSV, nama)
    print("Memproses:", nama)

    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            try:
                cluster = int(float(row["cluster"]))
                nilai = {
                    fitur: float(row[fitur])
                    for fitur in FITUR_AUDIO
                }
            except (ValueError, TypeError, KeyError):
                continue

            statistik[cluster]["jumlah"] += 1

            for fitur in FITUR_AUDIO:
                statistik[cluster]["total"][fitur] += nilai[fitur]

print("Menyimpan profil cluster...")

with open(
    OUTPUT_FILE, "w", newline="", encoding="utf-8-sig"
) as f:
    writer = csv.writer(f)
    writer.writerow(["cluster", "jumlah_lagu"] + FITUR_AUDIO)

    for cluster in sorted(statistik):
        data = statistik[cluster]
        jumlah = data["jumlah"]

        rata_rata = [
            round(data["total"][fitur] / jumlah, 4)
            for fitur in FITUR_AUDIO
        ]

        writer.writerow([cluster, jumlah] + rata_rata)

print("\nPROFIL CLUSTER SELESAI")
print("File hasil:", OUTPUT_FILE)
print("\nRingkasan:")

for cluster in sorted(statistik):
    data = statistik[cluster]
    print(f"Cluster {cluster}: {data['jumlah']:,} lagu")

print("\nRata-rata fitur:")
with open(OUTPUT_FILE, "r", newline="", encoding="utf-8-sig") as f:
    for row in csv.reader(f):
        print(" | ".join(row))
