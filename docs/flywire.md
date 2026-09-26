# Integrasi konektom FlyWire

Catatan teknis untuk menyambungkan viewer anatomi ini dengan data otak
*Drosophila melanogaster* dari proyek **FlyWire**.

---

## 1. Apa itu FlyWire

Rekonstruksi lengkap otak *Drosophila melanogaster* **betina dewasa** dari
citra mikroskop elektron (volume FAFB). Diterbitkan di *Nature* pada Oktober
2024 — otak hewan dewasa pertama yang dipetakan tuntas sampai tingkat sinapsis.

| | |
|---|---|
| Neuron | **139.255** (versi 783) |
| Sinapsis | ±54,5 juta |
| Wilayah neuropil | ±78 |
| Cakupan | **otak saja** — tali saraf ventral tidak termasuk |
| Portal | `codex.flywire.ai` (Codex) |

**Sitasi:** Dorkenwald dkk. (2024), *Neuronal wiring diagram of an adult brain*,
Nature; dan Schlegel dkk. (2024), *Whole-brain annotation and multi-connectome
cell typing of Drosophila*, Nature.

> **Lisensi.** Data FlyWire dirilis untuk penggunaan **non-komersial** dengan
> kewajiban sitasi. Periksa syarat terkini di Codex sebelum menerbitkan apa
> pun yang memuat data ini — termasuk tangkapan layar viewer ini.

### Yang tidak tercakup

Tali saraf ventral (VNC) — yang di model ini diberi nama *Ganglion Toraks* —
**bukan** bagian FlyWire. Ia dipetakan terpisah:

- **MANC** — *Male Adult Nerve Cord* (Janelia)
- **FANC** — *Female Adult Nerve Cord*

Untuk sistem saraf lengkap, kedua sumber harus digabung. Titik sambungnya
adalah ±1.300 neuron yang melewati leher (lihat bagian *Konektif Serviks*).

---

## 2. Dua mode di viewer

Lapisan **Neuropil otak** (kotak centang di bilah bawah, pintasan `B`)
berjalan dalam salah satu dari dua mode:

**a. Skematis** — bawaan, selalu aktif.
15 wilayah neuropil digambar sebagai bentuk sederhana pada posisi anatomis
yang benar. Berguna untuk orientasi dan pengajaran. **Bukan geometri FlyWire.**

**b. Mesh FlyWire** — otomatis menggantikan mode skematis begitu
`data/neuropil.json` tersedia dan halaman disajikan lewat HTTP.
Konsol akan mencetak `[konektom] mesh FlyWire dimuat: …`.
Berisi **43 wilayah** (78 mesh kiri+kanan), jauh lebih lengkap daripada
15 wilayah mode skematis.

Kalau berkas tidak ada (atau halaman dibuka lewat `file://`), pemuatan gagal
tanpa suara dan mode skematis tetap dipakai.

---

## 3. Cara membuat `data/neuropil.json`

### Cara termudah — tanpa akun sama sekali

Mesh 78 permukaan neuropil (43 wilayah, kiri+kanan), **sudah ditransformasi ke
ruang FlyWire**, ternyata ikut dibundel di dalam paket Python `fafbseg` sebagai
`fafbseg/data/JFRC2NP.surf.fw.zip` (±1 MB). Jadi tidak perlu login, tidak perlu
menyetujui apa pun, tidak perlu mengunduh dari portal.

Ambil paketnya **tanpa dependensi** (7,9 MB, bukan ratusan MB), lalu keluarkan
berkas PLY-nya:

```bash
pip download fafbseg --no-deps -d /tmp/fafb
python - <<'EOF'
import zipfile, io, os
out = 'neuropil_ply'; os.makedirs(out, exist_ok=True)
whl = [f for f in os.listdir('/tmp/fafb') if f.endswith('.whl')][0]
z = zipfile.ZipFile(os.path.join('/tmp/fafb', whl))
inner = zipfile.ZipFile(io.BytesIO(z.read('fafbseg/data/JFRC2NP.surf.fw.zip')))
n = 0
for name in inner.namelist():
    if '__MACOSX' in name or not name.lower().endswith('.ply'):
        continue
    open(os.path.join(out, os.path.basename(name)), 'wb').write(inner.read(name))
    n += 1
print('diekstrak', n, 'berkas PLY')
EOF
```

Hasilnya `AL_L.ply`, `AL_R.ply`, `ME_L.ply`, … — persis format nama yang
dibutuhkan skrip konversi. Lalu:

```bash
pip install trimesh numpy
python tools/fetch_flywire.py --from-dir neuropil_ply
node serve.js        # buka http://localhost:5173, centang "Neuropil otak"
```

