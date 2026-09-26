# Menjalankan di server lain

Proyek ini sengaja dipisah menjadi dua bagian dengan kebutuhan yang sangat
berbeda:

| | Kebutuhan | Di mana |
|---|---|---|
| **Viewer** (`index.html`, `css/`, `js/`) | nyaris nol — berkas statis | mana saja, termasuk laptop |
| **Alat data** (`tools/`) | RAM lapang + unduhan besar | server |

Setelah data dibangun sekali, viewer-nya hanya perlu berkas statis. Jadi pola
yang dianjurkan: **rakit dan rancang di laptop, bangun datanya di server,
lalu bawa pulang hasil JSON-nya.**

---

## 1. Kebutuhan server

| | Minimum | Nyaman |
|---|---|---|
| RAM **bebas** | 4 GB | 8 GB+ |
| Disk kosong | 8 GB | 16 GB |
| Python | 3.9+ | 3.12 |
| Node | opsional (hanya untuk `serve.js`) | 18+ |

> **Catatan dari pengalaman nyata.** Mode streaming pernah dicoba di mesin
> Windows 8 GB dengan ~2 GB bebas, dan **dimatikan sistem dua kali** karena
> kehabisan memori. Penyebabnya bukan ukuran total unduhan, melainkan bahwa
> pyarrow meminta **satu kolom parquet penuh (~206 MB) dalam sekali baca**,
> sementara lapisan HTTP, singgahan, dan pembacanya masing-masing memegang
> salinan. Di server, pakai `--local-file` — jauh lebih ringan dan tidak
> punya masalah ini.

---

## 2. Cara tercepat: satu perintah

```bash
git clone <repo-anda> && cd lalat
bash tools/pipeline.sh
```

Variabel lingkungan yang bisa disetel:

```bash
NEURONS=40000 PER_BUNDLE=400 bash tools/pipeline.sh   # lebih banyak neuron
SKIP_SKELETONS=1 bash tools/pipeline.sh               # neuropil saja (~2 menit)
ROW_GROUP=1 bash tools/pipeline.sh                    # kumpulan neuron berbeda
```

Skrip akan:
1. memasang dependensi Python,
2. mengambil 78 mesh neuropil (±8 MB, tanpa akun) dan mengubahnya,
3. mengunduh skeleton 5,4 GB dengan `wget -c` (aman diulang) lalu mengolahnya,
4. menulis `data/neuropil.json` dan `data/neurons.json`.

---

## 3. Langkah manual (kalau ingin kendali penuh)

```bash
pip install -r requirements.txt

# --- neuropil: kecil, cepat, tanpa akun ---
python tools/get_neuropil_meshes.py --out neuropil_ply
python tools/fetch_flywire.py --from-dir neuropil_ply

# --- skeleton: unduh dulu, baru olah ---
wget -c https://zenodo.org/records/10877326/files/sk_lod1_783_healed_ds2.parquet
python tools/fetch_flywire_skeletons.py \
    --local-file sk_lod1_783_healed_ds2.parquet \
    --neurons 40000 --per-bundle 400
```

**Urutannya wajib.** `fetch_flywire.py` menyimpan transformasi koordinat ke
dalam `data/neuropil.json`; `fetch_flywire_skeletons.py` membacanya kembali
agar neuron duduk pas di dalam neuropil. Kalau dibalik, neuronnya melayang di
tempat yang salah.

---

## 4. Docker

```bash
docker build -t anatomi-lalat .

# bangun data (butuh waktu & RAM)
docker run --rm -v "$PWD/data:/app/data" anatomi-lalat bash tools/pipeline.sh

# sajikan viewer
docker run --rm -p 5173:5173 -v "$PWD/data:/app/data" anatomi-lalat
```

Dengan `-v` pada `data/`, hasil olahan tetap ada di mesin host setelah wadah
berhenti.

---

## 5. Membawa pulang hasilnya

Yang perlu dibawa kembali ke laptop hanya dua berkas:

```
data/neuropil.json     ~2,5 MB   (sudah ikut di repo)
data/neurons.json      besarnya tergantung --neurons & --per-bundle
```

```bash
scp server:~/lalat/data/neurons.json data/
```

Setelah itu viewer di laptop langsung memakainya — tidak perlu Python sama
sekali. Buka `index.html`, atau `node serve.js` bila ingin lewat HTTP.

> `data/neurons.json` tidak ikut di-commit (lihat `.gitignore`) karena
> ukurannya tidak menentu. Kalau hasilnya kecil dan ingin disimpan di repo,
> paksa dengan `git add -f data/neurons.json`.

---

## 6. Berapa besar sebaiknya `--neurons`?

`--neurons` menentukan berapa neuron utuh yang dikumpulkan dari satu row
group; `--per-bundle` membatasi berapa yang benar-benar digambar per berkas
serabut.

| `--neurons` | RAM | Hasil |
|---|---|---|
| 2.500 | ~1 GB | ~90 sel Kenyon, ~145 lamina→medula. Cukup untuk melihat pola. |
| 20.000 | ~4 GB | ~740 sel Kenyon, ribuan neuron optik. Nyaman. |
| 34.835 | ~7 GB | seluruh isi row group 0. |

Satu row group memuat ~35.000 neuron. Untuk lebih dari itu, ulangi dengan
`--row-group 1`, `2`, `3` dan gabungkan hasilnya.

**Jangan berlebihan.** Di browser, tiap berkas serabut digambar sebagai
`THREE.LineSegments`. Di atas ~400.000 ruas garis mulai terasa berat. Itulah
gunanya `--per-bundle` — kumpulkan banyak, gambar secukupnya.

---

## 7. Jenis sel langka

Potongan berurutan dari parquet adalah **sampel acak menurut jenis sel**.
Jenis yang berlimpah pasti terwakili; yang langka mungkin tidak:

| Jenis | Total di otak | Dari 20.000 sampel |
|---|---|---|
| Neuron lobus optik | 77.541 | ribuan ✅ |
| Sel Kenyon | 5.177 | ~740 ✅ |
| Neuron desenden | 1.303 | ~190 ✅ |
| **EPG (kompas)** | **47** | **~7** ⚠️ |

Untuk mendapat semua 47 EPG secara pasti, ambil SWC-nya satu per satu dari
`codex.flywire.ai` (perlu akun), simpan di `skeleton/nrn-epg/`, lalu:

```bash
python tools/fetch_neurons.py --from-dir skeleton
```

Skrip itu membaca SWC dan memakai transformasi yang sama, sehingga hasilnya
bisa digabung dengan keluaran jalur Zenodo.

---

## 8. Atribusi

Data FlyWire wajib disitasi. Rinciannya ada di `data/README.txt`.
Mesh neuropil dan skeleton berasal dari sumber terbuka (skeleton: CC BY 4.0).
