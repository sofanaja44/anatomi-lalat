/* ==========================================================
   alive.js - bootstrap halaman alive.html.

   Sengaja TERPISAH dari js/app.js (bukan mode/opsi di halaman yang sama):
     - Tidak memuat data/neurons.json (79 MB, geometri 2,5 juta ruas garis
       lapisan "Sel saraf") sama sekali - simulasi otak cuma butuh tahu
       BUNDEL tiap neuron (sensorik/motorik/dst), bukan bentuk 3D-nya.
       Dipakai data/neuron-bundle.json (peta ringan ~75 KB, root_id -> id
       bundel, ditulis tools/fetch_flywire_skeletons.py).
     - Tidak memuat js/connectome.js (mesh neuropil otak) & js/neurons.js
       (geometri sel saraf) & js/signal.js (animasi pulsa per-klik) sama
       sekali - tak dipakai kalau organ/otak tak pernah ditampilkan.
     - Tak ada sidebar/inspector/toolbar lapisan/raycasting klik - cuma
       kamera orbit + kanvas, badan lalat SELALU tampil utuh apa adanya
       (bukan x-ray, organ dalam & lapisan saraf tak pernah dinyalakan).

   Otak (js/brain-sim.js) dan gerak tubuhnya sama persis dengan yang ada
   di js/app.js -> updateBrainSim() - lihat komentar di sana untuk rincian
   model & penyederhanaannya. Duplikasi kecil ini disengaja: dua halaman
   ini punya siklus hidup independen (lihat instruksi pengguna yang minta
   dipisah dari halaman eksplorasi anatomi).
   ========================================================== */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const CANVAS = $('#scene');
  const K = FLY.SCALE;

  let renderer, scene, camera, controls, model, clock, tAcc = 0;
  let backdrop, shadowPlane;
  let BSIM = null, alive = true;
  let flapAmp = 0, haltAmp = 0, legAmp = 0;
  // Frekuensi kepak/langkah IKUT naik-turun dari dorongan motor otak (dulu
  // tetap 5.2 Hz / 2.4 Hz konstan - cuma amplitudonya yang dari otak, jadi
  // ritme geraknya terasa "sudah diset"). wingPhase/legPhase diintegrasi
  // sendiri (bukan tAcc*freq langsung) supaya perubahan frekuensi tak
  // bikin lompatan fase yang kelihatan patah-patah.
  let wingPhase = 0, legPhase = 0, flapFreq = 4.2, stepFreqLive = 1.6;

  /* ----------------------------------------------------------
     JALAN vs TERBANG - dua perilaku beda, bukan cuma "kepak terus di
     tempat". Berjalan: sayap DIAM terlipat, kaki melangkah, di tanah.
     Terbang: sayap ngepak terus (memang begitu di lalat sungguhan -
     ngepak itu sekali mulai ya berkelanjutan selama di udara, bukan
     dikepakkan satu-satu per pikiran), kaki ditarik diam, badan naik
     & melaju lebih cepat.

     Pemicu pindah state: BURST aktivitas motor otak relatif terhadap
     rata-rata berjalannya sendiri (motorEMA, exponential moving average
     ~6 detik) - supaya adaptif ke skala aktivitas jaringan yang mana pun
     (bukan angka mutlak yang cuma pas untuk satu sesi). WALK_MAX/FLY_MAX
     adalah jaring pengaman jujur: kalau jaringan yang disederhanakan ini
     kebetulan mendatar terlalu lama (tak pernah "meletup" relatif), tetap
     dipaksa berganti state biar tak macet selamanya - bukan berarti
     terbang/jalannya sendiri dipalsukan, cuma PEMICU gantinya yang dijaga
     batas waktu, keputusan arah/kecepatan tetap dari otak (lihat bawah).
     ---------------------------------------------------------- */
  let flying = false, stateTimer = 0, motorEMA = 0;
  let flapAmpS = 0, legAmpS = 0;   // versi dihaluskan flapAmp/legAmp, biar pindah jalan<->terbang tak "patah"

  // Mulut (labelum/probosis) "ndabbing" - dipicu tembakan spontan neuron
  // sensorik di brain-sim.js (state.sensoryFire, lihat brain-sim.js baris
  // ~137-142: "pengganti input dunia nyata"). Murni kosmetik ATAS hasil
  // otak (sama semangatnya dengan js/signal.js) - bukan brain-sim.js yang
  // dimodifikasi, cuma dibaca outputnya di sini.
  let mouthPulse = 0, mouthPhase = 0;
  let altBase = 0;                 // tinggi badan saat ini (dihaluskan), 0 = di tanah
  const FLY_ALT = 2.4 * K;         // tinggi jelajah waktu terbang
  const STATE_MIN = 1.4, WALK_MAX = 16, FLY_MAX = 11;

  // Arena tempat lalat jalan-jalan/terbang: lingkaran radius ARENA_R di
  // sekitar pusat (0,0). heading = arah hadap kumulatif (radian, tak
  // dibatasi), diputar pelan oleh asimetri motor kiri/kanan otak +
  // dorongan kembali ke tengah kalau kepentok tepi arena (lihat
  // updateBrainSim). Diperbesar dari versi awal (3.0*K) - dunia lama
  // kerasa sempit buat kombinasi jalan+terbang bebas.
  const ARENA_R = 7.5 * K;
  let heading = TEX.rnd() * Math.PI * 2;

  function init() {
    renderer = new THREE.WebGLRenderer({
      canvas: CANVAS, antialias: true, alpha: false, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0c10, 34 * K, 90 * K);

    camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.01, 400);
    camera.position.set(11 * K, 3.4 * K, 5.5 * K);

    controls = new Orbit(camera, CANVAS);
    controls.target.set(0, -0.35 * K, 0.1 * K);
    controls.minDistance = 1.4 * K;
    controls.maxDistance = 40 * K;
    // TIDAK autoRotate: kamera tak berputar sendiri, biar arah jalan yang
    // digerakkan otak (lihat heading di updateBrainSim) jelas terlihat -
    // titik yang dikelilingi kamera (controls.setTarget, dipanggil tiap
    // frame di animate()) mengikuti posisi lalat berkeliling arena.
    // Pengguna tetap bisa putar/zoom manual (drag/scroll).
    controls.autoRotate = false;
    controls.flyTo({
      theta: Math.PI / 2, phi: Math.PI / 2 - 0.16, radius: 13.5 * K,
      target: new THREE.Vector3(0, -0.25 * K, 0.1 * K), duration: 0.01
    });

    lights();
    setEnvironment();
    environment();
    buildWorld();

    clock = new THREE.Clock();
    addEventListener('resize', onResize);
  }

  function lights() {
    const hemi = new THREE.HemisphereLight(0x9ec4e8, 0x201a14, 0.22);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e2, 0.85);
    key.position.set(6, 9, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fc0f0, 0.26);
    fill.position.set(-8, 2.5, -4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffcf95, 0.55);
    rim.position.set(-2.5, -2.5, -9);
    scene.add(rim);
    const spark = new THREE.PointLight(0xfff0dd, 2.2, 16, 2);
    spark.position.set(3.4, 2.8, 6.8);
    scene.add(spark);
  }

  function setEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const src = TEX.envEquirect(false);
    scene.environment = pmrem.fromEquirectangular(src).texture;
    src.dispose();
    pmrem.dispose();
  }

  function environment() {
    const g = new THREE.SphereGeometry(120, 32, 24);
    const m = new THREE.MeshBasicMaterial({
      map: TEX.backdrop('#1a2029', '#07090d'), side: THREE.BackSide, depthWrite: false, fog: false
    });
    backdrop = new THREE.Mesh(g, m);
    scene.add(backdrop);

    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const rg = x.createRadialGradient(128, 128, 4, 128, 128, 124);
    rg.addColorStop(0, 'rgba(0,0,0,.62)');
    rg.addColorStop(.45, 'rgba(0,0,0,.28)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
    const st = new THREE.CanvasTexture(c);
    shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: .85 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0.1 * K, FLY.GROUND - 0.015 * K, 0.1 * K);
    shadowPlane.scale.set(0.72 * K, 0.62 * K, 1);
    scene.add(shadowPlane);
  }

  /** Cuma bentuk LUAR lalat - organ dalam, otot, saraf, trakea tetap
      dibangun oleh FLY.build() (satu paket, tak bisa dipisah saat bangun)
      tapi langsung disembunyikan di sini, permanen (tak ada UI togglenya
      di halaman ini - sesuai permintaan: "cuma bentuk lalatnya saja"). */
  function showBodyOnly() {
    const VISIBLE = { exo: 1, wing: 1, leg: 1, seta: 1, eye: 1 };
    model.parts.forEach(p => { p.visible = !!VISIBLE[p.userData.layer]; });
    ['muscle', 'internal', 'nerve', 'trachea'].forEach(k => {
      if (model.layerRoots[k]) model.layerRoots[k].visible = false;
    });
  }

  function buildModel() {
    model = FLY.build(function (msg) {
      const el = $('#ldStep'); if (el) el.textContent = msg;
    });
    scene.add(model.root);
    model.halteres = model.parts.filter(p => p.userData.partId === 'halter');
    model.labelum = model.parts.filter(p => p.userData.partId === 'labelum');
    model.probosis = model.parts.filter(p => p.userData.partId === 'probosis');
    // simpan pose ISTIRAHAT asli (dibangun fly.js) sebelum dianimasikan -
    // dipakai sebagai titik "lipat penuh"/"diam" yang dituju animate().
    model.wings.forEach(w => { w.userData.baseY = w.rotation.y; w.userData.baseX = w.rotation.x; });
    model.labelum.forEach(l => { l.userData.baseZ = l.rotation.z; });
    model.probosis.forEach(p => { p.userData.baseY = p.position.y; });
    showBodyOnly();
  }

  /* ==========================================================
     DUNIA - tanah + beberapa properti kecil biar lalat tak jalan-jalan
     di ruang kosong. Murni dekoratif/statis (bukan bagian simulasi
     otak): daun, remah, kerikil, tetes embun, sepotong buah. Semua
     tekstur prosedural lewat <canvas>, konsisten dengan textures.js -
     tak ada berkas gambar dari luar.
     ========================================================== */
  function leafTexture(tone) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, tone[0]); g.addColorStop(1, tone[1]);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(20,40,10,.35)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(128, 8); x.lineTo(128, 248); x.stroke();
    x.lineWidth = 1.4;
    for (let i = 1; i <= 6; i++) {
      const y = 20 + i * 34;
      x.beginPath(); x.moveTo(128, y); x.lineTo(128 - 90 + i * 4, y - 20); x.stroke();
      x.beginPath(); x.moveTo(128, y); x.lineTo(128 + 90 - i * 4, y - 20); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function groundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#2c2013'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const rx = TEX.rnd() * 512, ry = TEX.rnd() * 512, r = 1 + TEX.rnd() * 2.6;
      const shade = 26 + Math.floor(TEX.rnd() * 34);
      x.globalAlpha = 0.35 + TEX.rnd() * 0.5;
      x.fillStyle = `rgb(${shade + 30},${shade + 20},${shade + 6})`;
      x.beginPath(); x.arc(rx, ry, r, 0, 6.2832); x.fill();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 40; i++) {
      const rx = TEX.rnd() * 512, ry = TEX.rnd() * 512, r = 4 + TEX.rnd() * 10;
      x.globalAlpha = 0.10 + TEX.rnd() * 0.10;
      x.fillStyle = '#5c8a3a';
      x.beginPath(); x.arc(rx, ry, r, 0, 6.2832); x.fill();
    }
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function fruitTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#e8863a'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      const rx = TEX.rnd() * 128, ry = TEX.rnd() * 128;
      x.globalAlpha = 0.25 + TEX.rnd() * 0.35;
      x.fillStyle = TEX.rnd() > 0.5 ? '#c4571f' : '#ffb35c';
      x.beginPath(); x.arc(rx, ry, 0.8 + TEX.rnd() * 1.6, 0, 6.2832); x.fill();
    }
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function leafMesh(x, z, scale, rotY, tone) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5); shape.bezierCurveTo(0.42, -0.3, 0.38, 0.35, 0, 0.55);
    shape.bezierCurveTo(-0.38, 0.35, -0.42, -0.3, 0, -0.5);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({
      map: leafTexture(tone), side: THREE.DoubleSide, roughness: 0.75, metalness: 0
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(scale);
    m.rotation.set(-Math.PI / 2 + (TEX.rnd() - 0.5) * 0.3, rotY, (TEX.rnd() - 0.5) * 0.25);
    m.position.set(x, FLY.GROUND + 0.01 * K, z);
    return m;
  }

  function pebble(x, z, r, shade) {
    const geo = new THREE.SphereGeometry(r, 8, 6);
    geo.scale(1, 0.65 + TEX.rnd() * 0.2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: shade, roughness: 0.9, metalness: 0.05 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, FLY.GROUND + r * 0.55, z);
    m.rotation.y = TEX.rnd() * Math.PI * 2;
    return m;
  }

  function buildWorld() {
    const world = new THREE.Group();
    world.name = 'world';

    // tanah bundar - jauh lebih luas dari arena jelajah (ARENA_R) biar
    // tak terasa ada "tepi dunia" waktu kamera mengikuti lalat.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(24 * K, 64),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLY.GROUND;
    world.add(ground);

    // sepotong buah - "target jalan-jalan" yang jelas kelihatan
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 * K, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: fruitTexture(), roughness: 0.55, metalness: 0.05 })
    );
    fruit.position.set(4.2 * K, FLY.GROUND, 1.8 * K);
    fruit.rotation.y = 0.4;
    world.add(fruit);
    const fruitRind = new THREE.Mesh(
      new THREE.TorusGeometry(0.5 * K, 0.04 * K, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xf4d9a8, roughness: 0.7 })
    );
    fruitRind.position.copy(fruit.position);
    fruitRind.rotation.x = Math.PI / 2;
    world.add(fruitRind);

    // daun-daun berserak (beda ukuran/rona biar tak seragam), disebar
    // lebih jauh dari pusat sekarang arenanya lebih luas.
    world.add(leafMesh(-3.6 * K, 2.8 * K, 0.7 * K, 0.6, ['#4c8a2e', '#2c5518']));
    world.add(leafMesh(1.3 * K, -4.7 * K, 0.58 * K, -1.1, ['#5a9a38', '#356420']));
    world.add(leafMesh(-5.2 * K, -3.1 * K, 0.46 * K, 2.4, ['#3f7a26', '#254a15']));
    world.add(leafMesh(5.6 * K, -2.2 * K, 0.4 * K, 1.7, ['#5a9a38', '#356420']));
    world.add(leafMesh(-1.8 * K, 5.4 * K, 0.5 * K, -0.4, ['#4c8a2e', '#2c5518']));
    world.add(leafMesh(4.4 * K, 4.6 * K, 0.44 * K, 1.0, ['#3f7a26', '#254a15']));

    // tetes embun mengilap di atas salah satu daun
    const dew = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 * K, 12, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0xdff3ff, transparent: true, opacity: 0.75, roughness: 0.05,
        metalness: 0, transmission: 0.7, thickness: 0.2, clearcoat: 1
      })
    );
    dew.position.set(-3.6 * K, FLY.GROUND + 0.1 * K, 2.95 * K);
    world.add(dew);

    // remah-remah kecil berkelompok
    const crumbGeo = new THREE.DodecahedronGeometry(0.06 * K, 0);
    const crumbMat = new THREE.MeshStandardMaterial({ color: 0xc9a15f, roughness: 0.85 });
    for (let i = 0; i < 11; i++) {
      const cm = new THREE.Mesh(crumbGeo, crumbMat);
      const a = TEX.rnd() * Math.PI * 2, r = TEX.rnd() * 0.5 * K;
      cm.position.set(-4.8 * K + Math.cos(a) * r, FLY.GROUND + 0.03 * K, -1.4 * K + Math.sin(a) * r);
      cm.rotation.set(TEX.rnd() * 6, TEX.rnd() * 6, TEX.rnd() * 6);
      const s = 0.6 + TEX.rnd() * 0.8;
      cm.scale.setScalar(s);
      world.add(cm);
    }

    // kerikil menandai pinggiran arena jelajah + agak jauh di luar arena
    // (dekat tepi tanah) biar dunianya kerasa lebih luas dari sekadar
    // arena yang dijelajahi si lalat.
    [[6.8, -5.8, 0.14], [-7.2, 5.0, 0.17], [6.0, 5.6, 0.12], [-6.2, -5.2, 0.15],
     [11.5, 3.2, 0.2], [-12.8, -6.0, 0.22], [3.5, -12.0, 0.18], [-9.6, 9.8, 0.19]]
      .forEach(([px, pz, r]) => world.add(pebble(px * K, pz * K, r * K, 0x7d7a72)));

    scene.add(world);
  }

  /* ==========================================================
     OTAK OTONOM - identik dengan js/app.js, versi tanpa geometri neuron
     (locate() di sini cuma balikin bundel dari peta ringan, bukan objek
     Three.js sungguhan - brain-sim.js tak pernah menyentuh geometri).
     ========================================================== */
  function startBrainSim(conn, bundleMap) {
    const locate = rid => {
      const b = bundleMap[rid];
      return b ? { object: { userData: { partId: b } }, index: 0 } : undefined;
    };
    BSIM = BRAINSIM.build(conn, locate);
    if (BSIM) {
      console.log('[otak] simulasi otonom dimulai (halaman ringan):', BSIM.neuronCount,
                 'neuron,', BSIM.edgeCount, 'edge - lihat js/brain-sim.js');
    }
  }

  function loadBrainData() {
    if (typeof fetch !== 'function') return;
    Promise.all([
      fetch('data/neuron-bundle.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null),
      fetch('data/connections.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
    ]).then(([bundleMap, conn]) => {
      if (!bundleMap || !conn || !conn.neurons) {
        console.warn('[otak] data konektivitas/peta bundel tak tersedia - lalat tetap diam.');
        return;
      }
      startBrainSim(conn, bundleMap);
    }).catch(err => console.warn('[otak] gagal memuat data simulasi:', err));
  }

  function updateBrainSim(dt) {
    if (!BSIM || !alive) return;
    BSIM.step(dt);
    const st = BSIM.state;

    // --- state jalan/terbang: lihat komentar besar di deklarasi variabel
    // `flying` di atas untuk penjelasan lengkap pemicunya. ---
    motorEMA += (st.motor - motorEMA) * Math.min(1, dt / 6);
    stateTimer += dt;
    const burst = st.motor > motorEMA * 1.3 + 0.006;
    const calm = st.motor < motorEMA * 0.75;
    if (!flying && stateTimer > STATE_MIN && (burst || stateTimer > WALK_MAX)) {
      flying = true; stateTimer = 0;
    } else if (flying && stateTimer > STATE_MIN && (calm || stateTimer > FLY_MAX)) {
      flying = false; stateTimer = 0;
    }

    if (flying) {
      // TERBANG: sayap ngepak terus selama di udara (begitu juga lalat
      // sungguhan - bukan dikepakkan satu-satu per pikiran), besarnya
      // tetap ikut dorongan motor. Kaki ditarik diam (lihat animate()).
      flapAmp = Math.max(0.55, Math.min(1, 0.55 + st.motor * 0.9));
      haltAmp = Math.min(1, st.overall * 2.2);   // halter aktif waktu terbang (sensor keseimbangan)
      legAmp = 0;
    } else {
      // JALAN: sayap benar-benar diam terlipat, kaki yang bergerak.
      flapAmp = 0;
      haltAmp = 0;
      legAmp = Math.min(1, st.motor * 1.3);
    }
    // frekuensi kepak/langkah: ikut naik saat dorongan motor tinggi (fly
    // yang "bersemangat" ngepak/jalan lebih cepat, bukan cuma lebih lebar).
    // Dinaikkan dari versi awal - lalat sungguhan mengepak & melangkah
    // jauh lebih cepat/gesit, versi lama kerasa terlalu berat/lambat.
    flapFreq = 9.0 + st.motor * 13.0;      // ~9-22 Hz (dulu 4.2-9.2 Hz)
    stepFreqLive = 3.2 + st.motor * 5.5;   // ~3.2-8.7 Hz (dulu 1.6-4.2 Hz)

    // mulut (labelum) "ndabbing" - dipicu tembakan spontan neuron sensorik
    // (state.sensoryFire dari brain-sim.js, lihat komentar deklarasi
    // mouthPulse di atas), meluruh eksponensial (~0.4 detik).
    if (st.sensoryFire > 0) mouthPulse = Math.min(1, mouthPulse + 0.35 * st.sensoryFire);
    mouthPulse *= Math.exp(-dt / 0.4);

    // arah hadap: dari otak (asimetri kiri/kanan = belok), ditambah dorongan
    // halus balik ke tengah arena begitu lalat mendekati tepi ARENA_R -
    // biar tetap "jalan-jalan" tapi tak pernah kabur jauh dari dunianya.
    const asym = st.motorR - st.motorL;
    let turnRate = asym * (flying ? 4.2 : 2.6);   // lebih lincah belok waktu terbang, khas lalat
    if (model) {
      const px = model.root.position.x, pz = model.root.position.z;
      const distC = Math.hypot(px, pz);
      if (distC > ARENA_R * 0.72) {
        const toCenter = Math.atan2(-px, -pz);
        let diff = toCenter - heading;
        diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;   // -PI..PI, arah putar terpendek
        const bias = Math.min(1, (distC - ARENA_R * 0.72) / (ARENA_R * 0.4));
        turnRate += diff * bias * 3.0;
      }
    }
    heading += turnRate * dt;

    if (tAcc - (updateBrainSim._t || 0) > 0.5) {
      updateBrainSim._t = tAcc;
      const pct = Math.round(st.overall * 100);
      $('#atBrainPct').textContent = pct + '%';
      $('#atBrainFill').style.width = Math.min(100, pct * 2) + '%';
      const modeEl = $('#atMode');
      if (modeEl) modeEl.textContent = flying ? '🪽 terbang' : '🦵 jalan';
    }
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    tAcc += dt;

    updateBrainSim(dt);

    // dihaluskan (~0.35s) supaya pindah jalan<->terbang tak bikin sayap/kaki
    // lompat mendadak dari diam ke gerak penuh (atau sebaliknya).
    flapAmpS += (flapAmp - flapAmpS) * Math.min(1, dt * 3.2);
    legAmpS += (legAmp - legAmpS) * Math.min(1, dt * 3.2);

    // sayap: fold = 1 waktu diam/jalan (dilipat RAPAT ke punggung, bukan
    // cuma amplitudo kepak 0 kayak sebelumnya - rotation.y/x pivot juga
    // disapu ke posisi terlipat), fold = 0 waktu terbang (dikembangkan
    // penuh + ngepak). wingPhase/halter tetap jalan tiap frame (murah)
    // supaya transisi ke fold=0 langsung siap ngepak, tak nyentak.
    wingPhase += flapFreq * Math.PI * 2 * dt;
    const a = Math.sin(wingPhase);
    const b = Math.sin(wingPhase + 1.15);
    const fold = 1 - flapAmpS;   // 1 = terlipat penuh, 0 = terbentang/ngepak penuh
    model.wings.forEach(w => {
      const s = w.userData.side;
      w.rotation.y = w.userData.baseY - s * 0.58 * fold;   // sapu ke belakang, menutup ke punggung
      w.rotation.z = w.userData.baseZ + s * a * 0.80 * flapAmpS;
      w.rotation.x = w.userData.baseX - 0.30 * fold + b * 0.26 * flapAmpS;
    });
    const wobbleAmp = Math.max(flapAmpS, haltAmp);
    if (wobbleAmp > 0.005) {
      model.halteres.forEach(h => {
        h.rotation.z = -a * 0.42 * wobbleAmp * (h.userData.side || 1);
      });
    }

    // mulut: labelum "ndabbing" pelan, dipicu tembakan sensorik (lihat
    // updateBrainSim) - lebih kentara waktu diam/jalan, ditekan waktu
    // terbang (mulut dilipat/tak dipakai selagi terbang, wajar).
    if (mouthPulse > 0.003) {
      mouthPhase += 6.0 * Math.PI * 2 * dt;
      const mp = mouthPulse * (1 - flapAmpS * 0.85);
      const md = Math.sin(mouthPhase);
      model.labelum.forEach(l => { l.rotation.z = l.userData.baseZ + md * 0.14 * mp; });
      model.probosis.forEach(p => { p.position.y = p.userData.baseY - Math.max(0, md) * 0.05 * K * mp; });
    }
    if (BSIM) {
      // sudut hadap chase `heading` (target tak terbatas, lihat updateBrainSim) -
      // beda dari yawTarget lama yang cuma goyang +-0.32 rad di tempat, ini
      // memutar badan penuh supaya lalat benar-benar bisa berputar arah.
      let dh = heading - model.root.rotation.y;
      dh = ((dh + Math.PI) % (Math.PI * 2)) - Math.PI;
      model.root.rotation.y += dh * Math.min(1, dt * (flying ? 3.4 : 2.6));

      // maju sepanjang arah hadap - kecepatan & MODE (jalan pelan di tanah
      // vs terbang lebih cepat di udara) mengikuti otak (legAmp/flapAmp,
      // lihat updateBrainSim). Ini yang membuat lalat benar-benar
      // berkeliling di arena (jalan kaki ATAU terbang), bukan cuma
      // bergoyang di satu titik.
      if (alive) {
        // dinaikkan cukup banyak dari versi awal - lalat sungguhan gesit,
        // versi lama kerasa merayap terlalu lambat baik jalan maupun terbang.
        const speed = flying ? (2.6 + flapAmpS * 3.6) * K : 1.9 * K * legAmpS;
        model.root.position.x += Math.sin(model.root.rotation.y) * speed * dt;
        model.root.position.z += Math.cos(model.root.rotation.y) * speed * dt;
      }

      // tinggi badan: naik ke FLY_ALT waktu terbang, turun ke tanah waktu
      // jalan - dihaluskan (altBase) + sedikit "goyang layang" waktu di
      // udara biar tak kaku menempel pada satu ketinggian.
      const targetAlt = flying ? FLY_ALT : 0;
      altBase += (targetAlt - altBase) * Math.min(1, dt * 1.1);
      model.root.position.y = altBase + (flying ? Math.sin(tAcc * 3.1) * 0.05 * K : 0);
    }

    // kaki: gaya jalan tripod, sama seperti js/app.js -> lihat komentar di sana.
    if (BSIM && model.legs) {
      legPhase += stepFreqLive * Math.PI * 2 * dt;
      model.legs.forEach(leg => {
        const s = Math.sin(legPhase + (leg.userData.tripod === 'A' ? 0 : Math.PI));
        leg.rotation.y = s * 0.34 * legAmpS;
        leg.rotation.z = Math.max(0, s) * 0.15 * legAmpS * (leg.userData.side || 1);
      });
    }

    // kamera & bayangan mengikuti lalat berkeliling arena (bukan cuma
    // muter di tempat) - target orbit digeser pelan-pelan (lewat
    // damping bawaan Orbit.update), pengguna tetap bisa drag/zoom bebas.
    controls.setTarget(model.root.position.x, controls.target.y, model.root.position.z + 0.1 * K);
    shadowPlane.position.x = model.root.position.x + 0.1 * K;
    shadowPlane.position.z = model.root.position.z + 0.1 * K;
    // bayangan memudar & mengecil waktu lalat terbang tinggi - penanda
    // visual murah kalau dia sedang di udara, bukan cuma indikator teks.
    const altFrac = Math.min(1, altBase / FLY_ALT);
    shadowPlane.material.opacity = 0.85 * (1 - altFrac * 0.7);
    const shScale = 1 - altFrac * 0.35;
    shadowPlane.scale.set(0.72 * K * shScale, 0.62 * K * shScale, 1);

    controls.update(dt);
    shadowPlane.visible = camera.position.y > FLY.GROUND + 0.05 * K;
    renderer.render(scene, camera);
  }

  function bindUI() {
    const btn = $('#atToggle');
    btn.onclick = () => {
      alive = !alive;
      btn.classList.toggle('active', alive);
      btn.textContent = alive ? '⏸ Jeda' : '▶ Lanjut';
      if (!alive) { flapAmp = 0; haltAmp = 0; }
    };
    addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 'o') btn.click();
    });
    const note = $('#atNote');
    $('#atNoteClose').onclick = () => { note.hidden = true; };
  }

  function start() {
    try {
      init();
      buildModel();
      bindUI();
      loadBrainData();
      animate();
      setTimeout(() => $('#loader').classList.add('done'), 260);
      window.APP_ALIVE = { scene, camera, model, controls, bsim: () => BSIM };  // pegangan konsol, sama semangatnya dgn APP di app.js
    } catch (err) {
      $('#ldStep').textContent = 'gagal: ' + err.message;
      console.error(err);
    }
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