> **Sumbu sudah terverifikasi.** Bawaan `--axes "x,-y,-z"` diuji terhadap 11
> syarat anatomi (lamina paling lateral, ganglion gnatal paling ventral, kaliks
> lebih dorsal daripada lobus antena, sisi R di +X, dst.) dan semuanya lolos.
> Untuk sumber mesh ini Anda tidak perlu menyetel apa pun.

### Cara lain (kalau butuh mesh versi lain)

- **Codex** (`codex.flywire.ai`) — perlu login. Menurut FAQ-nya, Codex
  **tidak** menyajikan mesh 3D langsung; halaman sel bisa menautkan unduhan
  skeleton SWC. Untuk mesh, FAQ mengarahkan ke paket `meshparty`.
- **Virtual Fly Brain** (`virtualflybrain.org`) — mesh per wilayah, terbuka.
- **navis-flybrains** / **natverse** — paket yang memuat mesh templat beserta
  transformasi antarruang.
- **neuPrint** (`neuprint.janelia.org`) — mesh ROI hemibrain; dataset berbeda,
  penamaan wilayahnya sama.

Untuk sumber selain yang di atas, satuan dan orientasi bisa berbeda. Skrip
mendeteksi satuan sendiri (nm/µm/mm); orientasi periksa dengan patokan ini:

- **Lamina** paling lateral, tepat di balik mata majemuk.
- **Lobus antena** di depan-bawah, dekat pangkal antena.
- **Kaliks badan jamur** di belakang-atas.
- **Ganglion gnatal** paling bawah, di atas probosis.

Kalau meleset, ulangi dengan `--axes` berbeda (`"x,-y,z"`, `"x,-z,-y"`,
`"-x,-y,-z"`, …).

### Catatan tentang pemusatan

Sumbu X dipusatkan pada **garis tengah anatomis** — titik berat wilayah tak
berpasangan (EB, FB, PB, GNG, …) — bukan pada titik tengah kotak pembatas.
Himpunan mesh jarang simetris sempurna; memakai kotak pembatas membuat seluruh
otak bergeser puluhan mikrometer ke samping.

Pada mesh JFRC2NP bawaan `fafbseg`, semua pasangan kiri/kanan simetris dalam
±0,01 mm **kecuali lamina**, yang sisi kirinya menjulur ±0,08 mm lebih jauh.
Itu asimetri di data sumbernya sendiri (lamina adalah neuropil terluar dan
tertipis, paling sering terpotong tidak rata pada otak templat) — dibiarkan apa
adanya, tidak "dirapikan", supaya data tetap jujur.

---

## 4. Transformasi koordinat

Model bekerja dalam dua ruang:

```
satuan sasis  ──(× SPEC.scale = 0.37)──>  milimeter dunia
```

Geometri di `js/fly.js` ditulis dalam satuan sasis; seluruh root diskalakan
sekali di akhir `build()`. Rumus pemindahan koordinat FlyWire:

```
mm      = koordinat_sumber × faktor_satuan        (nm → 1e-6, µm → 1e-3)
mm      = petakan_sumbu(mm)                       (--axes)
sasis   = (mm − pusat_otak_mm) / 0.37 + (0, 0.16, 2.62)
```

Konstanta acuannya diekspor dari `js/fly.js`:

```js
FLY.SCALE          // 0.37
FLY.BRAIN.center   // (0, 0.16, 2.62) satuan sasis
FLY.BRAIN.widthMm  // 0.60 — lebar otak sesungguhnya
```

Nilai yang sama juga ada di bagian atas `tools/fetch_flywire.py`
(`CHASSIS_SCALE`, `BRAIN_CENTER`). **Kalau salah satu diubah, ubah keduanya.**

Ukuran otak dipertahankan apa adanya — tidak diregangkan agar muat. Otak
asli ±0,60 mm sementara kepala model ±0,78 mm, jadi memang pas.

---

## 5. Format `data/neuropil.json`

```jsonc
{
  "source": "FlyWire / Codex",
  "generated": "2026-09-25T10:00:00",
  "space": "chassis",          // wajib bernilai "chassis", kalau tidak ditolak
  "chassisScale": 0.37,
  "brainCenter": [0, 0.16, 2.62],
  "axes": "x,-z,-y",
  "regions": [
    {
      "id": "np-medula",        // cocokkan dengan kunci di anatomy-data.js
      "abbr": "ME",             // agar panel keterangan ikut muncul
      "nama": "Medula (kanan)",
      "side": "R",
      "color": "#29b6f6",
      "positions": [x, y, z, …],  // float datar, satuan sasis
      "indices":   [i, j, k, …]   // integer datar, segitiga
    }
  ]
}
```

