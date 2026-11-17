
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Tes koneksi backend
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "success",
        "message": "Backend Spotify Python berhasil terhubung!"
    })

# Tes pengiriman data dari frontend
@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.get_json()

    track_id = data.get("track_id")

    return jsonify({
        "status": "success",
        "track_id": track_id,
        "message": "Data berhasil diterima backend Python"
    })

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
