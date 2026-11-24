
from firebase_admin import firestore
from firebase_config import db

# Contoh data profil pengguna
data_pengguna = {
    "nama": "User Spotify",
    "email": "user@example.com",
    "preferensi_musik": ["Pop", "Jazz", "Rock"],
    "created_at": firestore.SERVER_TIMESTAMP
}

# Menyimpan data ke Firestore
db.collection("users").document("user_001").set(data_pengguna)

print("Data profil pengguna berhasil disimpan!")
