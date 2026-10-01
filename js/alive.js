/* ==========================================================
   alive.js - bootstrap halaman alive.html: lalat yang SELURUH geraknya
   dibaca dari simulasi otak FlyWire (js/lif-brain.js), tanpa angka acak.

   RANTAI SEBAB-AKIBAT (satu-satunya jalur gerak di halaman ini):

     dunia 3D ──> neuron indra ──> otak LIF ──> neuron turun (DN) ──> tubuh
       lapar   ──> DNp09 (P9, "perintah jalan", Sapkal dkk. 2024)
       gula di mulut  ──> reseptor gula labelum (sugar/water GRN)
       pahit di mulut ──> reseptor pahit labelum (bitter GRN)

     keluaran yang dibaca (laju tembak, dihaluskan):
       oDN1 (DNg97) + DNa02 + DNb02  -> kecepatan jalan maju
       DNa01/DNa02/DNb02 kanan - kiri -> belok (ipsilateral; Rayshubskiy
                                         dkk. 2020, Sapkal dkk. 2024)
       MN9 (CB0701)                    -> probosis menjulur / makan
                                         (Shiu dkk. 2024, McKellar 2020)
       FG (CB0890)                     -> TIDAK dibaca langsung; FG
                                         menghambat oDN1 di dalam otak,
                                         jadi lalat berhenti dengan
                                         sendirinya waktu mengecap gula

   Yang BUKAN dari otak (dan kenapa):
     - rasa lapar: keadaan tubuh (gula darah), naik pelan & turun waktu
       makan - deterministik, bukan simulasi neuron. Ini satu-satunya
       "dorongan internal", menggantikan rangsangan P9 buatan di paper.
     - ritme langkah kaki: dibuat CPG di korda saraf (VNC) yang tidak ada
       di data otak FlyWire - di sini frekuensinya mengikuti kecepatan
       yang dibaca dari otak.
     - fisika: dinding cawan & benda padat menahan badan (bukan belokan).

   TIDAK ADA Math.random() di berkas ini. Dengan klik yang sama pada
   waktu yang sama, lalat bergerak persis sama.

   Yang sengaja DIHAPUS dari versi lama karena tak punya jalur otak di
   model ini: terbang (tak ada input yang mengaktifkan giant fiber),
   grooming (reseptor bulu tak sampai ke DN pada uji coba), tertarik bau
   buah (bau kiri & kanan menghasilkan DN yang sama, dan memicu aktivitas
   tak terkendali di lobus antena model ini - lihat docs/otak-lalat.md).
   ========================================================== */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const CANVAS = $('#scene');
  const K = FLY.SCALE;

  let renderer, scene, camera, controls, model, clock, tAcc = 0;
  let backdrop, shadowPlane, groundMesh;
  let alive = true;

  // --- tubuh: semua diisi dari otak di updateBrain() ---
  let walkSpeed = 0;      // kecepatan maju (satuan dunia / detik)
  let turnRate = 0;       // rad/detik, + = kiri (heading bertambah)
  let probExt = 0;        // 0..1 probosis menjulur (MN9)
  let legPhase = 0, wingPhase = 0;
  let flightAmt = 0, altitude = 0;    // 0..1 & satuan dunia - lihat GF/kabur
  const FLIGHT_ALT = 2.0 * K;

  // Arena = cawan petri (seperti arena lab): dinding fisik, bukan belokan.
  const ARENA_R = 13 * K;
  const FLY_BODY_R = 0.30 * K;
  const PROP_COLLIDERS = [];
  // posisi & arah awal TETAP (bukan acak)
  let heading = 0.9;

  // Sumber rasa di dunia: buah (gula, tak habis) + tetes yang ditaruh
  // pengguna. {x, z, r, kind:'sugar'|'bitter', amount, mesh}
  const SOURCES = [];
  const DROP_R = 0.42 * K;   // kira-kira selebar kepala lalat, seperti tetes di cawan lab

  // Rasa lapar (0 = kenyang, 1 = sangat lapar) - lihat komentar atas.
  let hunger = 0.7;
  const HUNGER_RISE_S = 90;     // detik dari kenyang ke lapar penuh
  const FEED_RATE = 0.12;       // penurunan lapar /detik saat makan penuh

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
    controls.maxDistance = 70 * K;
    // TIDAK autoRotate: kamera tak berputar sendiri, biar arah jalan yang
    // digerakkan otak (lihat heading di updateBrainSim) jelas terlihat -
    // titik yang dikelilingi kamera (controls.setTarget, dipanggil tiap
    // frame di animate()) mengikuti posisi lalat berkeliling arena.
    // Pengguna tetap bisa putar/zoom manual (drag/scroll).
    controls.autoRotate = false;
    // agak dari atas & cukup jauh: cawan & jalur lalat kelihatan, jadi
    // mudah menaruh tetes gula di depan lalat (bisa di-zoom/putar bebas)
    controls.flyTo({
      theta: Math.PI / 2 + 0.5, phi: 0.62, radius: 36 * K,
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
    model.antennae = model.parts.filter(p =>
      p.userData.partId === 'antena' || p.userData.partId === 'funikulus' || p.userData.partId === 'arista');
    // simpan pose ISTIRAHAT asli (dibangun fly.js) sebelum dianimasikan -
    // dipakai sebagai titik "lipat penuh"/"diam" yang dituju animate().
    model.wings.forEach(w => { w.userData.baseY = w.rotation.y; w.userData.baseX = w.rotation.x; });
    // sayap dilipat rapat di atas perut (pose jalan/istirahat) - tetap,
    // karena di model ini tak ada jalur otak yang memicu terbang
    model.wings.forEach(w => {
      const s = w.userData.side;
      w.rotation.y = w.userData.baseY + s * 0.95;   // disapu ke belakang (dicek dari atas)
      w.rotation.x = w.userData.baseX - 0.30;
    });
    model.labelum.forEach(l => { l.userData.baseZ = l.rotation.z; });
    model.probosis.forEach(p => { p.userData.baseY = p.position.y; });
    model.antennae.forEach((p, i) => { p.userData.baseZ = p.rotation.z; p.userData.antIdx = i % 3; });
    // ujung kaki (pretarsus) per pivot - untuk rasa kaki (lihat footTips())
    model.feet = [];
    model.legs.forEach(pivot => {
      let foot = null;
      pivot.traverse(o => { if (o.userData && o.userData.partId === 'pretarsus') foot = o; });
      if (foot) model.feet.push({ side: pivot.userData.side, legIndex: pivot.userData.legIndex, mesh: foot });
    });
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
    groundMesh = ground;   // dipakai raycast klik (taruh tetes)

    // sepotong buah - sumber GULA yang tak habis (lihat SOURCES). Lalat
    // tak bisa menciumnya dari jauh di model ini; baru terasa kalau
    // labelum menyentuhnya.
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 * K, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: fruitTexture(), roughness: 0.55, metalness: 0.05 })
    );
    fruit.position.set(4.2 * K, FLY.GROUND, 1.8 * K);
    fruit.rotation.y = 0.4;
    world.add(fruit);
    PROP_COLLIDERS.push({ x: fruit.position.x, z: fruit.position.z, r: 0.5 * K });
    SOURCES.push({ x: fruit.position.x, z: fruit.position.z, r: 0.5 * K, h: 0.5 * K,
                   kind: 'sugar', amount: 1, finite: false, mesh: fruit });
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
        metalness: 0, transmission: 0.7, clearcoat: 1
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
      .forEach(([px, pz, r]) => {
        world.add(pebble(px * K, pz * K, r * K, 0x7d7a72));
        PROP_COLLIDERS.push({ x: px * K, z: pz * K, r: r * K * 1.3 });
      });

    // dinding cawan petri - batas fisik arena (lihat ARENA_R)
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_R + 0.04 * K, ARENA_R + 0.04 * K, 0.7 * K, 96, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.16, roughness: 0.05,
        side: THREE.DoubleSide, depthWrite: false })
    );
    wall.position.y = FLY.GROUND + 0.35 * K;
    world.add(wall);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_R + 0.04 * K, 0.025 * K, 6, 128),
      new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.5, roughness: 0.2 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = FLY.GROUND + 0.7 * K;
    world.add(rim);

    scene.add(world);
  }

  /* ==========================================================
     OTAK - model LIF Shiu dkk. 2024 di atas potongan konektom FlyWire
     (data/brain-lalat.json, dibangun tools/build_brain_subnet.cjs dari
     otak utuh 138.639 neuron). Lihat js/lif-brain.js.
     ========================================================== */
  let BRAIN = null, BD = null;          // simulator + data
  let frameSpk = null;                  // spike per neuron sejak dibaca terakhir
  let spikesWin = 0, winT = 0, spikesPerS = 0, brainLoad = 0;

  // Kelompok neuron yang dibaca (indeks lokal), dipisah kiri/kanan.
  const G = {};
  // Laju tembak dihaluskan (Hz per neuron) per kelompok.
  const R = {};
  const RATE_TAU = 0.20;   // detik - penghalus pembacaan laju tembak

  // KALIBRASI keluaran -> tubuh. Ini satu-satunya "angka pilihan" di
  // rantai gerak: skala dari Hz ke satuan dunia. Tidak ada kalibrasi
  // biologis yang diketahui (paper hanya menunjukkan ARAH efeknya), jadi
  // nilainya dipilih supaya gerak terlihat jelas - ilustratif.
  // Laju input dibatasi 100 Hz: di atas ~150 Hz (semua reseptor gula)
  // model ini masuk aktivitas tak terkendali ("kejang") - lihat
  // tools/build_brain_subnet.cjs & docs/otak-lalat.md.
  const CAL = {
    P9_MAX_HZ: 100,         // laju DNp09 saat lapar penuh
    SUGAR_HZ: 100,          // laju reseptor gula saat menyentuh gula
    BITTER_HZ: 100,         // laju reseptor pahit saat menyentuh pahit
    WALK_PER_HZ: 0.45 * K,  // (satuan/detik) per Hz rata-rata oDN1
    WALK_MAX: 2.6 * K,
    TURN_PER_HZ: 0.032,     // rad/detik per Hz selisih kanan-kiri
    MN9_FULL_HZ: 60,        // laju MN9 yang dianggap "menjulur penuh"
    STEP_HZ: 3,             // laju oDN1 yang dianggap "melangkah penuh" (untuk belok)
    // rasa KAKI (leg ascending gustatory, lihat senseLegs) - diuji AMAN
    // sampai 40 Hz bersama p9=100 (lihat "ATURAN KEAMANAN" di
    // tools/build_brain_subnet.cjs); TAK PERNAH dipakai bareng rasa mulut.
    LEG_HZ: 35,
    // giant fiber / kabur (lihat senseLoom) - LPLC2 (ukuran) & LC4
    // (kecepatan sudut) digerakkan pada laju YANG SAMA per sisi (satu
    // sinyal "kuat looming", bukan dua sinyal independen - penyederhanaan
    // teknik, lihat docs/otak-lalat.md) dari sudut pandang & lajunya
    // membesar (fisika nyata, dihitung tiap tick di senseLoom).
    LOOM_ANG_GAIN: 55,      // Hz per (rad/dtk) laju membesarnya sudut pandang
    LOOM_SIZE_GAIN: 25,     // Hz per rad sudut pandang saat ini
    LOOM_MAX_HZ: 100,       // batas aman (lihat aturan keamanan di atas)
    GF_FULL_HZ: 25,         // laju GF yang dianggap "kabur penuh"
    ESC_TURN_PER_HZ: 0.05,  // rad/detik per Hz selisih DN kabur kanan-kiri
    FLIGHT_SPEED: 3.2 * K,  // kecepatan terbang kabur
    FLIGHT_DUR: 0.9         // detik, lama satu episode kabur (lepas landas+terbang)
  };

  function loadBrain() {
    if (typeof fetch !== 'function') return;
    $('#ldStep') && ($('#ldStep').textContent = 'memuat otak FlyWire…');
    fetch('data/brain-lalat.json', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => {
        BD = d;
        BRAIN = LIFBRAIN.create({
          n: d.n,
          offsets: Int32Array.from(d.offsets),
          post: Int32Array.from(d.post),
          w: Int16Array.from(d.w),
          key: Int32Array.from(d.key)
        });
        frameSpk = new Uint16Array(d.n);
        BRAIN.onSpikes(fired => {
          for (let k = 0; k < fired.length; k++) frameSpk[fired[k]]++;
          spikesWin += fired.length;
        });
        const bySide = (list, s) => list.filter(i => d.side[i] === s);
        const out = d.outputs;
        const both = (name, list) => { G[name + 'L'] = bySide(list, 'left'); G[name + 'R'] = bySide(list, 'right'); };
        both('oDN1', out.DNg97); both('DNa02', out.DNa02); both('DNa01', out.DNa01);
        both('DNb02', out.DNb02); both('FG', out.CB0890); both('MN9', out.CB0701);
        both('BB', out.DNg60); both('MDN', out.MDN); both('GF', out.DNp01);
        both('Esc2', out.DNp02 || []); both('Esc4', out.DNp04 || []); both('Esc11', out.DNp11 || []);
        G.p9L = d.inputs.p9L; G.p9R = d.inputs.p9R;
        Object.keys(G).forEach(k => { R[k] = 0; });
        const allInputs = [].concat(d.inputs.p9L, d.inputs.p9R, d.inputs.sugarL,
          d.inputs.sugarR, d.inputs.bitterL, d.inputs.bitterR,
          d.inputs.legGL || [], d.inputs.legGR || [],
          d.inputs.lc4L || [], d.inputs.lc4R || [], d.inputs.lplc2L || [], d.inputs.lplc2R || []);
        BRAIN.markInputs(allInputs);
        $('#bpNeurons').textContent = d.n.toLocaleString('id-ID');
        console.log('[otak] LIF siap:', d.n, 'neuron,', d.post.length, 'sinaps -', d.note);
        buildBrainViz(d);
      })
      .catch(err => {
        console.warn('[otak] gagal memuat data/brain-lalat.json:', err);
        $('#bpStatus').textContent = 'data otak tak tersedia - lalat diam';
      });
  }

  // posisi dunia kedua cuping labelum. Sisi dari proyeksi ke sumbu +X
  // LOKAL badan (fly.js baris 6: "+X = sisi kanan lalat") diputar ke
  // dunia oleh heading: lokal(1,0,0) -> dunia (cos h, 0, -sin h) untuk
  // rotasi Y sebesar h (konvensi Three.js). BUG 29-09-2026 diperbaiki:
  // versi lama menandai proyeksi +sisiKanan sebagai 'L' (tertukar) -
  // labelum kanan dulu memicu sugarR sebagai sugarL, jadi kalau lalat
  // mengecap gula HANYA di kanan, otak membelokkannya ke KIRI (salah
  // arah). Diverifikasi lewat kode fly.js (pola "side > 0" = kanan,
  // dipakai konsisten di buildLeg/buildLabelum/buildProboscis).
  const _v = new THREE.Vector3();
  function labellumTips() {
    const tips = { L: null, R: null };
    const rp = model.root.position, rx = Math.cos(heading), rz = -Math.sin(heading);
    model.labelum.forEach(l => {
      if (!l.geometry.boundingSphere) l.geometry.computeBoundingSphere();
      _v.copy(l.geometry.boundingSphere.center).applyMatrix4(l.matrixWorld);
      const rightness = (_v.x - rp.x) * rx + (_v.z - rp.z) * rz;
      tips[rightness > 0 ? 'R' : 'L'] = { x: _v.x, y: _v.y, z: _v.z };
    });
    return tips;
  }

  // posisi dunia keenam ujung kaki (pretarsus) - sisi diambil LANGSUNG
  // dari pivot.userData.side yang fly.js tulis saat konstruksi (bukan
  // dihitung ulang lewat proyeksi), jadi tak mungkin tertukar seperti
  // bug labellumTips di atas.
  function footTips() {
    const out = [];
    model.feet.forEach(f => {
      if (!f.mesh.geometry.boundingSphere) f.mesh.geometry.computeBoundingSphere();
      _v.copy(f.mesh.geometry.boundingSphere.center).applyMatrix4(f.mesh.matrixWorld);
      out.push({ x: _v.x, y: _v.y, z: _v.z, side: f.side > 0 ? 'R' : 'L' });
    });
    return out;
  }

  // Indra: posisi dunia -> laju tembak neuron input. Murni geometri.
  const PROBOSCIS_REACH = 1.0 * K;
  const taste = { sugarL: 0, sugarR: 0, bitterL: 0, bitterR: 0, source: null };
  function senseWorld() {
    taste.sugarL = taste.sugarR = taste.bitterL = taste.bitterR = 0;
    taste.source = null;
    const tips = labellumTips();
    for (let s = 0; s < SOURCES.length; s++) {
      const src = SOURCES[s];
      if (src.amount <= 0) continue;
      ['L', 'R'].forEach(side => {
        const t = tips[side];
        if (!t) return;
        // cuping labelum harus tepat di atas sumber (jarak datar) dan
        // permukaannya dalam jangkauan julur probosis (PROBOSCIS_REACH) -
        // di model 3D labelum menggantung ~0,8K di atas tanah saat diam
        const dxz = Math.hypot(t.x - src.x, t.z - src.z);
        if (dxz < src.r + 0.07 * K && t.y - (FLY.GROUND + src.h) < PROBOSCIS_REACH) {
          taste[src.kind + side] = 1;
          taste.source = src;
        }
      });
    }
  }

  // Rasa KAKI: leg ascending gustatory receptor neurons (lgAGRNs, jalur
  // SA_VTV_* FlyWire - Schlegel dkk. 2024) - lgAGRNs mendeteksi apa pun
  // yang disentuh kaki (sapuan tak memisahkan manis/pahit per kaki, lihat
  // tools/build_brain_subnet.cjs), jadi di sini "rasa kaki" cuma
  // "menyentuh sumber", bukan pembeda rasa. TIDAK PERNAH aktif bareng
  // rasa mulut (lihat brainDrive - aturan keamanan konektom).
  const legTaste = { L: 0, R: 0 };
  const FOOT_TOUCH_R = 0.16 * K;   // jangkauan mendatar kaki menjejak sumber
  const FOOT_TOUCH_H = 0.30 * K;   // jangkauan tinggi (kaki dekat tanah)
  function senseLegs() {
    legTaste.L = 0; legTaste.R = 0;
    const feet = footTips();
    for (let s = 0; s < SOURCES.length; s++) {
      const src = SOURCES[s];
      if (src.amount <= 0) continue;
      for (let k = 0; k < feet.length; k++) {
        const f = feet[k];
        const dxz = Math.hypot(f.x - src.x, f.z - src.z);
        if (dxz < src.r + FOOT_TOUCH_R && f.y - FLY.GROUND < FOOT_TOUCH_H) legTaste[f.side] = 1;
      }
    }
  }

  /* ----------------------------------------------------------
     ANCAMAN (looming) - giant fiber. Diklik pengguna (tombol "Kejutkan"),
     lalu bergerak MENURUN dengan lintasan TETAP (bukan acak) dari titik
     tetap di atas posisi lalat saat diklik. Setiap tick, sudut pandang
     ancaman & lajunya membesar DIHITUNG SUNGGUHAN dari jarak 3D nyata
     (geometri, seperti indra rasa di atas) - bukan animasi kosmetik.
     LPLC2 (ukuran sudut) & LC4 (laju sudut) - von Reyn & Card dkk. 2019.
     TIDAK PERNAH aktif bareng rasa (lihat brainDrive - aturan keamanan).
     ---------------------------------------------------------- */
  let threat = null;   // {t0, dur, x, z, y0, y1, r, mesh, prevAng}
  const THREAT_DUR = 0.42;

  function spawnThreat() {
    if (threat) return;   // satu per satu
    const p = model.root.position;
    const geo = new THREE.SphereGeometry(0.55 * K, 18, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x161310, roughness: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, 6.0 * K, p.z);
    scene.add(mesh);
    threat = { t0: tAcc, dur: THREAT_DUR, x: p.x, z: p.z, y0: 6.0 * K, y1: 0.60 * K, r: 0.55 * K, mesh, prevAng: null };
  }

  const loom = { L: 0, R: 0, active: false };
  function senseLoom(dt) {
    loom.L = 0; loom.R = 0; loom.active = false;
    if (!threat) return;
    const age = tAcc - threat.t0;
    if (age > threat.dur + 0.5) { scene.remove(threat.mesh); threat = null; return; }
    const y = threat.y0 + (threat.y1 - threat.y0) * Math.min(1, age / threat.dur);
    threat.mesh.position.y = y;
    if (age > threat.dur) return;   // sudah "mendarat" - diam sesaat lalu hilang, tak looming lagi
    const p = model.root.position;
    const dx = threat.x - p.x, dz = threat.z - p.z, dy = y - (p.y + 0.55 * K);
    const dist = Math.max(0.08 * K, Math.hypot(dx, dz, dy));
    const angSize = 2 * Math.atan2(threat.r, dist);              // sudut pandang sungguhan (radian)
    const dAng = threat.prevAng == null ? 0 : (angSize - threat.prevAng) / dt;   // laju membesar
    threat.prevAng = angSize;
    if (dAng <= 0) return;   // cuma looming kalau BENAR membesar (mendekat), bukan menjauh
    const rx = Math.cos(heading), rz = -Math.sin(heading);        // sumbu kanan lokal (lihat labellumTips)
    const bearD = Math.max(1e-4, Math.hypot(dx, dz));
    const wR = Math.max(0, Math.min(1, 0.5 + ((dx * rx + dz * rz) / bearD) * 0.5));
    const hz = Math.min(CAL.LOOM_MAX_HZ, dAng * CAL.LOOM_ANG_GAIN + angSize * CAL.LOOM_SIZE_GAIN);
    if (hz > 1) { loom.active = true; loom.L = hz * (1 - wR); loom.R = hz * wR; }
  }

  function brainDrive() {
    const d = {};
    const p9 = CAL.P9_MAX_HZ * Math.max(0, Math.min(1, (hunger - 0.15) / 0.85));
    G.p9L.forEach(i => { d[i] = p9; }); G.p9R.forEach(i => { d[i] = p9; });
    const put = (list, hz) => { if (hz > 0) list.forEach(i => { d[i] = hz; }); };
    // ATURAN KEAMANAN KONEKTOM (lihat tools/build_brain_subnet.cjs):
    // visi(lc4/lplc2) x rasa(mulut ATAU kaki) x rasa-mulut x rasa-kaki -
    // TAK BOLEH dua-duanya aktif sekaligus, memicu aktivitas tak
    // terkendali yang tak reda ("kejang"). p9 aman dengan SALAH SATU.
    if (loom.active) {
      put(BD.inputs.lc4L, loom.L); put(BD.inputs.lc4R, loom.R);
      put(BD.inputs.lplc2L, loom.L); put(BD.inputs.lplc2R, loom.R);
    } else if (taste.sugarL || taste.sugarR || taste.bitterL || taste.bitterR) {
      put(BD.inputs.sugarL, taste.sugarL * CAL.SUGAR_HZ);
      put(BD.inputs.sugarR, taste.sugarR * CAL.SUGAR_HZ);
      put(BD.inputs.bitterL, taste.bitterL * CAL.BITTER_HZ);
      put(BD.inputs.bitterR, taste.bitterR * CAL.BITTER_HZ);
    } else if (BD.inputs.legGL) {
      put(BD.inputs.legGL, legTaste.L * CAL.LEG_HZ);
      put(BD.inputs.legGR, legTaste.R * CAL.LEG_HZ);
    }
    BRAIN.setDrive(d);
    return p9;
  }

  const groupHz = (list, dt) => {
    if (!list.length) return 0;
    let c = 0;
    for (let k = 0; k < list.length; k++) c += frameSpk[list[k]];
    return c / list.length / dt;
  };

  let p9Now = 0;
  // Otak & tubuh maju dengan LANGKAH TETAP (TICK), tak tergantung laju
  // frame layar - jadi dengan masukan yang sama hasilnya sama persis.
  const TICK = 0.010;          // detik per langkah dunia (= 100 langkah otak 0,1 ms)
  const MAX_TICKS = 5;         // maks. per frame; layar lambat -> dunia melambat, tak melompat
  let tickAcc = 0;

  // --- kabur (escape) - lihat GF/Esc* di updateBrain & animate ---
  let escapeT = -999;          // detik sejak episode kabur terakhir dipicu
  let escapeDir = 0;           // heading tujuan kabur (radian dunia), dibekukan saat dipicu
  let gfHz = 0, escTurnHz = 0;

  function updateBrain(dtB) {
    senseWorld();
    senseLegs();
    senseLoom(dtB);
    p9Now = brainDrive();
    frameSpk.fill(0);
    const t0 = performance.now();
    BRAIN.run(dtB * 1000);
    brainLoad += ((performance.now() - t0) / (dtB * 1000) - brainLoad) * 0.02;

    const a = 1 - Math.exp(-dtB / RATE_TAU);
    Object.keys(G).forEach(k => { R[k] += (groupHz(G[k], dtB) - R[k]) * a; });

    // --- keluaran otak -> tubuh (lihat komentar atas berkas) ---
    // maju: oDN1 (Bidaye dkk. 2020) - node yang dihambat FG saat gula
    // (Sapkal dkk. 2024), jadi berhentinya lalat terjadi DI DALAM otak.
    // mundur: MDN (Bidaye dkk. 2014) - dibaca, tapi tak pernah aktif
    // dengan input halaman ini.
    const walkHz = (R.oDN1L + R.oDN1R) / 2;
    const backHz = (R.MDNL + R.MDNR) / 2;
    walkSpeed = Math.min(CAL.WALK_MAX, (walkHz - backHz) * CAL.WALK_PER_HZ);
    // belok: DN kanan lebih aktif -> belok kanan (heading berkurang).
    // DN belok bekerja lewat langkah kaki yang asimetris (Rayshubskiy dkk.
    // 2020): badan hanya bisa berputar kalau kaki melangkah. Jadi belokan
    // dikalikan tingkat melangkah (dari oDN1) - lalat yang berhenti makan
    // tidak berputar di tempat walaupun DNa02 masih menembak.
    const turnHz = (R.DNa01R + R.DNa02R + R.DNb02R) - (R.DNa01L + R.DNa02L + R.DNb02L);
    const stepping = Math.min(1, walkHz / CAL.STEP_HZ);
    turnRate = -turnHz * CAL.TURN_PER_HZ * stepping;
    probExt = Math.min(1, (R.MN9L + R.MN9R) / 2 / CAL.MN9_FULL_HZ);

    // --- GF (DNp01) -> kabur: lompat + terbang menjauh. "Leg extension
    // and wing depression for takeoffs" (von Reyn & Card dkk. 2019).
    // Arah menjauh dari ancaman DIHITUNG DARI GEOMETRI (seperti indra
    // rasa) - keputusan KAPAN kabur & seberapa kuat murni dari GF.
    gfHz = (R.GFL + R.GFR) / 2;
    escTurnHz = (R.Esc2R + R.Esc4R + R.Esc11R) - (R.Esc2L + R.Esc4L + R.Esc11L);
    if (gfHz > 3 && tAcc - escapeT > CAL.FLIGHT_DUR * 0.7 && threat) {
      const p = model.root.position;
      escapeDir = Math.atan2(-(threat.x - p.x), -(threat.z - p.z));  // menjauh dari ancaman
      escapeT = tAcc;
    }

    // --- tubuh -> lapar (makan hanya kalau probosis menjulur DI sumber gula) ---
    if (probExt > 0.05 && taste.source && taste.source.kind === 'sugar') {
      const eat = FEED_RATE * probExt * dtB;
      hunger = Math.max(0, hunger - eat);
      if (taste.source.finite) {
        taste.source.amount = Math.max(0, taste.source.amount - eat * 1.2);
        const sc = Math.max(0.001, Math.cbrt(taste.source.amount));
        taste.source.mesh.scale.setScalar(sc);
        if (taste.source.amount <= 0) taste.source.mesh.visible = false;
      }
    } else {
      hunger = Math.min(1, hunger + dtB / HUNGER_RISE_S);
    }

    winT += dtB;
    if (winT >= 0.5) {
      spikesPerS = spikesWin / winT; spikesWin = 0; winT = 0;
      updatePanel();
    }
  }

  function bar(id, v) { const el = $(id); if (el) el.style.width = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'; }
  function txt(id, s) { const el = $(id); if (el) el.textContent = s; }
  const hz = v => v < 0.05 ? '0' : v < 10 ? v.toFixed(1) : Math.round(v).toString();

  function updatePanel() {
    if (!BRAIN) return;
    txt('#bpHunger', Math.round(hunger * 100) + '%'); bar('#bpHungerBar', hunger);
    const hs = $('#hungerSet');
    if (hs && document.activeElement !== hs) hs.value = Math.round(hunger * 100);
    txt('#bpP9', hz(p9Now) + ' Hz'); bar('#bpP9Bar', p9Now / CAL.P9_MAX_HZ);
    const walkHz = (R.oDN1L + R.oDN1R) / 2;
    txt('#bpODN1', hz(walkHz) + ' Hz'); bar('#bpODN1Bar', walkHz / 10);
    txt('#bpTurn', hz(R.DNa02L) + ' | ' + hz(R.DNa02R) + ' Hz');
    bar('#bpTurnL', R.DNa02L / 25); bar('#bpTurnR', R.DNa02R / 25);
    const fg = (R.FGL + R.FGR) / 2;
    txt('#bpFG', hz(fg) + ' Hz'); bar('#bpFGBar', fg / 60);
    const mn9 = (R.MN9L + R.MN9R) / 2;
    txt('#bpMN9', hz(mn9) + ' Hz'); bar('#bpMN9Bar', mn9 / CAL.MN9_FULL_HZ);
    const tastesBitter = taste.bitterL || taste.bitterR, tastesSugar = taste.sugarL || taste.sugarR;
    const tastesLeg = legTaste.L || legTaste.R;
    txt('#bpTaste', tastesSugar ? '🍬 manis (mulut)' + (tastesBitter ? ' + 🟣 pahit' : '')
      : tastesBitter ? '🟣 pahit (mulut)' : tastesLeg ? '🦶 menyentuh (kaki)' : '—');
    const loomHz = loom.L + loom.R;
    txt('#bpLoom', loom.active ? hz(loomHz) + ' Hz' : '—'); bar('#bpLoomBar', loomHz / CAL.LOOM_MAX_HZ);
    txt('#bpGF', hz(gfHz) + ' Hz'); bar('#bpGFBar', gfHz / CAL.GF_FULL_HZ);
    txt('#bpSpikes', Math.round(spikesPerS).toLocaleString('id-ID'));
    txt('#bpActive', BRAIN.activeCount.toLocaleString('id-ID'));
    txt('#bpLoad', brainLoad > 0 ? (brainLoad * 100).toFixed(0) + '%' : '—');
    const inFlight = tAcc - escapeT >= 0 && tAcc - escapeT < CAL.FLIGHT_DUR;
    const st = !alive ? '⏸ dijeda'
      : inFlight ? '🪽 KABUR (GF)'
      : probExt > 0.25 ? '🍽️ makan (MN9 aktif)'
      : tastesSugar && tastesBitter ? '🤢 menolak (pahit)'
      : walkSpeed > 0.05 * K ? '🦵 jalan'
      : p9Now <= 0 ? '😴 kenyang, diam' : '🧍 diam';
    txt('#bpStatus', st);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  /* ==========================================================
     GERAK TUBUH - hanya menerapkan walkSpeed/turnRate/probExt dari otak.
     ========================================================== */
  // Satu langkah dunia: indra -> otak -> keluaran -> gerak badan + fisika.
  function worldTick(dt) {
    updateBrain(dt);

    // kabur (GF): dalam jendela FLIGHT_DUR sejak dipicu, kejar escapeDir
    // (dihitung sekali saat GF menembak - lihat updateBrain) dengan cepat,
    // laju FLIGHT_SPEED, naik ke FLIGHT_ALT. Di luar jendela: jalan biasa.
    const inFlight = (tAcc - escapeT >= 0 && tAcc - escapeT < CAL.FLIGHT_DUR);
    flightAmt += ((inFlight ? 1 : 0) - flightAmt) * Math.min(1, dt * 7);

    if (inFlight) {
      let dh = escapeDir - heading; dh = ((dh + Math.PI) % (Math.PI * 2)) - Math.PI;
      heading += dh * Math.min(1, dt * 8) - escTurnHz * CAL.ESC_TURN_PER_HZ * dt * 0.3;
    } else {
      heading += turnRate * dt;
    }
    model.root.rotation.y = heading;
    const speed = inFlight ? CAL.FLIGHT_SPEED : walkSpeed;
    const p = model.root.position;
    p.x += Math.sin(heading) * speed * dt;
    p.z += Math.cos(heading) * speed * dt;
    altitude += ((inFlight ? FLIGHT_ALT : 0) - altitude) * Math.min(1, dt * 3.5);
    p.y = Math.max(0, altitude);

    // fisika: benda padat menahan badan HANYA waktu di tanah (waktu
    // terbang dianggap melintas di atasnya) & dinding cawan menahan
    // badan (tidak memutar arah - kalau otak terus mendorong maju,
    // lalat menggeser di tepinya)
    if (altitude < 0.35 * K) {
      for (let i = 0; i < PROP_COLLIDERS.length; i++) {
        const c = PROP_COLLIDERS[i];
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz), minD = c.r + FLY_BODY_R;
        if (d < minD && d > 1e-4) { p.x += dx * (minD - d) / d; p.z += dz * (minD - d) / d; }
      }
    }
    const dc = Math.hypot(p.x, p.z), maxD = ARENA_R - FLY_BODY_R;
    if (dc > maxD) { p.x *= maxD / dc; p.z *= maxD / dc; }
    model.root.updateMatrixWorld(true);   // posisi kaki/labelum terbaru untuk indra langkah berikutnya
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    tAcc += dt;

    if (alive && BRAIN && model) {
      tickAcc = Math.min(tickAcc + dt, TICK * MAX_TICKS);
      while (tickAcc >= TICK) { worldTick(TICK); tickAcc -= TICK; }
    }

    // kaki: tripod, frekuensi & amplitudo mengikuti kecepatan dari otak
    // (ritme langkahnya sendiri dibuat VNC - di luar data otak). Ditarik
    // (tuck) makin rapat waktu flightAmt naik - kabur = tak melangkah.
    const gait = Math.min(1, walkSpeed / (1.2 * K));
    const turnGait = Math.min(1, Math.abs(turnRate) / 1.2);
    const legAmt = Math.max(gait, turnGait * 0.6) * (1 - flightAmt);
    legPhase += (2.5 + 7 * legAmt) * Math.PI * 2 * dt * (legAmt > 0.02 ? 1 : 0);
    if (model.legs) {
      model.legs.forEach(leg => {
        const side = leg.userData.side || 1;
        const s = Math.sin(legPhase + (leg.userData.tripod === 'A' ? 0 : Math.PI));
        leg.rotation.y = s * 0.34 * legAmt - 0.45 * side * flightAmt;
        leg.rotation.z = Math.max(0, s) * 0.15 * legAmt * side + 0.30 * flightAmt;
        leg.rotation.x = -0.85 * flightAmt;
      });
    }

    // sayap: dilipat rapat (pose istirahat, lihat buildModel) waktu
    // jalan, dikembangkan + ngepak cepat waktu kabur (flightAmt) - GF
    // ("leg extension and wing depression for takeoffs", von Reyn &
    // Card dkk. 2019) satu-satunya jalur yang membuka sayap di halaman
    // ini (beda dari js/brain-sim.js lama yang mengepak terus-menerus).
    wingPhase += (14 + gfHz * 0.3) * Math.PI * 2 * dt;
    const fold = 1 - flightAmt;
    model.wings.forEach(w => {
      const s = w.userData.side;
      w.rotation.y = w.userData.baseY + s * 0.95 * fold;
      w.rotation.z = w.userData.baseZ + s * Math.sin(wingPhase) * 0.80 * flightAmt;
      w.rotation.x = w.userData.baseX - 0.30 * fold + Math.sin(wingPhase + 1.15) * 0.26 * flightAmt;
    });
    if (flightAmt > 0.01) {
      model.halteres.forEach(h => { h.rotation.z = -Math.sin(wingPhase) * 0.42 * flightAmt * (h.userData.side || 1); });
    }

    // probosis: menjulur sebanding MN9 (bukan animasi ngunyah buatan)
    model.probosis.forEach(pp => { pp.position.y = pp.userData.baseY - probExt * 0.10 * K; });
    // (turun lurus saja - memutar cuping akan menggeser posisinya, dan
    // posisi cuping inilah yang dipakai indra rasa di senseWorld)
    model.labelum.forEach(l => { l.position.y = -probExt * 0.10 * K; });

    // kamera & bayangan mengikuti lalat; bayangan memudar & mengecil
    // waktu terbang tinggi (penanda visual murah, bukan efek fisik).
    controls.setTarget(model.root.position.x, controls.target.y, model.root.position.z + 0.1 * K);
    shadowPlane.position.x = model.root.position.x + 0.1 * K;
    shadowPlane.position.z = model.root.position.z + 0.1 * K;
    const altFrac = Math.min(1, altitude / FLIGHT_ALT);
    shadowPlane.material.opacity = 0.85 * (1 - altFrac * 0.7);
    const shScale = 1 - altFrac * 0.35;
    shadowPlane.scale.set(0.72 * K * shScale, 0.62 * K * shScale, 1);

    updateBrainViz(dt);

    controls.update(dt);
    shadowPlane.visible = camera.position.y > FLY.GROUND + 0.05 * K;
    renderer.render(scene, camera);
  }

  /* ==========================================================
     VISUALISASI OTAK 3D - titik di posisi NYATA tiap neuron potongan
     otak (data/brain-lalat.json -> pos, dari FlyWire lewat transformasi
     sasis yang SAMA dengan mesh neuropil, lihat tools/export_brain783.py),
     ditambahkan sebagai ANAK model.root (ikut posisi & putaran lalat
     berjalan/terbang) - kecerahan tiap titik = aktivitas SUNGGUHAN
     neuron itu (menyala saat menembak, meluruh ~0,35 dtk), bukan
     animasi kosmetik. Mati (tak dibangun/diproses) sampai pengguna
     menekan "Otak 3D" - kalau tak pernah dinyalakan, tak makan biaya
     render sama sekali (points.visible tetap false, updateBrainViz
     keluar lebih awal).
     ========================================================== */
  let brainViz = null;   // {points, idx (Int32Array indeks di BD), glow (Float32Array per-neuron)}
  const VIZ_TAU = 0.35;

  // Titik otak ada DI DALAM kepala, tapi eksoskeleton (kulit luar) pekat -
  // tanpa ini, titiknya tersembunyi total di balik kulit. Sama semangatnya
  // dengan x-ray di index.html (js/app.js applyXray), versi sederhana
  // (nyala/mati, tak ada penggeser) - dipasangkan ke tombol "Otak 3D".
  //
  // BUG 01-10-2026 (dilaporkan pengguna: "dimatikan tapi masih transparan")
  // diperbaiki: material di fly.js DIPAKAI BERSAMA (satu instance MAT.head
  // dkk. dipasang ke BANYAK mesh - lihat fly.js "MAT.head = chit()"), jadi
  // satu material yang sama bisa terlewati berkali-kali dalam SATU panggilan
  // setXray(). Penjaga lama (`xrayReady`, satu boolean per PANGGILAN fungsi)
  // membaca opacity yang SUDAH diredupkan kunjungan sebelumnya di panggilan
  // yang sama, lalu menyimpannya sebagai "baseOpacity" yang salah (makin
  // redup tiap kunjungan ulang) - begitu dimatikan, opacity dikembalikan ke
  // nilai yang sudah rusak itu, bukan opacity asli. Diganti penjaga PER
  // MATERIAL (`m.userData.baseOpacity === undefined`, sama seperti pola
  // teruji di js/app.js reindex()/applyXray()) - material yang sama dilewati
  // berkali-kali tetap aman, sekali tersimpan tak pernah tertimpa lagi.
  function setXray(on) {
    model.parts.forEach(p => {
      if (['exo', 'seta', 'eye'].indexOf(p.userData.layer) < 0) return;
      p.traverse(o => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
          const op = on ? m.userData.baseOpacity * 0.22 : m.userData.baseOpacity;
          m.opacity = op; m.transparent = on || m.userData.baseTransparent; m.depthWrite = !on;
        });
      });
    });
  }

  function buildBrainViz(d) {
    if (!d.pos) { console.warn('[otak] berkas tanpa posisi 3D (bangun ulang lewat tools/export_brain783.py) - "Otak 3D" dilewati'); return; }
    const idx = [], pos = [];
    for (let i = 0; i < d.n; i++) {
      const p = d.pos[i];
      if (p && p[0] != null) { idx.push(i); pos.push(p[0], p[1], p[2]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(idx.length * 3), 3));
    const mat = new THREE.PointsMaterial({
      size: 0.018 * K, vertexColors: true, transparent: true, opacity: 0.92,
      depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;   // posisi lokal di kepala - jangan pernah "dibuang" saat badan besar di layar
    model.root.add(points);
    const glow = new Float32Array(d.n);
    BRAIN.onSpikes(fired => { for (let k = 0; k < fired.length; k++) glow[fired[k]] = 1; });
    brainViz = { points, idx: Int32Array.from(idx), glow, colorAttr: geo.attributes.color };
    console.log('[otak] visualisasi 3D siap:', idx.length, '/', d.n, 'neuron punya posisi');
  }

  function updateBrainViz(dt) {
    if (!brainViz || !brainViz.points.visible) return;
    const { idx, glow, colorAttr } = brainViz;
    const decay = Math.exp(-dt / VIZ_TAU);
    const arr = colorAttr.array;
    for (let k = 0; k < idx.length; k++) {
      const g = (glow[idx[k]] *= decay);
      arr[k * 3] = 0.08 + g * 0.95; arr[k * 3 + 1] = 0.06 + g * 0.80; arr[k * 3 + 2] = 0.18 + g * 0.55;
    }
    colorAttr.needsUpdate = true;
  }

  /* ==========================================================
     INTERAKSI - klik tanah untuk menaruh tetes gula/pahit. Satu-satunya
     cara "memberi tahu" lalat sesuatu: lewat indranya.
     ========================================================== */
  let tool = 'sugar';
  const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();

  function addDrop(kind, x, z) {
    const mat = kind === 'sugar'
      ? new THREE.MeshPhysicalMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.85, roughness: 0.08,
          transmission: 0.35, clearcoat: 1, emissive: 0x332a10 })
      : new THREE.MeshPhysicalMaterial({ color: 0xb46cff, transparent: true, opacity: 0.85, roughness: 0.08,
          transmission: 0.35, clearcoat: 1, emissive: 0x220a33 });
    const geo = new THREE.SphereGeometry(DROP_R, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, FLY.GROUND, z);
    scene.add(mesh);
    SOURCES.push({ x, z, r: DROP_R, h: DROP_R, kind, amount: 1, finite: true, mesh });
  }

  function clearDrops() {
    for (let i = SOURCES.length - 1; i >= 0; i--) {
      if (!SOURCES[i].finite) continue;
      scene.remove(SOURCES[i].mesh);
      SOURCES.splice(i, 1);
    }
  }

  function bindUI() {
    const btn = $('#atToggle');
    btn.onclick = () => {
      alive = !alive;
      btn.classList.toggle('active', alive);
      btn.textContent = alive ? '⏸ Jeda' : '▶ Lanjut';
      updatePanel();
    };
    addEventListener('keydown', e => { if (e.key.toLowerCase() === 'o') btn.click(); });
    $('#atNoteClose').onclick = () => { $('#atNote').hidden = true; };

    // panel otak bisa disembunyikan supaya tidak menghalangi lalat. Di layar
    // sempit (HP) mulai tersembunyi. Pilihan diingat di browser ini.
    const panel = $('#brainPanel'), pBtn = $('#panelToggle');
    const setPanel = show => {
      panel.hidden = !show;
      pBtn.classList.toggle('active', show);
      try { localStorage.setItem('lalat.panel', show ? '1' : '0'); } catch (e) { /* abaikan */ }
    };
    let saved = null;
    try { saved = localStorage.getItem('lalat.panel'); } catch (e) { /* abaikan */ }
    setPanel(saved != null ? saved === '1' : innerWidth > 720);
    pBtn.onclick = () => setPanel(panel.hidden);
    $('#panelClose').onclick = () => setPanel(false);
    addEventListener('keydown', e => { if (e.key.toLowerCase() === 'p') pBtn.click(); });

    document.querySelectorAll('[data-tool]').forEach(b => {
      b.onclick = () => {
        tool = b.dataset.tool;
        document.querySelectorAll('[data-tool]').forEach(o => o.classList.toggle('active', o === b));
      };
    });
    $('#toolClear').onclick = clearDrops;
    $('#toolStartle').onclick = spawnThreat;
    $('#hungerSet').oninput = e => { hunger = +e.target.value / 100; updatePanel(); };

    const vizBtn = $('#brainVizToggle');
    vizBtn.onclick = () => {
      if (!brainViz) return;   // data belum siap / tak punya posisi
      const show = !brainViz.points.visible;
      brainViz.points.visible = show;
      setXray(show);   // kepala tembus pandang - lihat setXray()
      vizBtn.classList.toggle('active', show);
    };

    // klik (bukan seret) di tanah -> taruh tetes
    let down = null;
    CANVAS.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    CANVAS.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 400;
      down = null;
      if (moved > 6 || !quick) return;
      const r = CANVAS.getBoundingClientRect();
      _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      _ray.setFromCamera(_ndc, camera);
      const hit = _ray.intersectObject(groundMesh)[0];
      if (!hit) return;
      if (Math.hypot(hit.point.x, hit.point.z) > ARENA_R - DROP_R) return;
      addDrop(tool, hit.point.x, hit.point.z);
    });
  }

  function start() {
    try {
      init();
      buildModel();
      bindUI();
      loadBrain();
      animate();
      setTimeout(() => $('#loader').classList.add('done'), 260);
      window.APP_ALIVE = {
        scene, camera, model, controls,
        brain: () => BRAIN, rates: () => R, cal: CAL, sources: SOURCES,
        state: () => ({ hunger, walkSpeed, turnRate, probExt, heading, taste: Object.assign({}, taste),
                        legTaste: Object.assign({}, legTaste), loom: Object.assign({}, loom),
                        gfHz, flightAmt, altitude, escapeT, escapeDir, tAcc,
                        pos: model.root.position.clone() }),
        addDrop, setHunger: v => { hunger = v; }, labellumTips, footTips,
        spawnThreat, threat: () => threat,
        setBrainViz: v => { if (brainViz) { brainViz.points.visible = v; setXray(v); $('#brainVizToggle').classList.toggle('active', v); } },
        brainViz: () => brainViz,
        // untuk uji otomatis: majukan dunia N detik tanpa menunggu layar
        // majukan dunia N detik tanpa menunggu layar - dipakai uji otomatis
        // (Playwright headless kadang cuma 1-3 fps). tAcc IKUT dimajukan
        // (sama seperti animate() lewat requestAnimationFrame) supaya jam
        // ancaman/kabur (lihat senseLoom/updateBrain) konsisten dengan
        // pemakaian sungguhan, bukan "diam" seperti sebelum 30-09-2026.
        advance: sec => { for (let k = Math.round(sec / TICK); k > 0; k--) { tAcc += TICK; worldTick(TICK); } updatePanel(); }
      };
    } catch (err) {
      $('#ldStep').textContent = 'gagal: ' + err.message;
      console.error(err);
    }
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
