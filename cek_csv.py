
import pandas as pd

file_csv = "data_clean/tracks_clean.csv"

df = pd.read_csv(file_csv, nrows=5)

print("DAFTAR KOLOM CSV:")
print(df.columns.tolist())

print("\nTIPE DATA:")
print(df.dtypes)

print("\nCONTOH DATA:")
print(df.head())
