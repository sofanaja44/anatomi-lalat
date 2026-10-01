# Otak lalat yang menggerakkan `alive.html`

Halaman `alive.html` menampilkan lalat yang **seluruh geraknya dibaca dari
simulasi otak** FlyWire, tanpa angka acak. Dokumen ini menjelaskan cara
kerjanya, hasil uji yang mendasarinya, dan batasannya secara jujur.

Dibuat 28 September 2026, diperluas 29–30 September 2026 (giant fiber/kabur,
rasa kaki, visualisasi otak 3D). Menggantikan versi lama (`js/brain-sim.js`,
model laju 1.978 neuron sampel dengan rangsangan acak), yang masih dipakai di
`index.html` (diberi label "Otak (ilustrasi)" di situ, bukan halaman ini).

---

## Ringkas

```
lapar (keadaan tubuh) ──────────────► DNp09 kiri+kanan ────────┐
rasa MULUT (labelum menyentuh tetes/buah):                     │
  gula ─► reseptor gula   pahit ─► reseptor pahit               │  model LIF
rasa KAKI (pretarsus menyentuh, mulut belum) - lgAGRNs ─────────┤  Shiu dkk. 2024
ancaman mendekat (tombol "Kejutkan"), sudut pandang membesar:   │  (≈2.400 neuron,
  LC4 (laju sudut) + LPLC2 (ukuran sudut) ─────────────────────┘  lihat "Potongan otak")
                        │
                        ▼  neuron turun (DN)                      ▼  tubuh
  oDN1 (DNg97)                    -> kecepatan maju
  DNa01/DNa02/DNb02 kanan-kiri    -> belok (hanya saat melangkah)
  MN9 (CB0701)                    -> probosis menjulur, makan
  GF (DNp01)                      -> lompat + kabur terbang
  DNp02/DNp04/DNp11 kanan-kiri    -> arah kabur

ATURAN KEAMANAN: visi(kabur) x rasa(mulut ATAU kaki) TAK PERNAH aktif
bersamaan - kombinasinya membuat otak "macet" di aktivitas tinggi yang
tak reda. Lihat "Yang tidak berhasil" di bawah.
```

Tidak ada `Math.random()` di `js/alive.js` maupun `js/lif-brain.js` (dicek
otomatis di browser: 0 panggilan). Dunia maju dengan langkah tetap 10 ms, jadi
masukan yang sama selalu menghasilkan gerak yang sama. Satu-satunya pemakaian
angka semu-acak adalah tekstur dekoratif (bintik tanah, bentuk daun) lewat
generator berbenih tetap `TEX.rnd`, dan itu tidak menyentuh perilaku.

---

## Model otak

