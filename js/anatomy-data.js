/* ==========================================================
   anatomy-data.js
   Basis data morfologi Drosophila melanogaster Meigen, 1830
   (lalat buah) - BETINA, sesuai asal konektom FlyWire.

   Setiap entri dipetakan ke satu objek 3D di fly.js lewat id.

   Rujukan umum: Demerec (ed.) "Biology of Drosophila";
   McAlpine (ed.) "Manual of Nearctic Diptera" vol. 1;
   Chapman "The Insects: Structure and Function" (ed. 5);
   Dorkenwald dkk. (2024) "Neuronal wiring diagram of an adult brain",
   Nature 634 - konektom FlyWire.
   ========================================================== */
(function (global) {
  'use strict';

  const GROUPS = [
    { id: 'kepala',   nama: 'Kepala (Caput)',        warna: '#4fd1c5', layer: 'exo' },
    { id: 'toraks',   nama: 'Toraks (Thorax)',       warna: '#64b5f6', layer: 'exo' },
    { id: 'abdomen',  nama: 'Abdomen',               warna: '#ffb454', layer: 'exo' },
    { id: 'sayap',    nama: 'Sayap & Halter',        warna: '#7ee8e0', layer: 'wing' },
    { id: 'tungkai',  nama: 'Tungkai (Pedes)',       warna: '#a3d977', layer: 'leg' },
    { id: 'otot',     nama: 'Otot Terbang',          warna: '#f78fb3', layer: 'muscle' },
    { id: 'internal', nama: 'Organ Dalam',           warna: '#ff6b6b', layer: 'internal' },
    { id: 'saraf',    nama: 'Sistem Saraf',          warna: '#a78bfa', layer: 'nerve' },
    { id: 'trakea',   nama: 'Sistem Trakea',         warna: '#9fd0ff', layer: 'trachea' },
    { id: 'konektom', nama: 'Konektom (FlyWire)',    warna: '#f0a6ff', layer: 'connectome' },
    { id: 'neuron',   nama: 'Bentuk Sel Saraf',      warna: '#7bdff2', layer: 'neuron' }
  ];

  /* ------------------------------------------------------------------
     P = daftar bagian.  Kunci objek = id yang dipakai di fly.js
     ------------------------------------------------------------------ */
  const P = {

    /* =================== KEPALA =================== */
    'caput': {
      nama: 'Kepala', latin: 'Caput', grup: 'kepala', layer: 'exo',
      ukuran: ['lebar ~0,8 mm', 'tipe: hipognat'],
      ringkas: 'Kapsul kepala yang hampir seluruhnya terisi sepasang mata majemuk merah dan otak di belakangnya. Bersendi pada leher membranosa sehingga dapat berputar luas untuk menstabilkan pandangan saat terbang.',
      fakta: [
        'Berbeda dengan lalat rumah, kedua jenis kelamin Drosophila bersifat <b>dikoptik</b> — mata tidak bersentuhan. Pembeda kelamin dilihat dari pola abdomen dan sisir seks di tungkai depan jantan.',
        'Otak mengisi sebagian besar rongga kepala — porsi yang jauh lebih besar dibanding serangga berukuran lebih besar.',
        'Lebar kepala hanya ±0,8 mm, tetapi memuat ±139.000 neuron.'
      ]
    },
    'mata-majemuk': {
      nama: 'Mata Majemuk', latin: 'Oculus compositus', grup: 'kepala', layer: 'exo',
      ukuran: ['±780 omatidia/mata', 'merah terang'],
      ringkas: 'Organ penglihatan utama, berwarna merah menyala pada galur tipe liar. Tersusun dari sekitar 780 omatidia — jauh lebih sedikit daripada lalat rumah (±4.000), sehingga tiap faset tampak jelas bahkan pada perbesaran sedang.',
      fakta: [
        'Warna merahnya berasal dari pigmen <b>drosopterin</b> (merah) dan <b>xanthommatin</b> (cokelat). Mutan <i>white</i> yang bermata putih adalah mutasi pertama yang ditemukan Morgan pada 1910 — titik awal genetika modern.',
        'Resolusinya rendah, tetapi responsnya sangat cepat: fotoreseptor masih mengikuti kedipan di atas 100 Hz.',
        'Memakai optika <b>superposisi neural</b> — rabdom terbuka, tujuh berkas yang melihat arah sama dipadukan di lamina.',
        'Peka pada ultraviolet hingga hijau; jalur pemrosesannya menempati lobus optik yang memuat sekitar separuh neuron otak.'
      ]
    },
    'omatidium': {
      nama: 'Omatidium', latin: 'Ommatidium', grup: 'kepala', layer: 'eye',
      ukuran: ['Ø ±16 µm', '8 sel retinula'],
      ringkas: 'Satu unit mata majemuk: lensa kornea di luar, kerucut kristalin, lalu delapan sel fotoreseptor (R1–R8) yang membentuk rabdomer penangkap cahaya, dibungkus sel pigmen agar tidak bocor ke tetangganya.',
      fakta: [
        'R1–R6 untuk kepekaan cahaya & deteksi gerak; <b>R7 dan R8</b> untuk warna dan cahaya terpolarisasi.',
        'Rabdom bertipe <b>terbuka</b> — syarat bagi superposisi neural.',
        'Pola heksagonal omatidia terbentuk lewat gelombang diferensiasi di cakram mata larva; inilah sistem klasik untuk mempelajari penentuan nasib sel.',
        'Susunan R7/R8 terbagi acak menjadi dua jenis kolom (pale dan yellow) dengan perbandingan tetap ±30:70.'
      ]
    },
    'oselus': {
      nama: 'Mata Tunggal / Oselus', latin: 'Ocelli', grup: 'kepala', layer: 'exo',
      ukuran: ['3 buah', 'segitiga di vertex'],
      ringkas: 'Tiga mata sederhana tersusun segitiga di puncak kepala. Tidak membentuk citra, tetapi sangat cepat mengukur perbedaan intensitas cahaya.',
      fakta: [
        'Berfungsi sebagai <b>cakrawala buatan</b>: membedakan langit terang dari tanah gelap untuk menjaga sikap tubuh saat terbang.',
        'Jalur sarafnya sangat pendek — respons stabilisasi tiba lebih dulu daripada dari mata majemuk.',
        'Sepasang bulu <b>oselar</b> yang besar tumbuh tepat di sampingnya.'
      ]
    },
    'antena': {
      nama: 'Antena', latin: 'Antenna', grup: 'kepala', layer: 'exo',
      ukuran: ['3 ruas', '±1.300 neuron olfaktori'],
      ringkas: 'Organ penciuman utama, tipe aristat: hanya tiga ruas dengan bulu cambuk (arista) pada ruas ketiga.',
      fakta: [
        'Tiga ruas: <b>skapus</b>, <b>pedisel</b> (berisi organ Johnston), dan <b>funikulus/postpedisel</b>.',
        'Organ Johnston di pedisel memuat ±480 neuron — mendeteksi getaran arista sebagai suara dan aliran udara.',
        'Lagu pacaran jantan yang dihasilkan getaran sayap ditangkap justru lewat organ ini, bukan lewat telinga.'
      ]
    },
    'funikulus': {
      nama: 'Funikulus (Postpedisel)', latin: 'Funiculus / Postpedicellus', grup: 'kepala', layer: 'exo',
      ukuran: ['ruas ke-3', '±1.300 neuron'],
      ringkas: 'Ruas antena terbesar, berbentuk oval, permukaannya dipadati sensila olfaktori berpori tempat molekul bau masuk dan berikatan dengan protein pengikat bau.',
      fakta: [
        'Drosophila hanya memiliki sekitar <b>50 gen reseptor bau</b> — sedikit, tetapi cukup karena tiap neuron umumnya mengekspresikan satu jenis saja.',
        'Semua neuron dengan reseptor sama bertemu di satu <b>glomerulus</b> yang sama di lobus antena. Peta ini terpetakan lengkap di konektom FlyWire.',
        'Jenis sensila: basikonik, trikoid (feromon), dan koeloknik (CO₂, kelembapan).'
      ]
    },
    'arista': {
      nama: 'Arista', latin: 'Arista', grup: 'kepala', layer: 'exo',
      ukuran: ['±6 cabang dorsal', '±3 ventral'],
      ringkas: 'Bulu cambuk pada funikulus. Pada Drosophila cabangnya <b>panjang dan jarang</b> — sekitar enam di sisi atas, tiga di sisi bawah, ditutup garpu di ujung. Sangat berbeda dari sisir rapat milik lalat rumah.',
      fakta: [
        'Bertindak sebagai <b>antena angin</b> sekaligus penerima suara jarak dekat; getarannya diukur organ Johnston.',
        'Bentuk arista adalah salah satu pembeda cepat Drosophilidae di bawah mikroskop.',
        'Memberi umpan balik kecepatan udara untuk kendali terbang.'
      ]
    },
    'probosis': {
      nama: 'Probosis', latin: 'Proboscis', grup: 'kepala', layer: 'exo',
      ukuran: ['dapat dilipat', 'tipe penjilat'],
      ringkas: 'Alat mulut tipe <b>penyerap-penjilat</b>. Tidak punya mandibula penusuk, sehingga Drosophila tidak dapat menggigit. Terdiri atas rostrum, haustelum, dan labelum.',
      fakta: [
        'Saat tidak dipakai, probosis terlipat rapi masuk ke rongga bawah kepala.',
        'Penjuluran probosis (<b>PER</b> — proboscis extension response) adalah uji baku dalam penelitian rasa dan pembelajaran pada lalat.',
        'Drosophila mengisap cairan hasil fermentasi ragi pada buah busuk — ragi, bukan buahnya, yang menjadi sumber protein utamanya.'
      ]
    },
    'labelum': {
      nama: 'Labelum', latin: 'Labellum', grup: 'kepala', layer: 'exo',
      ukuran: ['2 cuping', '±31 sensila rasa'],
      ringkas: 'Sepasang bantalan berdaging di ujung probosis. Permukaannya dialiri saluran halus berdinding cincin kitin (pseudotrakea) yang menyedot cairan secara kapiler menuju lubang mulut.',
      fakta: [
        'Tiap cuping membawa sekitar <b>31 sensila pengecap</b> yang sudah dipetakan satu per satu dan dinamai (L-type, S-type, I-type).',
        'Neuron rasa manis dan rasa pahit di sini berjalan pada jalur terpisah sampai ke otak.',
        'Pemetaan lengkap jalurnya hingga ganglion subesofageal tersedia di konektom FlyWire.'
      ]
    },
    'pseudotrakea': {
      nama: 'Pseudotrakea', latin: 'Pseudotracheae', grup: 'kepala', layer: 'exo',
      ukuran: ['alur kapiler'],
      ringkas: 'Alur-alur menyerupai sisir pada permukaan labelum. Dinding bercincin kitin menjaga saluran tetap menganga sehingga cairan tersedot oleh gaya kapiler.',
      fakta: [
        'Bekerja sekaligus sebagai <b>saringan</b> — partikel besar tidak dapat masuk.',
        'Semua alur bertemu di kanal makanan tengah menuju faring pemompa.'
      ]
    },
    'palpus': {
      nama: 'Palpus Maksila', latin: 'Palpus maxillaris', grup: 'kepala', layer: 'exo',
      ukuran: ['sepasang', '±120 neuron'],
      ringkas: 'Sepasang tonjolan gada di pangkal probosis, sisa maksila yang tereduksi. Membawa sensila olfaktori pelengkap.',
      fakta: [
        'Memuat sekitar 120 neuron olfaktori — jauh lebih sedikit daripada antena, tetapi dengan set reseptor yang berbeda.',
        'Berperan pada tahap akhir pendaratan dan penilaian makanan.'
      ]
    },
    'frons': {
      nama: 'Dahi (Frons)', latin: 'Frons', grup: 'kepala', layer: 'exo',
      ukuran: ['dikoptik', '3 bulu orbital/sisi'],
      ringkas: 'Bidang di antara kedua mata majemuk. Pada Drosophila kedua jenis kelamin sama-sama dikoptik (mata terpisah lebar).',
      fakta: [
        'Membawa deret <b>bulu orbital</b>: dua reklinat (menghadap belakang) dan satu proklinat (menghadap depan).',
        'Jumlah dan arah bulu di sini termasuk penanda baku untuk membedakan spesies dalam genus <i>Drosophila</i>.'
      ]
    },
    'mikrokaeta': {
      nama: 'Mikrokaeta', latin: 'Microchaetae', grup: 'kepala', layer: 'seta',
      ukuran: ['ratusan', 'tersusun berbaris'],
      ringkas: 'Bulu-bulu kecil yang menutupi tubuh dalam barisan teratur. Berbeda dengan makrokaeta, jumlah dan posisinya tidak tetap, tetapi arah barisannya sangat terpola.',
      fakta: [
        'Deret mikrokaeta di punggung toraks disebut baris <b>akrostikal</b>; jumlah barisnya dipakai dalam identifikasi.',
        'Tiap bulu terhubung ke satu neuron mekanoreseptor — membentuk peta sentuhan di seluruh permukaan tubuh.',
        'Pembentukannya dari sel prekursor tunggal adalah sistem klasik untuk mempelajari <b>lateral inhibition</b> lewat jalur Notch.'
      ]
    },
    'makrokaeta-kepala': {
      nama: 'Makrokaeta Kepala', latin: 'Macrochaetae capitis', grup: 'kepala', layer: 'seta',
      ukuran: ['posisi tetap', 'panjang ±0,25 mm'],
      ringkas: 'Bulu besar bernama pada kepala, jumlah dan letaknya tetap pada setiap individu: sepasang <b>oselar</b>, sepasang <b>postvertikal</b>, tiga <b>orbital</b> per sisi, dan sepasang <b>vibrisa</b> di tepi mulut.',
      fakta: [
        'Pola makrokaeta yang selalu sama inilah yang menjadikan Drosophila sistem sempurna untuk mempelajari <b>penentuan pola</b>: satu bulu hilang atau bertambah langsung terlihat.',
        'Mutasi <i>achaete-scute</i> mengubah pola ini secara terprediksi — dasar dari seluruh bidang neurogenetika awal.',
        'Tiap makrokaeta adalah organ sensorik lengkap: bulu, soket, neuron, dan sel selubung yang semuanya berasal dari satu sel induk.'
      ]
    },

    /* =================== TORAKS =================== */
    'toraks': {
      nama: 'Toraks', latin: 'Thorax', grup: 'toraks', layer: 'exo',
      ukuran: ['panjang ~0,95 mm', '3 segmen'],
      ringkas: 'Kotak penggerak berwarna cokelat kekuningan, hampir seluruh isinya otot terbang. Mesotoraks membengkak besar karena hanya ruas inilah yang membawa sayap.',
      fakta: [
        'Drosophila <b>tidak memiliki empat garis hitam memanjang</b> seperti lalat rumah — punggungnya polos kecokelatan dengan deret bulu.',
        'Dindingnya berfungsi sebagai <b>pegas elastis</b> berisi protein resilin yang mengembalikan energi tiap kepakan.',
        'Protoraks dan metatoraks menyusut menjadi cincin tipis.'
      ]
    },
    'skutum': {
      nama: 'Skutum', latin: 'Scutum', grup: 'toraks', layer: 'exo',
      ukuran: ['2 pasang dorsosentral'],
      ringkas: 'Pelat punggung mesotoraks — bagian terbesar toraks. Menahan gaya tarik otot terbang longitudinal, dan membawa pola makrokaeta yang tetap.',
      fakta: [
        'Naik-turunnya skutum secara tak langsung menggerakkan sayap.',
        'Membawa dua pasang bulu <b>dorsosentral</b> besar, plus humeral, presutural, notopleural, supraalar, dan postalar.',
        'Seluruh skutum berkembang dari satu cakram imaginal sayap pada tahap larva.'
      ]
    },
    'skutelum': {
      nama: 'Skutelum', latin: 'Scutellum', grup: 'toraks', layer: 'exo',
      ukuran: ['segitiga', '4 makrokaeta'],
      ringkas: 'Tonjolan segitiga di belakang skutum, menutupi pangkal abdomen. Membawa empat bulu skutelar besar.',
      fakta: [
        'Dua bulu basal dan dua bulu apikal — jumlah tetap dan mudah dihitung.',
        'Bentuk & bulu skutelum dipakai membedakan genus dalam Drosophilidae.'
      ]
    },
    'makrokaeta-toraks': {
      nama: 'Makrokaeta Toraks', latin: 'Macrochaetae thoracis', grup: 'toraks', layer: 'seta',
      ukuran: ['±11 pasang bernama'],
      ringkas: 'Bulu besar bernama pada toraks: humeral, presutural, 2 notopleural, 2 dorsosentral, supraalar, postalar, dan 4 skutelar. Posisinya identik pada setiap lalat normal.',
      fakta: [
        'Kesetiaan pola ini membuat toraks Drosophila jadi "papan uji" bagi ratusan penelitian perkembangan.',
        'Bulu dorsosentral adalah yang paling sering dipakai sebagai penanda dalam percobaan genetika.',
        'Setiap bulu berfungsi sebagai sensor sentuh dan aliran udara yang terhubung langsung ke ganglion toraks.'
      ]
    },
    'pleuron': {
      nama: 'Pleuron', latin: 'Pleuron', grup: 'toraks', layer: 'exo',
      ukuran: ['dinding samping'],
      ringkas: 'Dinding samping toraks, tempat melekatnya tungkai, sayap, dan spirakel. Terbagi oleh alur menjadi beberapa sklerit.',
      fakta: [
        'Menjadi titik tumpu (fulcrum) bagi pangkal sayap saat mengepak.',
        'Membawa bulu notopleural yang menjadi penanda identifikasi.'
      ]
    },
    'spirakel-toraks': {
      nama: 'Spirakel Toraks', latin: 'Spiraculum thoracicum', grup: 'toraks', layer: 'trachea',
      ukuran: ['2 pasang'],
      ringkas: 'Lubang napas berkatup di sisi toraks: satu pasang mesotorakal dan satu pasang metatorakal. Menjadi pintu masuk utama udara ke otot terbang.',
      fakta: [
        'Katupnya menutup saat lalat diam untuk menekan penguapan air.',
        'Memasok langsung kantung udara besar di sekitar otot terbang.'
      ]
    },
    'otot-dlm': {
      nama: 'Otot Longitudinal Dorsal (DLM)', latin: 'Musculi dorsales longitudinales', grup: 'otot', layer: 'muscle',
      ukuran: ['6 berkas/sisi', 'kepakan ~200 Hz'],
      ringkas: 'Otot terbang <b>tak langsung</b> penghasil gerakan turun sayap. Tidak menempel ke sayap sama sekali — ia memendekkan toraks dari depan ke belakang sehingga punggung melengkung naik dan sayap terungkit turun.',
      fakta: [
        'Termasuk <b>otot asinkron (fibrilar)</b>: satu impuls saraf memicu banyak siklus kontraksi, sehingga frekuensi kepakan ±200 Hz jauh melampaui laju impuls saraf.',
        'Diaktifkan oleh <b>peregangan</b>, bukan oleh tiap sinyal saraf — kunci terbang berfrekuensi tinggi.',
        'Pada Drosophila, DLM terdiri atas enam berkas per sisi yang perkembangannya dapat ditelusuri sel demi sel.',
        'Merupakan jaringan dengan laju metabolisme tertinggi yang diketahui di dunia hewan.'
      ]
    },
    'otot-dvm': {
      nama: 'Otot Dorsoventral (DVM)', latin: 'Musculi dorsoventrales', grup: 'otot', layer: 'muscle',
      ukuran: ['3 kelompok/sisi'],
      ringkas: 'Pasangan antagonis DLM, penghasil gerakan naik sayap. Menarik punggung ke bawah mendekati dasar toraks sehingga sayap terungkit naik.',
      fakta: [
        'Juga bertipe asinkron dan bekerja pada frekuensi resonansi alami toraks.',
        'DLM + DVM bersama membentuk porsi besar massa toraks.'
      ]
    },
    'otot-kendali': {
      nama: 'Otot Kendali Langsung', latin: 'Musculi alares directi', grup: 'otot', layer: 'muscle',
      ukuran: ['±17 pasang', 'sinkron'],
      ringkas: 'Otot kecil yang menempel langsung pada sklerit pangkal sayap. Tidak menghasilkan tenaga, tetapi mengubah sudut serang dan bentuk lintasan kepakan — inilah kemudi lalat.',
      fakta: [
        'Bertipe <b>sinkron</b>: satu impuls = satu kontraksi, sehingga dapat diatur sangat presisi.',
        'Perubahan sudut beberapa derajat saja cukup untuk manuver banting setir dalam <b>&lt;50 milidetik</b>.',
        'Menerima masukan langsung dari halter — lengkung refleks tercepat pada serangga.',
        'Neuron penggeraknya sudah teridentifikasi tuntas dan diberi nama dalam data konektom tali saraf.'
      ]
    },

    /* =================== SAYAP =================== */
    'sayap': {
      nama: 'Sayap', latin: 'Ala', grup: 'sayap', layer: 'wing',
      ukuran: ['panjang ~2,4 mm', 'kepakan ~200 Hz'],
      ringkas: 'Membran tipis dua lapis kutikula yang menyatu, diperkuat rangka urat berongga. Hanya sepasang — ciri ordo Diptera. Bentuknya lebih membundar daripada sayap lalat rumah.',
      fakta: [
        'Gaya angkat dihasilkan lewat <b>delayed stall</b> dan pusaran tepi depan (leading-edge vortex), bukan seperti sayap pesawat.',
        'Jantan menggetarkan satu sayap untuk menghasilkan <b>lagu pacaran</b> berpola spesifik spesies — ditangkap betina lewat organ Johnston.',
        'Sayap berkembang dari cakram imaginal yang menjadi model utama penelitian pembentukan pola organ.',
        'Urat sayap juga menyalurkan hemolimfa, trakea, dan saraf.'
      ]
    },
    'urat-kosta': {
      nama: 'Urat Kosta (L1)', latin: 'Costa + R1', grup: 'sayap', layer: 'wing',
      ringkas: 'Urat tepi depan sayap, paling tebal dan kaku. Menahan seluruh beban tekuk saat kepakan dan membentuk tepi serang aerodinamis.',
      fakta: [
        'Dalam konvensi genetika lalat, urat memanjang dinomori <b>L1–L5</b> dari depan ke belakang; L1 adalah kosta.',
        'Memiliki <b>patahan kosta</b> (costal break) khas Drosophilidae di dekat ujung subkosta.'
      ]
    },
    'urat-subkosta': {
      nama: 'Urat Subkosta (Sc)', latin: 'Subcosta', grup: 'sayap', layer: 'wing',
      ringkas: 'Urat memanjang kedua, tereduksi pada Drosophila dan berakhir dini di tepi depan sayap.',
      fakta: ['Reduksi Sc adalah ciri umum kelompok Acalyptratae.']
    },
    'urat-l2': {
      nama: 'Urat L2 (R2+3)', latin: 'Radius 2+3', grup: 'sayap', layer: 'wing',
      ringkas: 'Urat memanjang yang berjalan dari pangkal menuju tepi depan pada sekitar dua pertiga panjang sayap.',
      fakta: ['Jarak L2–L3 adalah ukuran baku dalam penelitian pertumbuhan dan ukuran organ.']
    },
    'urat-l3': {
      nama: 'Urat L3 (R4+5)', latin: 'Radius 4+5', grup: 'sayap', layer: 'wing',
      ringkas: 'Urat memanjang ketiga yang berjalan hampir sampai ujung sayap. Bersama L4 mengapit sel submarginal.',
      fakta: ['Menjadi patokan posisi bagi urat silang anterior.']
    },
    'urat-l4': {
      nama: 'Urat L4 (Media) — pembanding kunci', latin: 'Media 1+2', grup: 'sayap', layer: 'wing',
      ukuran: ['melengkung landai'],
      ringkas: 'Urat media. Pada Drosophila urat ini <b>melengkung landai</b> menuju ujung sayap — berbeda tajam dari lalat rumah <i>Musca domestica</i>, yang urat M-nya membelok hampir siku-siku ke depan.',
      fakta: [
        'Perbedaan ini adalah cara tercepat memastikan sebuah lalat kecil memang Drosophilidae dan bukan Muscidae muda.',
        'Bersama L5 dan kedua urat silang, L4 membatasi <b>sel diskal</b>.',
        'Pola percabangan urat sayap dikendalikan gradien morfogen Dpp dan Hedgehog di cakram imaginal.'
      ]
    },
    'urat-l5': {
      nama: 'Urat L5 (CuA1)', latin: 'Cubitus anterior 1', grup: 'sayap', layer: 'wing',
      ringkas: 'Urat memanjang terakhir yang mencapai tepi belakang sayap, membatasi sel diskal di sisi posterior.',
      fakta: ['Ujung L5 mencapai tepi sayap — berbeda dari Musca yang urat kubitusnya berhenti sebelum tepi.']
    },
    'urat-anal': {
      nama: 'Urat Anal', latin: 'Analis', grup: 'sayap', layer: 'wing',
      ringkas: 'Urat pendek di pangkal tepi belakang sayap, menopang bagian basal membran.',
      fakta: ['Sangat tereduksi pada Drosophila dan tidak mencapai tepi sayap.']
    },
    'urat-silang': {
      nama: 'Urat Silang (acv & pcv)', latin: 'Venae transversae', grup: 'sayap', layer: 'wing',
      ukuran: ['2 buah'],
      ringkas: 'Dua urat pendek melintang: <b>anterior crossvein</b> (acv) di tengah sayap dan <b>posterior crossvein</b> (pcv) lebih ke ujung. Keduanya mengunci rangka sayap agar tidak terpuntir berlebihan.',
      fakta: [
        'Keduanya mengapit <b>sel diskal</b>.',
        'Hilangnya pcv adalah salah satu fenotipe mutan paling sering dipakai sebagai penanda genetik.'
      ]
    },
    'sel-diskal': {
      nama: 'Sel Diskal', latin: 'Cellula discalis', grup: 'sayap', layer: 'wing',
      ringkas: 'Ruang membran di tengah sayap yang dibatasi urat silang anterior, L4, urat silang posterior, dan L5. Bentuk & ukurannya dipakai dalam kunci identifikasi.',
      fakta: ['Menjadi titik acuan untuk menamai sel-sel lain di sekitarnya.']
    },
    'alula': {
      nama: 'Alula', latin: 'Alula', grup: 'sayap', layer: 'wing',
      ringkas: 'Cuping kecil di pangkal tepi belakang sayap. Pada Drosophila berukuran kecil, sesuai kelompok Acalyptratae.',
      fakta: ['Ikut mengatur aliran udara di pangkal sayap saat kecepatan rendah.']
    },
    'kaliptra': {
      nama: 'Kaliptra (Squama)', latin: 'Calypter', grup: 'sayap', layer: 'wing',
      ukuran: ['tereduksi'],
      ringkas: 'Lembar membran kecil di pangkal sayap. Pada Drosophila kaliptra <b>tereduksi</b> dan tidak menutupi halter — inilah yang menempatkannya di kelompok <b>Acalyptratae</b>.',
      fakta: [
        'Kebalikan dari lalat rumah (Calyptratae) yang kaliptranya besar dan menudungi halter.',
        'Ukuran kaliptra adalah pembeda pada tingkat klasifikasi tinggi dalam Diptera.'
      ]
    },
    'halter': {
      nama: 'Halter', latin: 'Halteres', grup: 'sayap', layer: 'wing',
      ukuran: ['sepasang', '±340 sensila kampaniform'],
      ringkas: 'Sayap belakang yang berevolusi menjadi organ gada mungil berwarna pucat. Berayun berlawanan fase dengan sayap pada frekuensi sama, dan berperan sebagai <b>giroskop biologis</b>.',
      fakta: [
        'Saat tubuh berputar, <b>gaya Coriolis</b> membelokkan bidang ayun halter; simpangan itu terbaca oleh medan sensila kampaniform di pangkalnya.',
        'Sinyalnya langsung menuju otot kendali sayap — refleks stabilisasi selesai dalam <b>±5 milidetik</b>.',
        'Mutasi <i>Ultrabithorax</i> mengubah halter kembali menjadi sepasang sayap penuh — bukti paling terkenal bahwa gen Hox menentukan identitas ruas tubuh.',
        'Lalat yang halternya dihilangkan tidak mampu terbang stabil sama sekali.'
      ]
    },

    /* =================== TUNGKAI =================== */
    'koksa': {
      nama: 'Koksa', latin: 'Coxa', grup: 'tungkai', layer: 'leg',
      ringkas: 'Ruas pangkal tungkai yang bersendi pada dinding toraks. Pendek dan kokoh, menjadi titik ayun seluruh kaki.',
      fakta: ['Sendi koksa–toraks menentukan arah jangkauan langkah.']
    },
    'trokanter': {
      nama: 'Trokanter', latin: 'Trochanter', grup: 'tungkai', layer: 'leg',
      ringkas: 'Ruas kecil penghubung koksa dan femur, memberi satu derajat kebebasan putar tambahan.',
      fakta: ['Pada Diptera berukuran sangat kecil dan menyatu erat dengan femur.']
    },
    'femur': {
      nama: 'Femur', latin: 'Femur', grup: 'tungkai', layer: 'leg',
      ringkas: 'Ruas tungkai terbesar dan terkuat, berisi otot penggerak tibia. Bagian inilah yang dipakai melontar tubuh saat lalat melompat menjelang terbang.',
      fakta: [
        'Lalat memulai terbang dengan <b>lompatan</b> dari tungkai tengah, bukan dengan kepakan.',
        'Lompatan kabur dipicu <b>giant fiber</b> — jalur saraf berdiameter besar dari otak yang memberi waktu reaksi beberapa milidetik saja.'
      ]
    },
    'tibia': {
      nama: 'Tibia', latin: 'Tibia', grup: 'tungkai', layer: 'leg',
      ringkas: 'Ruas panjang ramping setelah femur, membawa deret duri dan taji di ujung yang dipakai untuk membersihkan tubuh.',
      fakta: ['Gerakan menggosokkan tibia adalah bagian dari perilaku <b>grooming</b> yang urutannya terpola tetap dan dikendalikan sirkuit khusus.']
    },
    'tarsus': {
      nama: 'Tarsus', latin: 'Tarsus', grup: 'tungkai', layer: 'leg',
      ukuran: ['5 tarsomer'],
      ringkas: 'Ruas "telapak" yang terbagi menjadi lima tarsomer; yang pertama (basitarsus) paling panjang. Permukaannya membawa sensila pengecap.',
      fakta: [
        'Lalat <b>mengecap lewat kakinya</b>: begitu tarsus menyentuh cairan manis, probosis langsung terjulur secara refleks.',
        'Tiap tungkai membawa sekitar 50 bulu pengecap yang sudah dipetakan satu per satu.',
        'Pada <b>jantan</b>, basitarsus tungkai depan membawa <b>sisir seks</b> (sex comb) — deret duri hitam tebal untuk mencengkeram betina saat kawin. Model ini betina, jadi sisir seks tidak ada.'
      ]
    },
    'pretarsus': {
      nama: 'Pretarsus', latin: 'Pretarsus', grup: 'tungkai', layer: 'leg',
      ringkas: 'Ujung kaki yang membawa sepasang cakar, sepasang bantalan pulvilus, dan empodium di tengah.',
      fakta: ['Kombinasi cakar (kasar) + pulvilus (halus) membuat lalat dapat menapak hampir di semua permukaan.']
    },
    'cakar': {
      nama: 'Cakar', latin: 'Unguis', grup: 'tungkai', layer: 'leg',
      ukuran: ['2 buah/kaki'],
      ringkas: 'Sepasang kait kitin tajam di ujung tarsus untuk mencengkeram permukaan kasar dan berserat.',
      fakta: ['Pada permukaan licin, cakar tidak berguna dan tugasnya diambil alih pulvilus.']
    },
    'pulvilus': {
      nama: 'Pulvilus', latin: 'Pulvillus', grup: 'tungkai', layer: 'leg',
      ukuran: ['2 bantalan/kaki'],
      ringkas: 'Bantalan berbulu di antara cakar. Permukaannya ditutupi rambut ujung-pipih (seta tenent) yang mengeluarkan cairan berminyak — inilah rahasia lalat berjalan di kaca dan langit-langit.',
      fakta: [
        'Daya lekatnya berasal dari <b>gaya kapiler cairan</b> ditambah gaya van der Waals, bukan dari hisapan.',
        'Untuk melepaskan diri, lalat mengangkat kaki dengan gerakan mengelupas dari ujung, bukan menarik lurus.',
        'Gaya lekat per satuan luas pada Drosophila termasuk yang tertinggi di antara serangga terbang.'
      ]
    },
    'empodium': {
      nama: 'Empodium', latin: 'Empodium', grup: 'tungkai', layer: 'leg',
      ringkas: 'Struktur mirip bulu di tengah antara kedua pulvilus.',
      fakta: ['Bentuknya (bulu vs. bantalan) dipakai sebagai karakter identifikasi famili Diptera.']
    },
    'seta-tungkai': {
      nama: 'Duri & Seta Tungkai', latin: 'Setae, Spinae', grup: 'tungkai', layer: 'seta',
      ringkas: 'Deret duri kaku pada femur dan tibia yang dipakai sebagai sisir pembersih sekaligus sensor sentuh.',
      fakta: ['Lalat memakai sisir ini untuk membersihkan mata, sayap, dan tarsus dari debu dan serbuk.']
    },

    /* =================== ABDOMEN =================== */
    'abdomen': {
      nama: 'Abdomen', latin: 'Abdomen', grup: 'abdomen', layer: 'exo',
      ukuran: ['6 ruas tampak (betina)', 'panjang ~1,1 mm'],
      ringkas: 'Bagian belakang tubuh berisi saluran pencernaan, organ ekskresi, dan reproduksi. Berwarna kuning pucat dengan <b>pita gelap melintang</b> pada tepi belakang tiap tergit.',
      fakta: [
        'Pola pita melintang inilah pembeda kelamin yang paling praktis: <b>betina</b> menampakkan enam ruas dengan pita terpisah dan ujung meruncing; <b>jantan</b> lebih kecil dengan ruas belakang melebur menjadi ujung hitam pekat membulat.',
        'Perhatikan arahnya — Drosophila bergaris MELINTANG, sedangkan lalat rumah bergaris MEMBUJUR di garis tengah punggung.',
        'Membran lentur antara pelat memungkinkan abdomen mengembang besar saat penuh telur.',
        'Gerak naik-turun abdomen ikut memompa udara keluar-masuk sistem trakea.'
      ]
    },
    'tergit': {
      nama: 'Tergit', latin: 'Tergum / Tergites', grup: 'abdomen', layer: 'exo',
      ringkas: 'Pelat kitin punggung tiap ruas abdomen. Saling menumpuk seperti sisik genting; tepi belakangnya membawa pita gelap.',
      fakta: [
        'Pigmentasi tergit dikendalikan gen <i>bric-à-brac</i>, <i>abdominal-A</i>, dan <i>doublesex</i> — model baku untuk mempelajari evolusi pola warna.',
        'Perbedaan pola tergit antara jantan dan betina muncul dari jalur penentuan kelamin yang sama.'
      ]
    },
    'sternit': {
      nama: 'Sternit', latin: 'Sternum / Sternites', grup: 'abdomen', layer: 'exo',
      ringkas: 'Pelat kitin sisi perut, lebih kecil dan lebih lunak dibandingkan tergit.',
      fakta: ['Bagian ini yang paling banyak meregang saat abdomen membesar.']
    },
    'spirakel-abdomen': {
      nama: 'Spirakel Abdomen', latin: 'Spiracula abdominalia', grup: 'abdomen', layer: 'trachea',
      ukuran: ['7 pasang'],
      ringkas: 'Deret lubang napas di sisi tiap ruas abdomen, masing-masing berkatup dan bertapis rambut penyaring debu.',
      fakta: [
        'Bersama spirakel toraks membentuk sembilan pasang lubang napas total pada lalat dewasa.',
        'Pembukaan katup diatur agar kehilangan air seminimal mungkin.'
      ]
    },
    'ovipositor': {
      nama: 'Ovipositor Teleskopik', latin: 'Ovipositor', grup: 'abdomen', layer: 'exo',
      ringkas: 'Ujung abdomen betina yang dapat dijulurkan seperti teleskop untuk menyelipkan telur ke dalam buah yang mulai membusuk.',
      fakta: [
        'Betina bertelur <b>50–75 butir per hari</b> dan dapat mencapai beberapa ratus butir seumur hidup.',
        'Telur Drosophila punya <b>dua filamen dorsal</b> yang berfungsi sebagai pelampung agar tidak tenggelam dalam cairan buah — bentuk yang sangat khas.',
        'Daur hidup telur → larva (3 instar) → pupa → dewasa selesai dalam <b>9–10 hari</b> pada 25 °C. Cepatnya siklus inilah alasan utama Drosophila jadi hewan model.'
      ]
    },

    /* =================== ORGAN DALAM =================== */
    'esofagus': {
      nama: 'Esofagus & Faring', latin: 'Oesophagus, Pharynx', grup: 'internal', layer: 'internal',
      ringkas: 'Saluran dari mulut menuju badan. Faring berdinding otot bertindak sebagai <b>pompa isap</b> yang menarik cairan lewat probosis.',
      fakta: ['Esofagus menembus tepat di tengah otak — lubang tempatnya lewat memisahkan otak atas dan ganglion subesofageal.']
    },
    'tembolok': {
      nama: 'Tembolok', latin: 'Ingluvies (Crop)', grup: 'internal', layer: 'internal',
      ringkas: 'Kantung penyimpan makanan cair di abdomen. Bukan organ pencerna — hanya gudang sementara yang isinya dialirkan sedikit demi sedikit ke usus.',
      fakta: [
        'Volume tembolok dipakai sebagai ukuran baku <b>seberapa banyak lalat makan</b> dalam penelitian perilaku makan.',
        'Isinya dapat dimuntahkan kembali untuk melarutkan makanan di luar tubuh.'
      ]
    },
    'proventrikulus': {
      nama: 'Proventrikulus', latin: 'Proventriculus', grup: 'internal', layer: 'internal',
      ringkas: 'Katup berbentuk cincin di perbatasan usus depan dan usus tengah, mengatur aliran makanan masuk dan mencegah arus balik.',
      fakta: ['Menghasilkan membran peritrofik yang membungkus makanan dan melindungi dinding usus.']
    },
    'usus-tengah': {
      nama: 'Usus Tengah', latin: 'Mesenteron (Midgut)', grup: 'internal', layer: 'internal',
      ringkas: 'Tempat berlangsungnya pencernaan enzimatik dan penyerapan nutrisi. Terbagi menjadi wilayah-wilayah dengan keasaman dan fungsi berbeda.',
      fakta: [
        'Memiliki <b>sel punca usus</b> yang terus memperbarui lapisan dalamnya — sistem model utama untuk penelitian sel punca dewasa.',
        'Mikrobioma usus Drosophila hanya terdiri atas segelintir spesies bakteri, jauh lebih sederhana daripada mamalia — karena itu sangat mudah dipelajari.'
      ]
    },
    'usus-belakang': {
      nama: 'Usus Belakang & Rektum', latin: 'Proctodeum, Rectum', grup: 'internal', layer: 'internal',
      ringkas: 'Bagian akhir saluran cerna. Papila rektal di dindingnya menyerap kembali air dan garam sebelum sisa dibuang.',
      fakta: ['Penyerapan ulang air sangat penting bagi serangga sekecil ini yang mudah kehilangan cairan.']
    },
    'malpighi': {
      nama: 'Tubulus Malpighi', latin: 'Tubuli Malpighii', grup: 'internal', layer: 'internal',
      ukuran: ['4 tubulus'],
      ringkas: 'Organ ekskresi berupa pipa halus panjang yang terapung bebas di hemolimfa. Menyaring limbah nitrogen dan mengalirkannya ke usus belakang — setara dengan ginjal pada serangga.',
      fakta: [
        'Drosophila memiliki <b>4 tubulus</b>: sepasang anterior dan sepasang posterior, masing-masing dengan jenis sel yang berbeda.',
        'Limbah dibuang sebagai <b>asam urat</b> yang hampir tidak larut air — hemat air sekali.',
        'Jadi model penelitian penyakit batu ginjal manusia karena mekanisme transport ionnya sangat mirip.'
      ]
    },
    'kelenjar-ludah': {
      nama: 'Kelenjar Ludah', latin: 'Glandulae salivariae', grup: 'internal', layer: 'internal',
      ringkas: 'Sepasang kelenjar panjang di toraks yang menyalurkan air liur ke pangkal probosis.',
      fakta: [
        'Kelenjar ludah <b>larva</b> Drosophila memuat kromosom politen raksasa — struktur yang memungkinkan gen terlihat langsung di bawah mikroskop cahaya, dan menjadi dasar peta gen pertama dalam sejarah biologi.'
      ]
    },
    'ovarium': {
      nama: 'Ovarium', latin: 'Ovarium', grup: 'internal', layer: 'internal',
      ukuran: ['sepasang', '±15–20 ovariol'],
      ringkas: 'Sepasang organ reproduksi betina yang mengisi sebagian besar rongga abdomen saat matang. Tiap ovarium tersusun dari berkas tabung (ovariol) tempat telur berkembang berurutan.',
      fakta: [
        'Setiap ovariol adalah "jalur perakitan": dari sel punca di ujung hingga telur matang di pangkal — dapat diamati seluruhnya dalam satu preparat.',
        'Pematangan telur menuntut asupan protein dari ragi pada buah busuk.',
        'Sumbu depan-belakang embrio ditentukan sejak di dalam ovariol — penemuan yang berujung Hadiah Nobel 1995.'
      ]
    },
    'jantung': {
      nama: 'Pembuluh Dorsal (Jantung)', latin: 'Vas dorsale, Cor', grup: 'internal', layer: 'internal',
      ringkas: 'Pipa berotot di sepanjang punggung yang memompa hemolimfa. Sistem peredarannya <b>terbuka</b>: cairan dilepas bebas membasahi organ, lalu masuk kembali lewat lubang ostia.',
      fakta: [
        'Hemolimfa <b>tidak mengangkut oksigen</b> — tugas itu diambil alih sepenuhnya oleh sistem trakea.',
        'Arah pompa dibalik secara berkala; jantung Drosophila dipakai sebagai model penelitian aritmia jantung manusia.',
        'Gen <i>tinman</i> yang membentuknya punya padanan langsung pada pembentukan jantung manusia.'
      ]
    },
    'badan-lemak': {
      nama: 'Badan Lemak', latin: 'Corpus adiposum', grup: 'internal', layer: 'internal',
      ringkas: 'Jaringan longgar keputihan yang tersebar di rongga tubuh. Menjadi gudang energi sekaligus "hati" serangga.',
      fakta: [
        'Menyimpan glikogen, lipid, dan protein sebagai bahan bakar terbang.',
        'Menghasilkan <b>peptida antimikroba</b> lewat jalur Toll dan Imd — penemuan imunitas bawaan yang meraih Hadiah Nobel 2011.'
      ]
    },

    /* =================== SISTEM SARAF =================== */
    'otak': {
      nama: 'Otak', latin: 'Cerebrum', grup: 'saraf', layer: 'nerve',
      ukuran: ['139.255 neuron', '~0,6 × 0,34 × 0,20 mm'],
      ringkas: 'Ganglion utama di kepala — dan satu-satunya otak hewan dewasa yang sudah dipetakan lengkap sampai tingkat sinapsis. Proyek <b>FlyWire</b> merekonstruksi seluruhnya dari citra mikroskop elektron dan menerbitkannya pada Oktober 2024.',
      fakta: [
        'Konektom FlyWire versi 783 memuat <b>139.255 neuron</b> dan sekitar <b>54,5 juta sinapsis</b>, terbagi ke dalam ±78 wilayah neuropil.',
        '<b>Lobus optik</b> kiri-kanan menempati kira-kira separuh seluruh neuron — memproses citra dari ratusan omatidia secara paralel lewat lapisan lamina, medula, lobula, dan lobula plate.',
        '<b>Badan jamur</b> (mushroom body) berisi ±2.200 sel Kenyon per belahan — pusat pembelajaran dan ingatan bau.',
        '<b>Kompleks sentral</b> berperan sebagai kompas: neuron arah-hadap di dalamnya menyimpan orientasi lalat terhadap dunia luar.',
        'Seluruh otak muat dalam volume kurang dari sebutir garam, namun mengendalikan manuver terbang yang belum tertandingi drone buatan manusia.'
      ]
    },
    'ganglion-subesofageal': {
      nama: 'Zona Subesofageal (SEZ)', latin: 'Ganglion suboesophageale', grup: 'saraf', layer: 'nerve',
      ringkas: 'Pusat saraf di bawah kerongkongan yang mengendalikan alat mulut: probosis, labelum, dan palpus. Pada Drosophila ia sudah melebur menjadi bagian otak itu sendiri.',
      fakta: [
        'Menerima seluruh masukan rasa dari labelum dan tarsus, lalu mengatur refleks penjuluran probosis.',
        'Termasuk dalam cakupan konektom FlyWire, sehingga jalur dari sensor rasa hingga otot mulut dapat ditelusuri utuh.'
      ]
    },
    'ganglion-toraks': {
      nama: 'Tali Saraf Ventral (VNC)', latin: 'Ganglion thoracicum fusum', grup: 'saraf', layer: 'nerve',
      ukuran: ['±15.000 neuron'],
      ringkas: 'Massa saraf hasil peleburan ganglion toraks dan abdomen menjadi satu blok padat di dalam toraks. Mengendalikan sayap, halter, dan seluruh tungkai.',
      fakta: [
        'Peleburan ini memperpendek jalur saraf sehingga <b>waktu reaksi terbang menjadi minimum</b>.',
        'VNC <b>tidak termasuk dalam konektom FlyWire</b> — ia dipetakan terpisah (dataset MANC dan FANC dari Janelia). Untuk sistem saraf lengkap, kedua sumber harus digabung.',
        'Di sinilah sinyal halter bertemu langsung dengan otot kendali sayap.',
        'Neuron raksasa (giant fiber) menghubungkan otak ke otot lompat untuk kabur secepat kilat.'
      ]
    },
    'tali-saraf': {
      nama: 'Konektif Serviks', latin: 'Connectivum cervicale', grup: 'saraf', layer: 'nerve',
      ringkas: 'Berkas saraf yang melewati leher, menghubungkan otak dengan tali saraf ventral. Seluruh perintah dari otak ke tubuh lewat di sini.',
      fakta: [
        'Hanya sekitar 1.300 neuron yang menembus leher ini — leher botol sempit antara otak dan tubuh.',
        'Neuron-neuron inilah titik sambung antara konektom FlyWire (otak) dan dataset tali saraf.'
      ]
    },

    /* =================== TRAKEA =================== */
    'trakea': {
      nama: 'Batang Trakea', latin: 'Trachea', grup: 'trakea', layer: 'trachea',
      ringkas: 'Jaringan pipa udara bercabang yang mengantarkan oksigen <b>langsung ke setiap sel</b>, tanpa perantara darah. Dindingnya diperkuat cincin spiral kitin (taenidia) agar tidak kolaps.',
      fakta: [
        'Cabang terhalus (<b>trakeol</b>) berdiameter kurang dari 1 µm dan menembus hingga ke dalam serat otot terbang.',
        'Percabangan trakea Drosophila mengikuti pola yang sama persis tiap individu — model utama penelitian pembentukan jaringan pipa bercabang, termasuk paru-paru manusia.',
        'Karena bergantung pada difusi, sistem trakea juga menjadi batas fisik mengapa serangga tidak bisa berukuran besar.'
      ]
    },
    'kantung-udara': {
      nama: 'Kantung Udara', latin: 'Sacci aerei', grup: 'trakea', layer: 'trachea',
      ringkas: 'Pelebaran trakea menjadi kantung tipis di toraks dan abdomen. Bekerja sebagai bellow yang dipompa oleh gerakan tubuh.',
      fakta: [
        'Memungkinkan <b>ventilasi aktif</b>, bukan sekadar difusi pasif.',
        'Sekaligus mengurangi massa jenis tubuh — menguntungkan saat terbang.'
      ]
    },


    /* =================== KONEKTOM (FlyWire) ===================
       Wilayah neuropil otak. Selama data/neuropil.json belum dibuat,
       bentuknya SKEMATIS - posisi anatomis benar, bentuk disederhanakan.
       Jalankan tools/fetch_flywire.py untuk mengganti dengan mesh asli. */
    'np-lamina': {
      nama: 'Lamina (LA)', latin: 'Lamina ganglionaris', grup: 'konektom', layer: 'connectome',
      ukuran: ['~780 kartrid', 'neuropil optik ke-1'],
      ringkas: 'Lapisan pemrosesan penglihatan pertama, tepat di balik retina. Tersusun dari kartrid — dan jumlah kartridnya <b>sama persis dengan jumlah omatidia</b>.',
      fakta: [
        'Satu omatidium → satu kartrid: peta ruang dari mata diteruskan utuh, titik demi titik.',
        'Di sinilah <b>superposisi neural</b> terjadi: enam akson fotoreseptor dari omatidia berbeda yang memandang arah sama berkumpul di satu kartrid.',
        'Nyalakan lapisan Omatidia untuk melihat pasangan strukturnya di permukaan mata.'
      ]
    },
    'np-medula': {
      nama: 'Medula (ME)', latin: 'Medulla', grup: 'konektom', layer: 'connectome',
      ukuran: ['~800 kolom', '10 lapis'],
      ringkas: 'Neuropil terbesar di otak lalat. Tersusun sebagai tumpukan sepuluh lapisan yang dipotong menjadi ratusan kolom sejajar — satu kolom per titik pandang.',
      fakta: [
        'Deteksi gerak dimulai di sini, lewat jalur terpisah untuk terang (jalur L1/T4) dan gelap (jalur L2/T5).',
        'Bersama lobula dan lobula plate, medula menjadikan lobus optik pemilik porsi neuron terbesar di otak.',
        'Struktur berlapis-berkolom ini sepenuhnya terpetakan di konektom FlyWire.'
      ]
    },
    'np-lobula': {
      nama: 'Lobula (LO)', latin: 'Lobula', grup: 'konektom', layer: 'connectome',
      ringkas: 'Neuropil optik ketiga. Memuat neuron yang merespons ciri-ciri tertentu: objek kecil bergerak, bayangan yang membesar, sosok sejenis.',
      fakta: [
        'Neuron LC (lobula columnar) di sini memicu perilaku langsung — misalnya refleks kabur saat ada bayangan mendekat.',
        'Menjadi jembatan antara pengolahan citra mentah dan keputusan perilaku.'
      ]
    },
    'np-lobula-plate': {
      nama: 'Lobula Plate (LOP)', latin: 'Lobula plate', grup: 'konektom', layer: 'connectome',
      ukuran: ['~60 sel LPTC'],
      ringkas: 'Lempeng tipis di belakang lobula, berisi sel tangensial raksasa (LPTC) yang membaca aliran optik seluruh medan pandang.',
      fakta: [
        'Sel <b>HS</b> (horizontal) dan <b>VS</b> (vertikal) di sini termasuk neuron paling banyak dipelajari dalam sejarah neurosains serangga — cukup besar untuk ditusuk elektroda.',
        'Keluarannya langsung dipakai untuk mengoreksi arah terbang, bersama sinyal halter.'
      ]
    },
    'np-lobus-antena': {
      nama: 'Lobus Antena (AL)', latin: 'Lobus antennalis', grup: 'konektom', layer: 'connectome',
      ukuran: ['~50 glomerulus'],
      ringkas: 'Stasiun pertama penciuman. Akson dari neuron olfaktori antena bermuara di sini, dikelompokkan ke dalam sekitar 50 bola serabut (glomerulus) — satu glomerulus untuk satu jenis reseptor bau.',
      fakta: [
        'Setara dengan bulbus olfaktorius pada mamalia, dengan prinsip penataan yang hampir identik.',
        'Peta glomerulusnya konsisten antarindividu sehingga tiap glomerulus punya nama tetap (DM1, VA1v, dan seterusnya).',
        'Dari sini bau bercabang dua: ke badan jamur (dipelajari) dan ke tanduk lateral (bawaan).'
      ]
    },
    'np-tanduk-lateral': {
      nama: 'Tanduk Lateral (LH)', latin: 'Cornu laterale', grup: 'konektom', layer: 'connectome',
      ringkas: 'Tujuan kedua jalur penciuman. Menangani respons bau yang <b>bawaan</b> — tidak perlu dipelajari.',
      fakta: [
        'Bau predator atau bau busuk berbahaya memicu penghindaran lewat jalur ini tanpa pengalaman sebelumnya.',
        'Berpasangan dengan badan jamur yang menangani bau hasil pembelajaran.'
      ]
    },
    'np-mb-kaliks': {
      nama: 'Kaliks Badan Jamur (CA)', latin: 'Calyx corporis pedunculati', grup: 'konektom', layer: 'connectome',
      ukuran: ['~2.200 sel Kenyon'],
      ringkas: 'Mangkuk dendrit badan jamur, tempat sekitar 2.200 <b>sel Kenyon</b> per belahan otak menerima masukan bau dari lobus antena.',
      fakta: [
        'Tiap sel Kenyon mengambil masukan dari beberapa glomerulus secara acak — menghasilkan kode jarang (sparse code) yang membuat bau mudah dibedakan.',
        'Pengacakan ini adalah salah satu temuan paling berpengaruh dari konektom badan jamur.'
      ]
    },
    'np-mb-pedunkulus': {
      nama: 'Pedunkulus (PED)', latin: 'Pedunculus', grup: 'konektom', layer: 'connectome',
      ringkas: 'Berkas akson sel Kenyon yang berjalan dari kaliks ke depan menuju lobus badan jamur. Bentuknya seperti tangkai jamur — dari sinilah namanya.',
      fakta: ['Seluruh ~2.200 akson berjalan sejajar rapat, sehingga mudah dilacak dalam data mikroskop elektron.']
    },
    'np-mb-lobus': {
      nama: 'Lobus Badan Jamur', latin: 'Lobi corporis pedunculati', grup: 'konektom', layer: 'connectome',
      ukuran: ['lobus α/β/γ'],
      ringkas: 'Ujung keluaran badan jamur, bercabang menjadi lobus vertikal (α, α′) dan medial (β, β′, γ). <b>Pusat pembelajaran dan ingatan</b> pada serangga.',
      fakta: [
        'Neuron dopamin membawa sinyal "hadiah" atau "hukuman" ke bagian (compartment) tertentu di lobus ini.',
        'Kombinasi bau + sinyal dopamin melemahkan sinaps tertentu — itulah wujud fisik sebuah ingatan yang terbentuk.',
        'Pembagian compartment-nya baru bisa dipetakan lengkap setelah ada data konektom.'
      ]
    },
    'np-badan-kipas': {
      nama: 'Badan Kipas (FB)', latin: 'Corpus fasciculatum', grup: 'konektom', layer: 'connectome',
      ringkas: 'Struktur berlapis di tengah kompleks sentral. Terlibat dalam navigasi, pengaturan tidur, dan pemilihan tindakan.',
      fakta: [
        'Susunannya berupa kisi rapi: beberapa lapis horizontal dikali beberapa kolom vertikal.',
        'Neuron tidur yang mendorong lalat beristirahat berpusat di sini.',
        'Bersama badan elipsoid dan jembatan protoserebral membentuk <b>kompleks sentral</b> — sistem navigasi lalat.'
      ]
    },
    'np-badan-elipsoid': {
      nama: 'Badan Elipsoid (EB)', latin: 'Corpus ellipsoideum', grup: 'konektom', layer: 'connectome',
      ringkas: 'Cincin donat di pusat otak. Di sinilah lalat menyimpan <b>arah hadapnya</b> terhadap dunia luar — kompas biologis.',
      fakta: [
        'Neuron E-PG membentuk "benjolan" aktivitas yang berputar mengelilingi cincin tepat seiring lalat berbelok.',
        'Ini adalah bukti fisik pertama sebuah <b>ring attractor</b> di otak hewan mana pun — struktur yang sebelumnya hanya berupa teori.',
        'Konektom FlyWire memperlihatkan kabel yang membuat mekanisme ini bekerja, sambungan demi sambungan.'
      ]
    },
    'np-jembatan-protoserebral': {
      nama: 'Jembatan Protoserebral (PB)', latin: 'Pons cerebralis', grup: 'konektom', layer: 'connectome',
      ukuran: ['18 glomerulus'],
      ringkas: 'Batang melintang di bagian belakang otak, terbagi menjadi 18 glomerulus yang tersusun berpasangan kiri-kanan.',
      fakta: [
        'Membandingkan isyarat dari kedua sisi tubuh untuk menghitung seberapa jauh lalat sudah berputar.',
        'Bersama badan elipsoid membentuk lingkar umpan balik yang menjaga kompas tetap akurat.'
      ]
    },
    'np-noduli': {
      nama: 'Noduli (NO)', latin: 'Noduli', grup: 'konektom', layer: 'connectome',
      ringkas: 'Sepasang bola kecil di dasar kompleks sentral. Membawa informasi kecepatan gerak maju dan menyamping.',
      fakta: ['Menggabungkan arah hadap (dari kompas) dengan kecepatan — bahan mentah untuk <b>path integration</b>, kemampuan pulang lewat jalur terpendek.']
    },
    'np-aotu': {
      nama: 'Tuberkel Optik Anterior (AOTU)', latin: 'Tuberculum opticum anterius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Simpul relai kecil yang meneruskan informasi penglihatan dari lobus optik ke kompleks sentral.',
      fakta: [
        'Membawa isyarat penunjuk arah — misalnya posisi matahari atau pola polarisasi langit — ke kompas.',
        'Jalur AOTU → bulb → badan elipsoid adalah rute baku bagi lalat untuk mengunci arah.'
      ]
    },
    'np-gng': {
      nama: 'Ganglion Gnatal (GNG)', latin: 'Ganglia gnathalia', grup: 'konektom', layer: 'connectome',
      ringkas: 'Bagian paling ventral otak, setara dengan zona subesofageal. Menerima seluruh masukan rasa dan mengendalikan otot alat mulut.',
      fakta: [
        'Semua sensor rasa dari labelum dan tarsus bermuara di sini.',
        'Juga menjadi jalur lewat bagi perintah dari otak menuju tali saraf ventral.',
        'Termasuk dalam cakupan konektom FlyWire, berbeda dengan tali saraf ventral yang dipetakan terpisah.'
      ]
    },

    /* =================== SARAF TEPI =================== */
    'saraf-antena': {
      nama: 'Saraf Antena', latin: 'Nervus antennalis', grup: 'saraf', layer: 'nerve',
      ukuran: ['sepasang', '±1.800 akson'],
      ringkas: 'Urat saraf tebal yang membawa seluruh informasi dari antena masuk ke otak: bau dari funikulus dan getaran udara dari organ Johnston.',
      fakta: [
        'Isinya dua jenis serabut sekaligus — pencium (menuju lobus antena) dan pendengar (menuju AMMC).',
        'Pendek sekali karena antena menempel langsung di depan otak; itu sebabnya lalat bereaksi terhadap bau dalam hitungan milidetik.'
      ]
    },
    'saraf-labial': {
      nama: 'Saraf Labial', latin: 'Nervus labialis', grup: 'saraf', layer: 'nerve',
      ringkas: 'Membawa sinyal rasa dari bulu pengecap di labelum naik ke ganglion gnatal, dan membawa perintah balik ke otot probosis.',
      fakta: [
        'Jalur dua arah: rasa masuk, perintah gerak keluar.',
        'Lengkung refleks penjuluran probosis lewat saraf ini — dari lidah menyentuh gula sampai belalai terjulur.'
      ]
    },
    'saraf-tungkai': {
      nama: 'Saraf Tungkai', latin: 'Nervi pedales', grup: 'saraf', layer: 'nerve',
      ukuran: ['3 pasang'],
      ringkas: 'Tiga pasang urat saraf dari ganglion toraks menuju pangkal tiap tungkai. Membawa perintah ke otot kaki, dan membawa balik sinyal sentuh, rasa, serta posisi sendi.',
      fakta: [
        'Tiap tungkai digerakkan oleh puluhan neuron motorik saja — jauh lebih sedikit daripada vertebrata.',
        'Juga membawa sinyal dari bulu pengecap di tarsus, sehingga lalat "mencicipi" begitu mendarat.',
        'Ganglionnya sendiri dipetakan dalam dataset tali saraf terpisah, bukan FlyWire.'
      ]
    },
    'saraf-sayap': {
      nama: 'Saraf Sayap', latin: 'Nervus alaris', grup: 'saraf', layer: 'nerve',
      ringkas: 'Menuju otot kendali di pangkal sayap sekaligus membawa balik sinyal dari sensor regangan pada urat sayap.',
      fakta: [
        'Otot kendali langsung yang dilayaninya bertipe sinkron — satu impuls, satu kontraksi — sehingga arah terbang bisa diatur sangat halus.',
        'Sensor pada urat sayap melaporkan lenturan sayap tiap kepakan.'
      ]
    },
    'saraf-halter': {
      nama: 'Saraf Halter', latin: 'Nervus halteris', grup: 'saraf', layer: 'nerve',
      ukuran: ['pendek & tebal'],
      ringkas: 'Urat saraf terpendek namun paling cepat: dari medan sensila di pangkal halter langsung ke otot kendali sayap.',
      fakta: [
        'Sengaja dibuat sangat pendek agar koreksi keseimbangan selesai dalam <b>±5 milidetik</b>.',
        'Inilah lengkung refleks tercepat yang dikenal pada serangga.'
      ]
    },
    'saraf-abdomen': {
      nama: 'Saraf Abdomen', latin: 'Nervi abdominales', grup: 'saraf', layer: 'nerve',
      ringkas: 'Berkas saraf tunggal yang berjalan ke belakang dari ganglion toraks, bercabang ke tiap ruas perut.',
      fakta: [
        'Melayani otot perut, saluran cerna, dan organ reproduksi.',
        'Mengatur gerak memompa abdomen yang membantu pernapasan lewat trakea.',
        'Juga membawa perintah saat betina meletakkan telur.'
      ]
    },
    'saraf-giant-fiber': {
      nama: 'Serabut Raksasa', latin: 'Fibra gigantea', grup: 'saraf', layer: 'nerve',
      ukuran: ['sepasang', 'akson terbesar'],
      ringkas: 'Sepasang akson berdiameter luar biasa besar yang menghubungkan otak langsung ke otot lompat di toraks. Jalur khusus untuk kabur.',
      fakta: [
        'Makin tebal sebuah akson, makin cepat sinyal merambat. Serabut ini sengaja dibuat setebal mungkin — mengorbankan ruang demi kecepatan.',
        'Dari bayangan mendekat sampai kaki melontar tubuh: sekitar <b>satu per seribu detik</b> untuk sinyalnya lewat.',
        'Menjadi sistem model klasik untuk mempelajari bagaimana keputusan cepat dibuat di otak.'
      ]
    },

    /* =================== BENTUK SEL SARAF ===================
       Berkas serabut di dalam otak. Jalurnya benar secara anatomis,
       bentuk tiap selnya disederhanakan. Bukan rekonstruksi FlyWire —
       jalankan tools/fetch_neurons.py untuk skeleton asli. */
    'nrn-fotoreseptor': {
      nama: 'Akson Fotoreseptor', latin: 'Axones photoreceptorum', grup: 'neuron', layer: 'neuron',
      ukuran: ['±780 serabut/mata', 'peta 1:1'],
      ringkas: 'Serabut yang membawa cahaya-yang-sudah-jadi-sinyal dari tiap faset mata masuk ke lamina. <b>Satu faset mengirim ke satu kartrid</b> — dan urutannya dijaga persis, sehingga peta dunia dari mata tersalin utuh ke dalam otak.',
      fakta: [
        'Di model ini tiap serabut benar-benar ditarik dari faset yang sesuai — bukan sekadar berkas hiasan. Nyalakan lapisan Omatidia untuk melihat pasangannya.',
        'Susunan yang menjaga urutan ini disebut <b>peta retinotopik</b>; prinsip yang sama juga dipakai mata manusia.',
        'R1–R6 berhenti di lamina; R7–R8 menembus terus sampai ke medula.'
      ]
    },
    'nrn-khiasma-luar': {
      nama: 'Khiasma Luar', latin: 'Chiasma externum', grup: 'neuron', layer: 'neuron',
      ringkas: 'Berkas serabut dari lamina ke medula yang <b>saling menyilang</b>. Urutan depan-belakang jadi terbalik — persis seperti setumpuk kabel yang dipuntir setengah putaran.',
      fakta: [
        'Persilangan ini bukan kesalahan susunan, melainkan konsekuensi geometri saat lobus optik terbentuk di tahap pupa.',
        'Perhatikan dari sudut pandang atas (tombol Dorsal) — pola silangnya paling jelas dari sana.',
        'Otak "tahu" urutannya terbalik dan memperhitungkannya di tahap berikutnya.'
      ]
    },
    'nrn-khiasma-dalam': {
      nama: 'Khiasma Dalam', latin: 'Chiasma internum', grup: 'neuron', layer: 'neuron',
      ringkas: 'Persilangan kedua, dari medula menuju lobula dan lobula plate. Urutannya terbalik sekali lagi, jadi kembali seperti semula.',
      fakta: [
        'Serabut yang menuju <b>lobula plate</b> adalah sel T4 dan T5 — pendeteksi arah gerak.',
        'T4 menangani gerakan benda terang, T5 menangani gerakan benda gelap. Dua jalur terpisah sejak dari medula.'
      ]
    },
    'nrn-pn-olfaktori': {
      nama: 'Neuron Proyeksi Olfaktori', latin: 'Neuroni projicientes', grup: 'neuron', layer: 'neuron',
      ukuran: ['±150 neuron'],
      ringkas: 'Serabut yang membawa informasi bau keluar dari lobus antena menuju dua tujuan sekaligus: kaliks badan jamur dan tanduk lateral.',
      fakta: [
        'Percabangan dua arah ini penting: satu cabang ke tempat bau <b>dipelajari</b>, satu cabang ke tempat respons <b>bawaan</b>.',
        'Karena itu lalat bisa sekaligus menghindari bau berbahaya secara naluriah dan mengingat bau yang pernah menguntungkan.',
        'Tiap neuron umumnya mengambil dari satu glomerulus saja, sehingga identitas baunya tetap terjaga.'
      ]
    },
    'nrn-kenyon': {
      nama: 'Sel Kenyon', latin: 'Cellulae Kenyoni', grup: 'neuron', layer: 'neuron',
      ukuran: ['±2.200 per belahan'],
      ringkas: 'Sel penyusun badan jamur. Dendritnya menerima bau di kaliks, aksonnya berjalan rapat menyusuri pedunkulus, lalu bercabang ke lobus vertikal dan lobus medial.',
      fakta: [
        'Tiap sel mengambil masukan dari <b>beberapa glomerulus secara acak</b> — hasilnya kode yang sangat "jarang", cuma sedikit sel menyala untuk tiap bau. Itu membuat bau mudah dibedakan.',
        'Ingatan terbentuk di ujung aksonnya: bau + sinyal dopamin melemahkan sinaps tertentu.',
        'Struktur ini adalah padanan hipokampus pada serangga.'
      ]
    },
    'nrn-epg': {
      nama: 'Neuron Kompas (E-PG)', latin: 'Neuroni E-PG', grup: 'neuron', layer: 'neuron',
      ukuran: ['±16 neuron'],
      ringkas: 'Serabut yang menghubungkan badan elipsoid dengan jembatan protoserebral. Hanya belasan sel, tetapi merekalah yang menyimpan <b>arah hadap</b> lalat.',
      fakta: [
        'Aktivitasnya membentuk satu "benjolan" yang berputar mengelilingi cincin persis seiring lalat berbelok — seperti jarum kompas.',
        'Benjolan itu tetap bertahan walau lalat berada dalam gelap total; jadi ini ingatan arah, bukan sekadar penerusan sinyal.',
        'Perhatikan separuh serabutnya menyeberang ke sisi otak yang berlawanan — penyeberangan itulah yang membuat cincin kompasnya tersambung utuh.'
      ]
    },
    'nrn-desenden': {
      nama: 'Neuron Desenden', latin: 'Neuroni descendentes', grup: 'neuron', layer: 'neuron',
      ukuran: ['±1.300 neuron'],
      ringkas: 'Seluruh perintah dari otak menuju tubuh harus melewati leher yang sempit ini. Dari ribuan keputusan di otak, hanya sekitar 1.300 serabut yang membawanya turun.',
      fakta: [
        'Leher botol yang sangat ketat: otak memuat 139.000 neuron, tetapi yang menembus ke tubuh hanya ±1%.',
        'Artinya otak harus <b>meringkas</b> keputusannya menjadi sedikit perintah sederhana sebelum dikirim.',
        'Di sinilah konektom FlyWire (otak) bertemu dataset tali saraf (tubuh) — titik sambung antara dua peta.'
      ]
    },

    /* ---- wilayah neuropil tambahan (lengkap 43 wilayah atlas FlyWire) ---- */
    'np-ame': {
      nama: 'Medula Aksesori (AME)', latin: 'Medulla accessoria', grup: 'konektom', layer: 'connectome',
      ringkas: 'Neuropil mungil di tepi medial medula. Kecil, tetapi menjadi pusat <b>jam biologis</b> lalat.',
      fakta: [
        'Neuron jam (s-LNv) bercabang di sini dan mengatur irama harian tidur–bangun.',
        'Penelitian pada gen <i>period</i> di jalur inilah yang meraih Hadiah Nobel 2017.'
      ]
    },
    'np-bu': {
      nama: 'Bulb (BU)', latin: 'Bulbus', grup: 'konektom', layer: 'connectome',
      ringkas: 'Simpul relai kecil yang meneruskan isyarat penunjuk arah dari tuberkel optik anterior ke badan elipsoid.',
      fakta: ['Rute AOTU → bulb → badan elipsoid adalah jalur baku bagi lalat untuk mengunci arah hadap.']
    },
    'np-ga': {
      nama: 'Gall (GA)', latin: 'Galla', grup: 'konektom', layer: 'connectome',
      ringkas: 'Struktur kecil berpasangan di dekat bulb, bagian dari rangkaian kompleks sentral.',
      fakta: ['Menjadi salah satu tempat keluaran badan elipsoid diteruskan.']
    },
    'np-lal': {
      nama: 'Lobus Aksesori Lateral (LAL)', latin: 'Lobus accessorius lateralis', grup: 'konektom', layer: 'connectome',
      ringkas: 'Gerbang <b>keluaran utama</b> kompleks sentral. Keputusan "belok ke mana" diterjemahkan di sini menjadi perintah yang dikirim turun ke tubuh.',
      fakta: [
        'Sebagian besar neuron desenden pengendali arah berpangkal di sekitar LAL.',
        'Menjadi titik temu antara kompas di kompleks sentral dan otot penggerak.'
      ]
    },
    'np-slp': {
      nama: 'Protoserebrum Superior Lateral (SLP)', latin: 'Protocerebrum superius laterale', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah pengolahan tingkat tinggi di bagian atas-samping otak; menerima masukan dari keluaran badan jamur dan tanduk lateral.',
      fakta: ['Tempat informasi bau yang sudah dipelajari bertemu dengan respons bawaan.']
    },
    'np-sip': {
      nama: 'Protoserebrum Superior Intermediat (SIP)', latin: 'Protocerebrum superius intermedium', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah di antara SLP dan SMP, berdekatan dengan ujung lobus vertikal badan jamur.',
      fakta: ['Banyak neuron keluaran badan jamur berakhir di sini.']
    },
    'np-smp': {
      nama: 'Protoserebrum Superior Medial (SMP)', latin: 'Protocerebrum superius mediale', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah atas dekat garis tengah. Titik pertemuan banyak jalur sekaligus — termasuk sinyal lapar, kenyang, dan hormon.',
      fakta: ['Banyak neuron neuromodulator (dopamin, oktopamin) bercabang luas di sini.']
    },
    'np-scl': {
      nama: 'Klamp Superior (SCL)', latin: 'Clamp superius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah yang mengapit lobus badan jamur dari sisi atas.',
      fakta: ['Bernama "klamp" karena posisinya menjepit pedunkulus badan jamur.']
    },
    'np-icl': {
      nama: 'Klamp Inferior (ICL)', latin: 'Clamp inferius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Pasangan bawah dari klamp superior, mengapit lobus badan jamur dari sisi bawah.',
      fakta: ['Bersama SCL menjadi wilayah penghubung antara badan jamur dan kompleks sentral.']
    },
    'np-ib': {
      nama: 'Jembatan Inferior (IB)', latin: 'Pons inferior', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah melintang di bawah kompleks sentral yang menghubungkan kedua belahan otak.',
      fakta: ['Salah satu jalur penyeberangan kiri–kanan di bagian tengah otak.']
    },
    'np-atl': {
      nama: 'Antler (ATL)', latin: 'Antler', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah kecil bercabang di dekat kompleks sentral; namanya diambil dari bentuknya yang menyerupai tanduk rusa.',
      fakta: ['Termasuk kelompok wilayah yang mengelilingi dan melayani kompleks sentral.']
    },
    'np-cre': {
      nama: 'Crepine (CRE)', latin: 'Crepis', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah yang membungkus ujung lobus medial badan jamur.',
      fakta: ['Banyak neuron dopamin pembawa sinyal hadiah/hukuman melintasi wilayah ini.']
    },
    'np-avlp': {
      nama: 'Protoserebrum Ventrolateral Anterior (AVLP)', latin: 'Protocerebrum ventrolaterale anterius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah besar di bagian depan-bawah-samping otak; tempat berbagai jenis indra bertemu.',
      fakta: ['Menerima masukan rasa, sentuh, dan suara sekaligus.']
    },
    'np-pvlp': {
      nama: 'Protoserebrum Ventrolateral Posterior (PVLP)', latin: 'Protocerebrum ventrolaterale posterius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Sasaran utama neuron kolumnar lobula (LC) — jalur yang mengubah pemandangan menjadi tindakan.',
      fakta: [
        'Neuron LC di sini memicu refleks langsung: bayangan membesar → melompat kabur.',
        'Salah satu contoh terbaik jalur "lihat lalu lakukan" yang bisa ditelusuri utuh di konektom.'
      ]
    },
    'np-plp': {
      nama: 'Protoserebrum Lateral Posterior (PLP)', latin: 'Protocerebrum laterale posterius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah di belakang-samping otak yang memadukan penglihatan dengan sentuhan dan getaran.',
      fakta: ['Berbatasan langsung dengan lobula dan lobula plate.']
    },
    'np-wed': {
      nama: 'Wedge (WED)', latin: 'Cuneus', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah berbentuk baji yang menerima lanjutan sinyal dari organ Johnston — pendengaran dan arah angin.',
      fakta: ['Di sinilah lagu pacaran jantan diolah lebih lanjut setelah ditangkap antena betina.']
    },
    'np-ves': {
      nama: 'Vest (VES)', latin: 'Vestis', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah ventromedial di bawah kompleks sentral, dekat jalur perintah menuju tubuh.',
      fakta: ['Banyak neuron desenden melewati atau berpangkal di sekitar sini.']
    },
    'np-epa': {
      nama: 'Epaulette (EPA)', latin: 'Epaulettum', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah kecil di sisi bawah-belakang otak, bertetangga dengan vest dan gorget.',
      fakta: ['Termasuk kelompok wilayah ventromedial yang melayani kendali gerak.']
    },
    'np-gor': {
      nama: 'Gorget (GOR)', latin: 'Gorgetum', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah ventromedial di bawah vest.',
      fakta: ['Bersama vest dan epaulette membentuk lapisan bawah otak tengah.']
    },
    'np-sps': {
      nama: 'Lereng Posterior Superior (SPS)', latin: 'Declive posterius superius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Sasaran utama sinyal <b>aliran optik</b> dari lobula plate — bahan mentah untuk menjaga arah terbang tetap lurus.',
      fakta: [
        'Sel HS dan VS dari lobula plate bermuara di wilayah ini.',
        'Banyak neuron desenden pengendali terbang berpangkal di sekitar sini — jalur terpendek dari "mata melihat tubuh miring" ke "otot mengoreksi".'
      ]
    },
    'np-ips': {
      nama: 'Lereng Posterior Inferior (IPS)', latin: 'Declive posterius inferius', grup: 'konektom', layer: 'connectome',
      ringkas: 'Pasangan bawah dari lereng posterior superior; juga menerima sinyal gerak dan menyalurkannya ke jalur perintah.',
      fakta: ['Bersama SPS menjadi simpul utama kendali terbang di otak belakang.']
    },
    'np-sad': {
      nama: 'Saddle (SAD)', latin: 'Sella', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah pelana di atas ganglion gnatal; menerima masukan rasa dan sentuh dari daerah mulut.',
      fakta: ['Bagian dari kelompok periesofageal yang mengelilingi kerongkongan.']
    },
    'np-prw': {
      nama: 'Prow (PRW)', latin: 'Prora', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah paling depan-bawah otak, tepat di atas pangkal probosis.',
      fakta: ['Menerima sinyal dari reseptor di dinding faring — memeriksa makanan saat sedang ditelan.']
    },
    'np-fla': {
      nama: 'Flange (FLA)', latin: 'Flangea', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah tipis di sisi kerongkongan, bagian dari kelompok periesofageal.',
      fakta: ['Termasuk wilayah yang mengelilingi lubang tempat kerongkongan menembus otak.']
    },
    'np-can': {
      nama: 'Cantle (CAN)', latin: 'Cantulus', grup: 'konektom', layer: 'connectome',
      ringkas: 'Wilayah periesofageal kecil di bagian bawah otak.',
      fakta: ['Bertetangga dengan saddle dan flange.']
    },
    'np-ammc': {
      nama: 'Pusat Mekanosensori Antena (AMMC)', latin: 'Centrum mechanosensorium antennale', grup: 'konektom', layer: 'connectome',
      ringkas: 'Stasiun pertama <b>pendengaran</b>. Seluruh serabut dari organ Johnston di pedisel antena bermuara di sini.',
      fakta: [
        'Setara dengan inti pendengaran batang otak pada vertebrata.',
        'Getaran arista → organ Johnston → AMMC → wedge: itulah jalur "telinga" lalat, seluruhnya terpetakan di konektom.',
        'Juga mengukur kecepatan angin saat terbang.'
      ]
    },
    'np-ocg': {
      nama: 'Ganglion Oselar (OCG)', latin: 'Ganglion ocellare', grup: 'konektom', layer: 'connectome',
      ringkas: 'Simpul kecil tepat di bawah ketiga oselus, tempat sinyalnya diolah sebelum masuk ke otak.',
      fakta: [
        'Jalurnya sangat pendek — itulah sebabnya koreksi sikap tubuh dari oselus lebih cepat daripada dari mata majemuk.',
        'Keluarannya langsung menuju neuron desenden pengendali terbang.'
      ]
    },
  };

  /* --------- info umum spesies --------- */
  const SPESIES = {
    nama: 'Lalat Buah', latin: 'Drosophila melanogaster Meigen, 1830',
    klasifikasi: 'Insecta › Diptera › Brachycera › Acalyptratae › Drosophilidae',
    fakta: [
      'Panjang tubuh betina ±2,5 mm, jantan ±2,1 mm; rentang sayap ±5 mm.',
      'Daur hidup lengkap 9–10 hari pada 25 °C; umur dewasa 40–50 hari.',
      'Hewan model paling produktif dalam sejarah biologi — penelitian dengan lalat ini berkontribusi pada setidaknya lima Hadiah Nobel (1933, 1946, 1995, 2011, 2017).',
      'Sekitar 60% gen penyakit manusia punya padanan pada Drosophila.',
      'Otaknya adalah otak hewan dewasa pertama yang dipetakan lengkap sampai tingkat sinapsis (FlyWire, 2024).'
    ]
  };

  global.ANATOMI = { GROUPS: GROUPS, PARTS: P, SPESIES: SPESIES };
})(window);
