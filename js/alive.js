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
  let flapAmp = 0, haltAmp = 0, yawTarget = 0, legAmp = 0;

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
    scene.fog = new THREE.Fog(0x0a0c10, 22 * K, 62 * K);

    camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.01, 400);
    camera.position.set(11 * K, 3.4 * K, 5.5 * K);

    controls = new Orbit(camera, CANVAS);
    controls.target.set(0, -0.35 * K, 0.1 * K);
    controls.minDistance = 1.4 * K;
    controls.maxDistance = 40 * K;
    // TIDAK autoRotate: kamera diam sendirinya, biar condong/putar tubuh yang
    // digerakkan otak (lihat yawTarget di updateBrainSim) jelas terlihat -
    // kalau kamera ikut berputar, gerakan otak jadi tercampur & susah dibedakan.
    // Pengguna tetap bisa putar manual (drag).
    controls.autoRotate = false;
    controls.flyTo({
      theta: Math.PI / 2, phi: Math.PI / 2 - 0.16, radius: 13.5 * K,
      target: new THREE.Vector3(0, -0.25 * K, 0.1 * K), duration: 0.01
    });

    lights();
    setEnvironment();
    environment();

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
    showBodyOnly();
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
    flapAmp = Math.min(1, st.motor * 1.4);
    haltAmp = Math.min(1, 0.15 + st.overall * 2.2);
    const asym = st.motorR - st.motorL;
    yawTarget = Math.max(-0.32, Math.min(0.32, asym * 2.6));
    legAmp = Math.min(1, 0.24 + st.motor * 1.3);   // kaki: baseline kecil selalu ada + naik dari dorongan motor

    if (tAcc - (updateBrainSim._t || 0) > 0.5) {
      updateBrainSim._t = tAcc;
      const pct = Math.round(st.overall * 100);
      $('#atBrainPct').textContent = pct + '%';
      $('#atBrainFill').style.width = Math.min(100, pct * 2) + '%';
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

    const wobbleAmp = Math.max(flapAmp, haltAmp);
    if (wobbleAmp > 0.005) {
      const f = 5.2;
      const a = Math.sin(tAcc * Math.PI * 2 * f);
      const b = Math.sin(tAcc * Math.PI * 2 * f + 1.15);
      if (flapAmp > 0.005) {
        model.wings.forEach(w => {
          const s = w.userData.side;
          w.rotation.z = w.userData.baseZ + s * a * 0.80 * flapAmp;
          w.rotation.x = b * 0.26 * flapAmp;
        });
      }
      model.halteres.forEach(h => {
        h.rotation.z = -a * 0.42 * wobbleAmp * (h.userData.side || 1);
      });
    }
    if (BSIM) model.root.rotation.y += (yawTarget - model.root.rotation.y) * Math.min(1, dt * 2.2);

    // kaki: gaya jalan tripod, sama seperti js/app.js -> lihat komentar di sana.
    if (BSIM && model.legs) {
      const stepFreq = 2.4;
      const ph = tAcc * Math.PI * 2 * stepFreq;
      model.legs.forEach(leg => {
        const s = Math.sin(ph + (leg.userData.tripod === 'A' ? 0 : Math.PI));
        leg.rotation.y = s * 0.34 * legAmp;
        leg.rotation.z = Math.max(0, s) * 0.15 * legAmp * (leg.userData.side || 1);
      });
    }

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
      if (!alive) { flapAmp = 0; haltAmp = 0; yawTarget = 0; }
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
