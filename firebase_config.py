
import firebase_admin
from firebase_admin import credentials, firestore

# Membaca file kredensial Firebase
cred = credentials.Certificate(
    "credentials/firebase-service-account.json"
)

# Menghubungkan Python ke Firebase
firebase_admin.initialize_app(cred)

# Mengakses Cloud Firestore
db = firestore.client()

print("Berhasil terhubung ke Firebase Firestore!")