`js/lif-brain.js` menyalin model *leaky integrate-and-fire* dari
[Shiu dkk., Nature 2024](https://www.nature.com/articles/s41586-024-07763-9)
(kode: [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model)):

| Parameter | Nilai |
|---|---|
| potensial istirahat / reset / ambang | -52 / -52 / -45 mV |
| konstanta membran / sinaps | 20 / 5 ms |
| refraktori / tunda sinaps | 2,2 / 1,8 ms |
| bobot per sinaps | 0,275 mV × jumlah sinaps × tanda (+ rangsang / - hambat) |
| langkah integrasi | 0,1 ms, solusi eksak (setara `method='linear'` Brian2) |

Konektom: FlyWire v783 (`Connectivity_783.parquet`, 138.639 neuron,
15 juta baris koneksi) dari repositori yang sama.

**Satu-satunya perbedaan dari model asli** ada pada input. Model asli memakai
`PoissonInput` (acak). Di sini tiap neuron input ditembakkan **teratur** pada
laju yang diminta (akumulator fase), dengan fase awal tetap per neuron dari
indeksnya di otak utuh.

Uji kecocokan (otak utuh, 1 detik) terhadap hasil paper: rangsangan 21 reseptor
gula pada 100 Hz mengaktifkan MN9, dengan 355 neuron ikut aktif. Tanpa input,
otak diam total, sama seperti model asli.

### Potongan otak (`data/brain-lalat.json`)

Model ini tidak punya aktivitas spontan. Neuron yang tidak pernah menembak
tidak pernah mengirim apa pun, jadi cukup disimpan neuron yang **pernah
menembak** untuk input yang dipakai halaman ini.

`tools/build_brain_subnet.cjs` menjalankan otak utuh untuk 275 kombinasi input
(DNp09 × gula × pahit, seperti semula, ditambah DNp09 × visi-kabur pada
berbagai rasio kiri:kanan, dan DNp09 × rasa-kaki), mengumpulkan neuron yang
menembak, lalu menyimpan jaringan di antara neuron-neuron itu saja.

Setelah membangun, skrip memeriksa bahwa potongan otak menghasilkan spike
keluaran yang **identik** dengan otak utuh - PERSIS di titik sapuan
(`hardChecks`, menggagalkan penulisan berkas kalau beda). Kombinasi input DI
LUAR titik sapuan (`softChecks`, cuma informasi) BOLEH sedikit berbeda -
dorongan lapar (DNp09) di produksi memang nilai kontinu dari rasa lapar,
bukan cuma titik sapuan, dan ini sudah teruji tak bermasalah dalam praktik
sejak awal. Neuron yang "terlewat" pada kombinasi di luar sapuan biasanya
hanya menembak sesekali di otak utuh juga - pendekatannya jinak, bukan
kehilangan seluruh jalur perilaku.

Posisi 3D tiap neuron (`chassisX/Y/Z` di `.flywire-cache/brain783/annot.json`,
disalin ke `pos` di berkas potongan) memakai TRANSFORMASI YANG SAMA PERSIS
dengan mesh neuropil (`tools/fetch_flywire_skeletons.py`, dibaca dari
`data/neuropil.json`), supaya titik-titik otak (lihat "Visualisasi otak 3D"
di bawah) duduk pas di kepala. Satuan `soma_x/y/z` & `pos_x/y/z` di
`annot.tsv` DIKALIBRASI EMPIRIS (bukan diasumsikan) terhadap skeleton Zenodo
asli: memilih 12 neuron acak, membandingkan rata-rata titik skeletonnya (nm)
dengan `soma_*`, rasionya ≈4:4:40 - cocok dengan resolusi voxel baku FlyWire.

---

## Hasil uji yang mendasari desain

Semua dijalankan di Node pada otak utuh (`tools/brain-node.cjs`).

### Yang berhasil

| Input | Hasil otak | Rujukan |
|---|---|---|
| DNp09 kiri+kanan 100 Hz | oDN1 dan DNa02 menembak → jalan maju + belok | Sapkal dkk. 2024 |
| DNp09 kanan saja | DNa02 **kanan** menembak (ipsilateral) | Sapkal dkk. 2024 |
| DNp09 + gula 100 Hz | FG menembak, **oDN1 turun ke 0**, MN9 aktif | Sapkal dkk. 2024; Shiu dkk. 2024 |
| gula + pahit 100 Hz | MN9 turun sekitar 95% (menolak makan) | Shiu dkk. 2024 |
| LC4/LPLC2 (visi) 30–100 Hz | **GF (DNp01) menembak** - kuat & langsung | von Reyn & Card dkk. 2019 |
| LC4/LPLC2 satu sisi saja | DNp02/DNp04/DNp11 sisi **itu juga** menembak (ipsilateral) | von Reyn & Card dkk. 2019 |
| rasa kaki (legG) + DNp09, ≤40 Hz | oDN1 & DNa02 ikut menembak (lemah) - kaki bisa "menuntun" jalan | Schlegel dkk. 2024 |

Semua kombinasi DI ATAS (sendiri-sendiri, tak dicampur silang - lihat aturan
di bawah) stabil sampai 100 Hz (rasa kaki: 50 Hz) selama diuji 3–10 detik,
termasuk setelah rangsangan dimatikan (reda ke nol, tak macet).

### Yang tidak berhasil (dan karenanya tidak dipakai / dibatasi)

1. **Penciuman.** Merangsang reseptor bau buah (ORN glomerulus DM1–DM5, VA2,
   VM2, VM7d, DP1m, DL2, VA3, VC3):
   - Antena kiri saja vs kanan saja menghasilkan aktivitas DN yang hampir
     sama (selisih sekitar 5%). Otak tidak bisa menentukan arah bau.
     Kemungkinan karena di lalat asli arah bau dibedakan lewat pelepasan
     neurotransmiter yang asimetris, yang tidak tercatat di peta sinaps.
   - Lobus antena masuk **aktivitas tak terkendali yang tidak berhenti**
     walaupun baunya dihilangkan (~860 ribu spike/detik; lLN1_bc, APL, DPM
     menembak ~400 Hz). Model ini menganggap dopamin dan serotonin sebagai
     perangsang cepat. Mengabaikan neuromodulator dan membetulkan tanda
     neuron GABA yang sudah terbukti belum cukup. Menambah adaptasi laju
     tembak (≥3 mV/spike) menghentikannya, tapi sekaligus melemahkan sirkuit
     berhenti-karena-gula. Karena itu penciuman tidak dipakai.
2. **Rasa terlalu kuat.** Gula ≥150 Hz pada semua 129 reseptor, atau gula dan
   pahit sama-sama kuat, juga memicu aktivitas tak terkendali (~900 ribu
   spike/detik, 10.700 neuron). Karena itu laju input dibatasi 100 Hz.
3. **Visi × rasa bersamaan - TEMUAN 29-09-2026.** LC4/LPLC2 (visi/kabur)
   digabung dengan rasa APA PUN (mulut ATAU kaki, gula atau pahit, dengan
   atau tanpa DNp09) membuat aktivitas **naik ke ~14.000-19.000 spike/200ms
   dan MENETAP di situ selama ≥11,5 detik** setelah kedua rangsangan
   dimatikan - berbeda dari kejang penciuman (yang terus naik), ini
   "terkunci" di satu keadaan aktif tinggi yang stabil (bistabel), tapi
   sama-sama tak reda sendiri. Ditemukan lewat sapuan sistematis
   (`tools/build_brain_subnet.cjs` git history), bukan tebakan. **Karena
   itu `js/alive.js` MEMAKSA visi & rasa saling meniadakan** (lihat
   `brainDrive()`) - kalau ancaman sedang looming, rasa mulut/kaki
   diabaikan tick itu (dan sebaliknya).
4. **Rasa kaki × rasa mulut bersamaan.** Serupa #3: rasa kaki (legG) digabung
   rasa mulut (gula+pahit sekaligus) + DNp09 meledak ke ~179.000 spike/200ms
   dalam <1 detik. `js/alive.js` memberi PRIORITAS ke rasa mulut - rasa kaki
   hanya dipakai kalau mulut BELUM menyentuh apa pun tick itu.
5. **Grooming.** Reseptor bulu tak sampai ke DN pada uji 50 Hz - dihapus dari
   halaman (organ Johnston/angin kini dipakai *tidak langsung* lewat visi,
   bukan lewat modalitas anginnya sendiri).
6. **Asimetri bawaan.** DNp09 kiri hampir tidak merekrut DN apa pun,
   sedangkan DNp09 kanan merekrut DNa02 kanan. Akibatnya lalat yang lapar
   **selalu belok kanan** (berputar) kalau tak ada rasa/ancaman lain. Ini
   sifat peta sinaps + model, bukan bug halaman.

### Bug ditemukan & diperbaiki (29 September 2026)

**Sisi labelum kiri/kanan tertukar.** `labellumTips()` versi 28 September
menandai proyeksi ke sumbu **+X lokal** (yang menurut `fly.js` baris 6 adalah
sisi **KANAN** lalat: `"+X = sisi kanan lalat"`) sebagai `'L'` (kiri) -
tertukar. Akibatnya: kalau lalat mengecap gula HANYA di labelum kanan,
`taste.sugarR` yang seharusnya terisi malah `taste.sugarL` yang terisi, jadi
otak membelokkan lalat ke **arah yang salah** setiap kali makan asimetris
(walau tetap makan dengan benar, karena MN9/oDN1 tak peduli sisi). Diperbaiki
dengan memverifikasi konvensi `fly.js` sendiri (pola `side > 0` = kanan,
konsisten di `buildLeg`/`buildLabelum`/`buildProboscis`) lalu membalik
kondisi. `footTips()` (baru) TIDAK memakai proyeksi geometris seperti ini -
sisinya diambil langsung dari `pivot.userData.side` yang `fly.js` tulis saat
konstruksi kaki, jadi tak mungkin salah dengan cara yang sama.

---

## Yang bukan dari otak

| Bagian | Alasan |
|---|---|
| Rasa lapar | Keadaan tubuh (gula darah). Naik 1/90 per detik, turun saat makan. Deterministik. Menggantikan rangsangan DNp09 buatan di paper Sapkal. |
| Ritme langkah kaki | Dibuat CPG di korda saraf (VNC), yang tidak ada di data otak FlyWire. Frekuensinya mengikuti kecepatan dari otak. |
| Fisika | Dinding cawan dan benda padat menahan badan. Tidak memutar arah. |
| Skala Hz → gerak | Tidak ada kalibrasi biologis yang diketahui. Paper hanya menunjukkan arah efek. Angka di `CAL` (js/alive.js) dipilih supaya gerak terlihat jelas, sehingga bersifat ilustratif. |
| Belok hanya saat melangkah | DN belok bekerja lewat langkah kaki yang asimetris, jadi lalat yang berhenti makan tidak berputar di tempat. |
| Probosis dalam jangkauan | Labelum di model 3D menggantung ~0,8K di atas tanah. Tetes dianggap terkecap kalau labelum tepat di atasnya dan dalam jangkauan julur probosis (1,0K). |
| Kaki menyentuh sumber | Geometri jarak pretarsus (ujung kaki) ke sumber - sama semangatnya dengan deteksi rasa mulut di atas. |
| Sudut pandang & laju membesarnya ancaman | Fisika sungguhan (2·atan(radius/jarak) & turunannya per tick) dari posisi 3D ancaman vs lalat - bukan neural, tapi bukan tebakan juga (dihitung, bukan dianimasikan). |
| Hemifield kiri/kanan (mana yang "melihat" ancaman) | Proyeksi geometris ke sumbu kanan-lokal lalat (identik caranya dengan sisi labelum) - penyederhanaan optik compound-eye, bukan retinotopi penuh. |
| Arah kabur (menjauh) | Geometri: vektor dari ancaman ke lalat, dibekukan sekali saat GF menembak. KEPUTUSAN kabur/tidak & seberapa kuat tetap murni dari GF. |
| Skala Hz-looming → gerak, ambang pemicu GF | Sama seperti skala rasa→gerak di atas: tak ada kalibrasi biologis yang diketahui, dipilih ilustratif dari hasil uji `tools/build_brain_subnet.cjs`. |
| Kepak sayap saat kabur | Animasi kosmetik DI ATAS keputusan otak (frekuensi & pemicu waktu tetap dari GF/flightAmt) - kepakannya sendiri tak dihitung neuron per neuron. |

---

## Perilaku yang muncul (tidak diprogram)

- **Berputar ke kanan** saat lapar, karena asimetri DNp09 → DNa02.
- **Berhenti tepat di tetes gula**: FG menghambat oDN1 di dalam otak.
- **Makan sampai tetes habis**, lalu diam.
- **Istirahat setelah makan**: DNp09 di bawah ~50 Hz (lapar < ~0,6) tidak
  cukup untuk membuat oDN1 menembak, jadi lalat diam sampai lapar lagi.
- **Menolak gula yang dicampur pahit**: MN9 turun, probosis ditarik.
- **Tidak berhenti makan karena kenyang**: model tidak punya jalur rasa
  kenyang, jadi lalat makan selama gula masih terasa.
- **Kabur ke arah yang benar** (bukan asal lompat): GF cukup kuat memicu,
  arah dihitung dari posisi ancaman saat itu.
- **Berhenti mengecap dengan kaki begitu mulut menyentuh**: prioritas rasa
  mulut di `brainDrive()` (juga wajib demi keamanan konektom, lihat #4 di
  atas) membuat lalat "lupa" rasa kaki begitu benar-benar menggigit.

---

## Visualisasi otak 3D

Tombol "✨ Otak 3D" menambah titik-titik di dalam kepala lalat, satu per
neuron di potongan otak yang punya posisi (≈97% dari ≈2.400-3.500 neuron,
tergantung sapuan terakhir - beberapa neuron di anotasi FlyWire tidak
punya `soma_x/y/z` maupun `pos_x/y/z`). Posisinya NYATA (dari FlyWire, lihat
"Potongan otak" di atas), ditambahkan sebagai ANAK `model.root` (Three.js)
supaya ikut posisi & putaran lalat - persis cara `js/connectome.js`
menempelkan mesh neuropil (`model.root.add(...)`).

Kecerahan tiap titik = aktivitas SUNGGUHAN: menyala penuh saat neuron itu
menembak (`BRAIN.onSpikes`), meluruh eksponensial (~0,35 detik) sampai
menembak lagi. Bukan animasi kosmetik - matikan otaknya (jeda), titik-titik
tetap redup karena memang tak ada yang menembak.

Mati (tak dibangun sama sekali dari sisi render) sampai tombolnya ditekan -
kalau tak pernah dinyalakan, tak ada biaya tambahan.

---

## Performa

Diukur ulang 30 September 2026 setelah potongan otak membesar dari 972 →
**2.365 neuron** (menambah jalur visi/giant fiber & rasa kaki). Satu detik
otak = 10.000 langkah 0,1 ms.

| Keadaan | Server (AMD EPYC 7663, 1 inti) | Emulasi HP (CPU 4× lebih lambat) |
|---|---|---|
| jalan (lapar) | ~56 ms per detik otak | ~43–49% dari waktu nyata |
| makan (gula di mulut) | ~528 ms per detik otak | ~42–48% dari waktu nyata |
| kejut (giant fiber aktif) | ~773 ms per detik otak | ~37–46% dari waktu nyata |

Naik ~3× dari potongan lama (972 neuron), sebanding dengan pertambahan
jumlah neuron. Masih di bawah 50% CPU HP kelas menengah (diemulasi 4× lebih
lambat) di semua kondisi yang diuji - kalau HP terlalu lambat, dunia ikut
melambat (langkah tetap 10 ms, maksimum 5 langkah per frame), bukan melompat.
Jalan keluar berikutnya kalau terasa tersendat: pindahkan otak ke Web Worker.

Optimasi loop pada 29 September 2026 (konstanta di luar loop, bobot × w_syn
dihitung sekali, tanpa panggilan fungsi per sinaps) membuatnya ~1,6× lebih
cepat. Hasilnya diuji **identik** spike demi spike (waktu dan urutan) dengan
versi sebelumnya pada 6 kondisi input. Memakai presisi 64-bit tidak lebih
cepat dan hasilnya berbeda ~1%, jadi tetap 32-bit.

Muatan halaman (lewat Caddy dengan kompresi): kunjungan pertama ~316 KB
termasuk three.js. Kunjungan ulang ~1 KB, karena `serve.js` menjawab 304
untuk berkas yang tak berubah.

## Membangun ulang

```bash
# 1. salinan lokal repositori Shiu dkk. di /root/fly-brain-upstream
#    (Connectivity_783.parquet, Completeness_783.csv) + anotasi FlyWire di
#    .flywire-cache/annot.tsv (tools/fetch_connections.py mengunduhnya)
python3 tools/export_brain783.py        # -> .flywire-cache/brain783/ (~100 MB)
node tools/build_brain_subnet.cjs       # -> data/brain-lalat.json (~3 menit, 8 inti)
```

Kalau `CAL.SUGAR_HZ`, `CAL.BITTER_HZ`, atau `CAL.P9_MAX_HZ` di `js/alive.js`
dinaikkan, sapuan di `build_brain_subnet.cjs` juga harus dinaikkan. Kalau
tidak, potongan otak tidak lagi identik dengan otak utuh.

## Rujukan

- Dorkenwald dkk. 2024, *Neuronal wiring diagram of an adult brain*, Nature.
- Schlegel dkk. 2024, *Whole-brain annotation and multi-connectome cell typing of Drosophila*, Nature.
- Shiu dkk. 2024, *A Drosophila computational brain model reveals sensorimotor processing*, Nature.
- Sapkal dkk. 2024, *Neural circuit mechanisms underlying context-specific halting in Drosophila*, Nature (ID neuron: `/root/fly-brain-lab/coupling-research.md`).
- Bidaye dkk. 2020 (oDN1, DNp09), Bidaye dkk. 2014 (MDN), Rayshubskiy dkk. 2020 (DNa01/DNa02), McKellar dkk. 2020 (MN9).
