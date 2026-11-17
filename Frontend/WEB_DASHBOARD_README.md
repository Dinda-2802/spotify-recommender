# Spotify Analytics Dashboard

Versi browser menggunakan React, Next.js, Tailwind CSS, dan Route Handlers
server-side. `app.py` tetap disertakan tanpa perubahan algoritma dan dapat
dijalankan sebagai aplikasi desktop terpisah.

## Sumber data

Server dashboard membaca struktur file yang sama dengan aplikasi Python:

```text
data_clean/
└── tracks_clean.csv

hasil_clustering/
└── lagu_dengan_cluster/
    ├── part-00000-....csv
    ├── part-00001-....csv
    └── ...

hasil_evaluasi/
├── k_selection.csv
├── ringkasan_evaluasi.csv
└── detail_query.csv
```

Semua file `part-*.csv` dibaca dan digabung. Apabila file tersebut belum
tersedia, preview browser menampilkan data demo deterministik dengan label
**Preview menggunakan data demo**. Data demo tidak pernah ditampilkan sebagai
hasil dataset asli. Setelah file dataset ditempatkan pada struktur di atas,
gunakan tombol refresh pada header untuk beralih ke data aktual.

## Algoritma rekomendasi

Implementasi server mempertahankan langkah dari `app.py`:

1. Standardisasi sembilan fitur audio menggunakan Z-score.
2. Normalisasi panjang vektor fitur.
3. Cosine similarity melalui perkalian vektor.
4. Pengecualian lagu yang sama berdasarkan kombinasi judul dan artis.
5. Pengurutan nilai similarity tertinggi.
6. Mode seluruh katalog atau hanya cluster lagu awal.

## Endpoint

- `GET /api/spotify/overview`
- `GET /api/spotify/search?q=...`
- `GET /api/spotify/cluster?cluster=...&seed=...`
- `POST /api/spotify/recommend`
- `GET /api/spotify/evaluation`
- `GET /api/spotify/evaluation?detail=1`

## Menjalankan

Dashboard browser:

```bash
pnpm install
pnpm dev
```

Aplikasi desktop Python:

```bash
python -m venv .venv
pip install -r requirements.txt
python app.py
```
