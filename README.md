# 🧠 ML Playground

ML Playground adalah aplikasi visual interaktif full-stack untuk eksplorasi dataset, pelatihan model pohon keputusan (*Decision Tree* & *Random Forest*), visualisasi metrik evaluasi mendalam, interpretasi diagram pohon rekursif, serta inferensi prediksi real-time dengan pelacakan riwayat eksperimen.

---

## 🚀 Tech Stack

- **Backend**: Python 3.12, [FastAPI](https://fastapi.tiangolo.com/), [scikit-learn](https://scikit-learn.org/), [pandas](https://pandas.pydata.org/), [numpy](https://numpy.org/), [joblib](https://joblib.readthedocs.io/), Uvicorn.
- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router), TypeScript, [Tailwind CSS](https://tailwindcss.com/), [Recharts](https://recharts.org/), Lucide React.
- **Testing**: Pytest & FastAPI `TestClient`.

---

## 🛠️ Cara Install & Menjalankan

### 1. Menjalankan Backend (FastAPI)

Pastikan Python 3.10+ sudah terpasang di sistem.

```bash
# 1. Navigasi ke direktori root proyek
cd D:\Dev\Projects\ml-playground

# 2. Buat virtual environment (jika belum ada)
python -m venv .venv

# 3. Aktifkan virtual environment
# Windows (PowerShell/CMD):
.venv\Scripts\activate
# Windows (Git Bash):
source .venv/Scripts/activate
# Linux/macOS:
source .venv/bin/activate

# 4. Install dependensi Python
pip install -r requirements.txt

# 5. Jalankan server backend Uvicorn
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- Server backend aktif di: `http://127.0.0.1:8000`
- Dokumentasi interaktif Swagger UI: `http://127.0.0.1:8000/docs`

### 2. Menjalankan Frontend (Next.js 14)

Buka terminal baru untuk menjalankan frontend:

```bash
# 1. Masuk ke direktori frontend
cd D:\Dev\Projects\ml-playground\frontend

# 2. Install dependensi Node.js
npm install

# 3. Jalankan development server Next.js
npm run dev
```
- Buka antarmuka aplikasi di peramban: `http://localhost:3000`

---

## 📡 Daftar Endpoint API

Semua endpoint didokumentasikan otomatis via Swagger di `/docs`.

| Metode | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/` | Health check & verifikasi backend online |
| `POST` | `/api/datasets/upload` | Upload CSV (maks 10MB), simpan CSV & Parquet, kembalikan info kolom & 10 preview baris |
| `GET` | `/api/datasets/sample/{name}` | Ambil dataset sampel siap pakai (`iris`, `housing`, `energy`) |
| `GET` | `/api/datasets/samples` | Daftar seluruh sampel dataset yang tersedia beserta deskripsinya |
| `GET` | `/api/datasets` | Daftar dataset yang tersimpan di disk |
| `GET` | `/api/datasets/{dataset_id}/download` | Download dataset dalam format `csv` atau `parquet` |
| `POST` | `/api/train` | Latih model (*Random Forest* / *Decision Tree*), evaluasi metrik, confusion matrix, feature importance, & pohon rekursif |
| `GET` | `/api/models` | Daftar seluruh model yang pernah dilatih |
| `GET` | `/api/models/{model_id}` | Detail konfigurasi dan metrik model tertentu |
| `POST` | `/api/predict` | Inferensi prediksi instan berbasis input fitur `{ feature: value }` dan probabilitas kelas |

---

## 📁 Struktur Folder

Proyek menggunakan struktur *flat root* yang bersih:

```text
D:\Dev\Projects\ml-playground\
├── data/                      # Penyimpanan dataset (.csv dan .parquet)
├── models/                    # Penyimpanan model Joblib serial (.joblib)
├── frontend/                  # Aplikasi Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx           # Tahap 1: Ingestion Dataset (Upload & Sampel)
│   │   ├── configure/page.tsx # Tahap 2: Konfigurasi Target, Fitur & Hyperparameter
│   │   ├── results/page.tsx   # Tahap 3: Metrik Evaluasi, Heatmap, Bar Chart, Pohon SVG
│   │   ├── predict/page.tsx   # Tahap 4: Form Prediksi Real-Time & Riwayat Eksperimen
│   │   ├── globals.css        # Tailwind styling & kustomisasi scrollbar
│   │   └── layout.tsx         # Root layout dengan font Inter & Navbar global
│   ├── components/            # Komponen modular (Navbar, ErrorBanner, LoadingSkeleton)
│   ├── lib/
│   │   └── api.ts             # REST client terpusat dengan error handling jaringan
│   ├── types/
│   │   └── index.ts           # Type definitions TypeScript lengkap
│   ├── package.json           # Dependensi frontend (Next, React, Recharts, Lucide)
│   ├── tailwind.config.ts     # Konfigurasi Tailwind CSS
│   └── tsconfig.json          # Konfigurasi TypeScript
├── main.py                    # Aplikasi utama FastAPI & seluruh endpoint
├── requirements.txt           # Dependensi Python backend
├── test_api.py                # 9 unit test suite pytest
├── .gitignore                 # Konfigurasi pengabaian file Git root
└── README.md                  # Dokumentasi proyek
```

---

## 🖼️ Screenshots

### 1. Ingestion Dataset (`/`)
*Upload file CSV drag-and-drop hingga 10MB atau pilih dataset contoh (Iris, Housing, Energy) dengan preview statistik 10 baris pertama.*

```
+--------------------------------------------------------------------------+
|  [Drag & Drop CSV / Sample Datasets]                                     |
|  [Statistics Overview: Total Rows, Columns, Missing Values]              |
|  [10-Row Data Preview Table]                                             |
+--------------------------------------------------------------------------+
```
*(Screenshot placeholder: `docs/screenshots/01-dataset-ingestion.png`)*

### 2. Konfigurasi Model & Hyperparameter (`/configure`)
*Pemilihan target otomatis/manual, checklist fitur, selector model Random Forest vs Decision Tree, serta slider parameter.*

```
+--------------------------------------------------------------------------+
|  Target Column: [ species  v ]     Task Type: (o) Auto ( ) Class ( ) Reg |
|  Select Features: [x] sepal_length  [x] sepal_width  [x] petal_length    |
|  Hyperparameters: Test Size [ 0.2 ], Max Depth [ 5 ], Estimators [ 50 ]  |
|  [ Train Model Button ]                                                  |
+--------------------------------------------------------------------------+
```
*(Screenshot placeholder: `docs/screenshots/02-model-configuration.png`)*

### 3. Dashboard Hasil & Evaluasi (`/results`)
*Kartu metrik (Accuracy/F1/Precision/Recall atau RMSE/MAE/R²), Confusion Matrix heatmap, Recharts Feature Importance, dan visualisasi pohon SVG interaktif.*

```
+--------------------------------------------------------------------------+
|  [ Metric Cards: Accuracy: 96.67% | F1-Score: 0.9666 | Precision: 0.9697 ]|
|  [ Confusion Matrix Heatmap ]      [ Feature Importance Bar Chart ]      |
|  [ Interactive SVG Recursive Decision Tree Visualizer with Pan & Zoom ]   |
+--------------------------------------------------------------------------+
```
*(Screenshot placeholder: `docs/screenshots/03-results-evaluation.png`)*

### 4. Prediksi Real-Time & Riwayat Eksperimen (`/predict`)
*Form otomatis per fitur model, hasil inferensi nilai target, grafik probabilitas kelas, dan sidebar riwayat eksperimen.*

```
+--------------------------------------------------------------------------+
|  Inputs: sepal_length [ 5.1 ]  sepal_width [ 3.5 ] ...                   |
|  [ Predict Button ] -> Output: "setosa" (Prob: 98.4%)                    |
|  Sidebar: [ Experiment History with Restore to Results ]                 |
+--------------------------------------------------------------------------+
```
*(Screenshot placeholder: `docs/screenshots/04-prediction-history.png`)*

---

## 🧪 Pengujian Unit Test

Jalankan test suite backend untuk memastikan seluruh endpoint dan pipeline berfungsi dengan benar:

```bash
# Jalankan pytest
.venv\Scripts\python -m pytest test_api.py -v
```
Semua 9 test mencakup upload CSV, dataset sampel, pelatihan klasifikasi & regresi, deteksi tipe tugas otomatis, ekstraksi pohon hierarkis, serta inferensi prediksi.
