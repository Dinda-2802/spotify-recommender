
import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

database_url = URL.create(
    drivername="postgresql+psycopg2",
    username="postgres",
    password=os.getenv("PGPASSWORD"),
    host="localhost",
    port=5432,
    database="spotify_postgresql."
)

try:
    engine = create_engine(database_url)

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        print("KONEKSI POSTGRESQL BERHASIL!")

    engine.dispose()

except Exception as e:
    print("KONEKSI POSTGRESQL GAGAL!")
    print(e)