Wilayah dengan `id` sama (kiri & kanan) digabungkan menjadi satu bagian yang
dapat dipilih. `id` yang tidak ada di `anatomy-data.js` tetap tampil, hanya
tanpa teks keterangan.

Pemuatnya ada di `js/connectome.js` → `CONNECTOME.loadReal()`.

---

## 6. Skeleton neuron (`data/neurons.json`)

Lapisan **Sel saraf** (pintasan `N`) bekerja dengan pola yang sama.

**Skematis** (bawaan): 7 berkas serabut digambar mengikuti jalur yang memang
diketahui benar — termasuk peta retinotopik 1:1 dari tiap faset mata ke lamina
(ditarik dari posisi omatidium yang sebenarnya di model), dua persilangan
khiasma di lobus optik, jalur penciuman, sel Kenyon, lingkar kompas E-PG, dan
neuron desenden. **Bentuk tiap selnya disederhanakan** — ini bukan rekonstruksi.

**Skeleton asli**: unduh berkas **SWC** dari Codex, susun per berkas serabut,
lalu:

```bash
python tools/fetch_flywire.py --from-dir <mesh neuropil>     # 1. WAJIB DULU
python tools/fetch_neurons.py  --from-dir <folder swc>       # 2. baru neuron
```

> **Urutannya penting.** `fetch_flywire.py` menyimpan transformasi koordinat
> yang dipakainya ke dalam `data/neuropil.json`. `fetch_neurons.py` membacanya
> kembali lewat `--align-to` supaya neuron duduk **pas** di dalam neuropil.
> Kalau dijalankan terbalik, neuron akan bergeser terhadap wilayahnya.

Susunan folder yang dikenali:

```
skeleton/
  nrn-kenyon/     kc_0001.swc  kc_0002.swc  …
  nrn-epg/        epg_01.swc   …
  nrn-pn-olfaktori/ …
```

Nama subfolder menjadi id berkas serabut; padankan dengan kunci di
`js/anatomy-data.js` agar panel keterangan ikut muncul. Berkas SWC datar juga
bisa, dengan `--bundle <id>`.

### Format `data/neurons.json`

```jsonc
{
  "source": "FlyWire / Codex (SWC)",
  "space": "chassis",
  "bundles": [
    {
      "id": "nrn-kenyon",
      "nama": "Sel Kenyon",
      "color": "#e08a1e", "color2": "#d1401c",   // gradasi pangkal -> ujung
      "opacity": 0.55,
      "paths": [ [x,y,z, x,y,z, …], … ]          // satu entri = satu ruas cabang
    }
  ]
}
```

Digambar sebagai `THREE.LineSegments` — satu geometri gabungan per berkas.
Ratusan ribu ruas masih ringan; di atas ±400.000 ruas mulai terasa, kurangi
jumlah neuron atau turunkan `--max-points`.

Pemuatnya ada di `js/neurons.js` → `NEURONS.loadReal()`.

### Akson fotoreseptor tetap skematis — dan memang seharusnya

FlyWire memindai **otak saja**; retina berada di luar volume pindaiannya.
Jadi akson fotoreseptor **tidak akan pernah ada** di data asli, berapa pun
banyak neuron yang Anda ambil.

Karena itu pemuatnya dirancang agar **berkas skematis yang tidak punya
padanan di data asli tetap dipertahankan**. Saat `data/neurons.json` dimuat,
konsol akan mencetak misalnya:

```
[neuron] skeleton FlyWire dimuat: ... | berkas skematis dipertahankan: nrn-fotoreseptor
```

Hasilnya: 780 serabut yang ditarik dari posisi faset sungguhan tetap terlihat,
berdampingan dengan neuron FlyWire asli di dalam otak. Berkas skematis lain
(khiasma, sel Kenyon, dst.) diganti data asli begitu tersedia.

---

## 7. Langkah berikutnya

Sudah selesai: **wilayah neuropil** dan **bentuk sel saraf** (keduanya
skematis, siap diganti data asli). Yang masih terbuka:

**Tabel konektivitas.**
Pilih satu neuron, sorot mitra pra/pascasinapsnya. Butuh tabel tepi
(edge list) terpisah, bukan geometri — ringan, dan bisa dipadukan dengan
panel keterangan yang sudah ada.

**Seluruh 139k neuron.**
Perlu streaming, LOD, dan pemuatan bertahap. Proyek tersendiri.

**Simulasi.**
Menjalankan sinyal melewati konektom, bukan sekadar menggambarnya. Sudah ada
penelitian yang melakukannya dengan data FlyWire. Ini bukan "tambah satu
lapisan lagi" — cara kerjanya berbeda sama sekali dan sebaiknya jadi proyek
terpisah di atas tabel konektivitas.

Alat Python yang relevan: `caveclient`, `fafbseg`, `navis`, `cloud-volume`.
