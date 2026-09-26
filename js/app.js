/* ==========================================================
   app.js - scene, pencahayaan, interaksi, label, dan UI
   ========================================================== */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

  /* ---------------- state ---------------- */
  const S = {
    sel: null,            // partId terpilih
    hover: null,
    isolate: false,
    labels: true,
    flap: false,
    autorot: false,
    wire: false,
    grid: false,
    light: false,
    explode: 0,
    xray: 0,
    clip: 100,
    layers: {
      exo: true, wing: true, leg: true, seta: true, eye: true,
      internal: false, muscle: false, trachea: false, nerve: false,
      connectome: false, neuron: false
    }
  };

  // Preset kamera & ukuran pemandangan ditulis dalam SATUAN SASIS (sama
  // seperti koordinat di fly.js) lalu dikalikan K menjadi milimeter dunia.
  const K = FLY.SCALE;

  let renderer, scene, camera, controls, model, raycaster, pointer;
  let clipPlane, backdrop, shadowPlane, gridHelper;
  let byId = {};          // partId -> [objek]
  let labelEls = {};      // partId -> elemen label
  let clock, tAcc = 0, frames = 0, fpsT = 0;

  const LBL = $('#labels'), LEAD = $('#leaders'), TIP = $('#tooltip');
  const CANVAS = $('#scene');

  /* ==========================================================
     INISIALISASI
     ========================================================== */
  function init() {
    renderer = new THREE.WebGLRenderer({
      canvas: CANVAS, antialias: true, alpha: false,
      preserveDrawingBuffer: true, powerPreference: 'high-performance'
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
    controls.minDistance = 0.9 * K;
    controls.maxDistance = 60 * K;
    controls.flyTo({
      theta: Math.PI / 2, phi: Math.PI / 2 - 0.16, radius: 13.5 * K,
      target: new THREE.Vector3(0, -0.25 * K, 0.1 * K), duration: 0.01
    });

    lights();
    setEnvironment(false);
    environment();

    raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: .1 };
    raycaster.params.Line = { threshold: 0.02 };   // serabut saraf sangat tipis
    pointer = new THREE.Vector2(-2, -2);

    clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 3);
    clock = new THREE.Clock();
  }

  function lights() {
    // Peta lingkungan menyumbang sebagian besar cahaya ambien (PBR),
    // lampu berarah hanya menambah bentuk & kilau.
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

    scene.userData.lights = { hemi: hemi, key: key, fill: fill, rim: rim, spark: spark };
  }

  /** Bangun peta lingkungan PBR dari tekstur equirect prosedural. */
  function setEnvironment(bright) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const src = TEX.envEquirect(bright);
    if (scene.environment) scene.environment.dispose();
    scene.environment = pmrem.fromEquirectangular(src).texture;
    src.dispose();
    pmrem.dispose();
  }

  function environment() {
    // kubah latar bergradien
    const g = new THREE.SphereGeometry(120, 32, 24);
    const m = new THREE.MeshBasicMaterial({
      map: TEX.backdrop('#1a2029', '#07090d'), side: THREE.BackSide, depthWrite: false, fog: false
    });
    backdrop = new THREE.Mesh(g, m);
    scene.add(backdrop);

    // bayangan kontak palsu (lembut, tidak butuh shadow map)
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

    // grid 8 mm dengan sel 0,25 mm - sepadan dengan tubuh 2,5 mm
    gridHelper = new THREE.GridHelper(8, 32, 0x2a3644, 0x1a222c);
    gridHelper.position.y = FLY.GROUND - 0.02 * K;
    gridHelper.visible = false;
    if (gridHelper.material) {
      const mats = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
      mats.forEach(mm => { mm.transparent = true; mm.opacity = .5; });
    }
    scene.add(gridHelper);
  }

  /* ==========================================================
     BANGUN MODEL
     ========================================================== */
  function buildModel() {
    model = FLY.build(function (msg) {
      const el = $('#ldStep'); if (el) el.textContent = msg;
    });
    scene.add(model.root);

    // ---- lapisan neuropil otak ----
    const cx = CONNECTOME.build();
    cx.group.visible = false;
    model.root.add(cx.group);
    model.parts = model.parts.concat(cx.parts);
    model.layerRoots.connectome = cx.group;
    model.connectomeMode = cx.mode;

    // coba ganti dengan mesh FlyWire asli bila data/neuropil.json tersedia
    CONNECTOME.loadReal('data/neuropil.json', function (real) {
      if (!real) return;
      model.root.remove(cx.group);
      model.parts = model.parts.filter(p => p.userData.layer !== 'connectome').concat(real.parts);
      real.group.visible = !!S.layers.connectome;
      model.root.add(real.group);
      model.layerRoots.connectome = real.group;
      model.connectomeMode = 'flywire';
      reindex();
      buildPartList();
      buildLabels();
      applyLayers();
      console.log('[konektom] mesh FlyWire dimuat:', real.meta.source || '(tanpa keterangan)');
    });

    // ---- lapisan bentuk sel saraf ----
    const nx = NEURONS.build(model);
    nx.group.visible = false;
    model.root.add(nx.group);
    model.parts = model.parts.concat(nx.parts);
    model.layerRoots.neuron = nx.group;
    model.neuronSegments = nx.segments;

    NEURONS.loadReal('data/neurons.json', function (real) {
      if (!real) return;
      model.root.remove(nx.group);
      model.parts = model.parts.filter(p => p.userData.layer !== 'neuron').concat(real.parts);
      real.group.visible = !!S.layers.neuron;
      model.root.add(real.group);
      model.layerRoots.neuron = real.group;
      model.neuronSegments = real.segments;
      reindex();
      buildPartList();
      buildLabels();
      applyLayers();
      console.log('[neuron] skeleton FlyWire dimuat:', real.meta.source || '(tanpa keterangan)');
    });

    // indeks partId -> objek
    reindex();

    // halter untuk animasi
    model.halteres = (byId['halter'] || []).slice();

    applyLayers();
    buildPartList();
    buildLabels();

    $('#stPart').textContent = Object.keys(byId).length;
  }

  function reindex() {
    byId = {};
    model.parts.forEach(p => {
      const id = p.userData.partId;
      (byId[id] = byId[id] || []).push(p);
      // simpan opasitas dasar tiap material
      p.traverse(o => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (m.userData.baseOpacity === undefined) {
            m.userData.baseOpacity = m.opacity;
            m.userData.baseTransparent = m.transparent;
            m.userData.baseDepthWrite = m.depthWrite;
          }
        });
      });
    });
    $('#stPart').textContent = Object.keys(byId).length;
  }

  /* ==========================================================
     DAFTAR BAGIAN (sidebar)
     ========================================================== */
  function buildPartList() {
    const host = $('#partList');
    host.innerHTML = '';
    let total = 0;

    ANATOMI.GROUPS.forEach(grp => {
      const ids = Object.keys(byId).filter(id => {
        const info = ANATOMI.PARTS[id];
        return info && info.grup === grp.id;
      });
      if (!ids.length) return;
      total += ids.length;

      const wrap = document.createElement('div');
      wrap.className = 'grp';
      wrap.dataset.grp = grp.id;

      const head = document.createElement('div');
      head.className = 'grp-h';
      head.innerHTML = '<span class="ar">▾</span><span class="sw" style="background:' + grp.warna + '"></span>' +
        '<span>' + grp.nama + '</span><span class="n">' + ids.length + '</span>';
      head.onclick = () => wrap.classList.toggle('closed');
      wrap.appendChild(head);

      const body = document.createElement('div');
      body.className = 'grp-b';
      ids.forEach(id => {
        const info = ANATOMI.PARTS[id];
        const it = document.createElement('div');
        it.className = 'it';
        it.dataset.id = id;
        it.innerHTML = '<span class="nm">' + info.nama + '</span><span class="lt">' + (info.latin || '') + '</span>';
        it.onclick = () => select(id, true);
        it.onmouseenter = () => hoverId(id);
        it.onmouseleave = () => hoverId(null);
        body.appendChild(it);
      });
      wrap.appendChild(body);
      host.appendChild(wrap);
    });

    $('#partCount').textContent = total + ' bagian';
  }

  function filterList(q) {
    q = (q || '').trim().toLowerCase();
    let shown = 0;
    $$('#partList .grp').forEach(g => {
      let n = 0;
      g.querySelectorAll('.it').forEach(it => {
        const info = ANATOMI.PARTS[it.dataset.id];
        const hay = (info.nama + ' ' + (info.latin || '') + ' ' + (info.ringkas || '')).toLowerCase();
        const ok = !q || hay.indexOf(q) >= 0;
        it.style.display = ok ? '' : 'none';
        if (ok) n++;
      });
      g.style.display = n ? '' : 'none';
      if (q && n) g.classList.remove('closed');
      shown += n;
    });
    $('#partCount').textContent = shown + ' bagian';
  }

  /* ==========================================================
     LABEL MELAYANG
     ========================================================== */
  function buildLabels() {
    LBL.innerHTML = ''; LEAD.innerHTML = '';
    labelEls = {};
    const seen = {};
    model.parts.forEach(p => {
      if (!p.userData.label) return;
      const id = p.userData.partId;
      if (seen[id]) return;
      seen[id] = true;
      const info = ANATOMI.PARTS[id];
      if (!info) return;

      const el = document.createElement('div');
      el.className = 'lbl g-' + (info.grup === 'internal' ? 'internal' : info.grup === 'saraf' ? 'nerve' : 'x');
      el.innerHTML = '<span class="dot"></span>' + info.nama;
      el.onclick = () => select(id, true);
      el.onmouseenter = () => hoverId(id);
      el.onmouseleave = () => hoverId(null);
      LBL.appendChild(el);

      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      LEAD.appendChild(ln);

      el.dataset.id = id;
      labelEls[id] = { el: el, line: ln, obj: p };
    });
  }

  const _v = new THREE.Vector3(), _c = new THREE.Vector3();

  function updateLabels() {
    const W = innerWidth, H = innerHeight;
    const show = S.labels;

    // pusat model di layar (untuk arah dorong label)
    _c.set(0, -0.2, 0).project(camera);
    const cx = (_c.x * .5 + .5) * W, cy = (-_c.y * .5 + .5) * H;

    const items = [];
    Object.keys(labelEls).forEach(id => {
      const L = labelEls[id];
      const vis = show && isVisible(L.obj);
      if (!vis) { L.el.style.display = 'none'; L.line.setAttribute('opacity', 0); return; }

      _v.copy(L.obj.userData.anchor);
      L.obj.localToWorld(_v);
      _v.project(camera);
      if (_v.z > 1) { L.el.style.display = 'none'; L.line.setAttribute('opacity', 0); return; }

      const px = (_v.x * .5 + .5) * W, py = (-_v.y * .5 + .5) * H;
      let dx = px - cx, dy = py - cy;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      items.push({
        L: L, ax: px, ay: py,
        x: px + dx * 66, y: py + dy * 52,
        depth: _v.z
      });
    });

    // hindari tumpang tindih secara vertikal
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1], cur = items[i];
      if (Math.abs(cur.x - prev.x) < 130 && cur.y - prev.y < 23) cur.y = prev.y + 23;
    }

    items.forEach(it => {
      const L = it.L;
      L.el.style.display = '';
      L.el.style.left = Math.max(8, Math.min(W - 8, it.x)) + 'px';
      L.el.style.top = Math.max(60, Math.min(H - 200, it.y)) + 'px';
      L.el.style.opacity = String(0.45 + 0.55 * (1 - THREE.MathUtils.clamp(it.depth, 0, 1)));
      L.line.setAttribute('x1', it.ax); L.line.setAttribute('y1', it.ay);
      L.line.setAttribute('x2', Math.max(8, Math.min(W - 8, it.x)));
      L.line.setAttribute('y2', Math.max(60, Math.min(H - 200, it.y)));
      L.line.setAttribute('opacity', 1);
    });
  }

  function isVisible(o) {
    let n = o;
    while (n) { if (!n.visible) return false; n = n.parent; }
    return true;
  }

  /* ==========================================================
     SELEKSI & SOROTAN
     ========================================================== */
  function setHL(obj, on, hex) {
    obj.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      if (on) {
        if (!o.userData._orig) o.userData._orig = o.material;
        o.userData._hl = o.userData._hl || {};
        if (!o.userData._hl[hex]) {
          const m = o.userData._orig.clone();
          m.userData = Object.assign({}, o.userData._orig.userData);
          if (m.emissive !== undefined) {
            m.emissive = new THREE.Color(hex);
            m.emissiveIntensity = 1;
          } else {
            m.color = new THREE.Color(hex);
          }
          o.userData._hl[hex] = m;
        }
        o.material = o.userData._hl[hex];
      } else if (o.userData._orig) {
        o.material = o.userData._orig;
      }
    });
  }

  function clearHL(id) { (byId[id] || []).forEach(o => setHL(o, false)); }

  function select(id, fromUI) {
    if (S.sel && S.sel !== id) clearHL(S.sel);
    if (S.hover) { clearHL(S.hover); S.hover = null; }

    if (!id || S.sel === id) {
      S.sel = null;
      $('#inspector').classList.add('hidden');
      $$('#partList .it').forEach(e => e.classList.remove('sel'));
      $$('.lbl').forEach(e => e.classList.remove('sel'));
      if (S.isolate) { S.isolate = false; applyLayers(); }
      applyXray();
      return;
    }

    S.sel = id;
    (byId[id] || []).forEach(o => setHL(o, true, 0xffb454));
    applyXray();
    showInfo(id);

    $$('#partList .it').forEach(e => e.classList.toggle('sel', e.dataset.id === id));
    Object.keys(labelEls).forEach(k => labelEls[k].el.classList.toggle('sel', k === id));

    if (fromUI) {
      const it = $('#partList .it[data-id="' + id + '"]');
      if (it) it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // pastikan lapisannya menyala
      const info = ANATOMI.PARTS[id];
      const lay = info && info.layer;
      if (lay && S.layers[lay] === false) {
        S.layers[lay] = true;
        const cb = $('#layers input[data-layer="' + lay + '"]');
        if (cb) cb.checked = true;
        if (['internal', 'muscle', 'nerve', 'trachea', 'connectome', 'neuron'].indexOf(lay) >= 0) raiseXray();
        applyLayers();
      }
    }
    if (S.isolate) applyLayers();
  }

  function hoverId(id) {
    if (S.hover === id) return;
    if (S.hover && S.hover !== S.sel) clearHL(S.hover);
    S.hover = id;
    if (id && id !== S.sel) (byId[id] || []).forEach(o => setHL(o, true, 0x2f6f6a));
    CANVAS.style.cursor = id ? 'pointer' : '';
  }

  function showInfo(id) {
    const d = ANATOMI.PARTS[id];
    if (!d) return;
    const grp = ANATOMI.GROUPS.filter(g => g.id === d.grup)[0];
    $('#inspector').classList.remove('hidden');
    $('#insGroup').textContent = grp ? grp.nama : d.grup;
    $('#insGroup').style.background = grp ? hexA(grp.warna, .15) : '';
    $('#insGroup').style.color = grp ? grp.warna : '';
    $('#insName').textContent = d.nama;
    $('#insLatin').textContent = d.latin || '';
    $('#insMetrics').innerHTML = (d.ukuran || []).map(u => '<span>' + u + '</span>').join('');
    $('#insDesc').innerHTML = d.ringkas || '';
    $('#insFacts').innerHTML = (d.fakta || []).map(f => '<div class="fct"><div>' + f + '</div></div>').join('');
    $('#btnIsolate').classList.toggle('on', S.isolate);
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ==========================================================
     LAPISAN / EXPLODE / X-RAY / POTONGAN
     ========================================================== */
  function applyLayers() {
    Object.keys(model.layerRoots).forEach(k => {
      model.layerRoots[k].visible = !!S.layers[k];
    });
    model.parts.forEach(p => {
      const lay = p.userData.layer;
      let v = S.layers[lay] !== false;
      if (S.isolate && S.sel) v = v && (p.userData.partId === S.sel);
      p.visible = v;
    });
  }

  function applyExplode() {
    const k = S.explode / 100;
    model.parts.forEach(p => {
      const e = p.userData.explode;
      if (!e) return;
      p.position.copy(p.userData.home).addScaledVector(e, k);
    });
  }

  function applyXray() {
    const v = S.xray / 100;
    const done = new Set();
    model.parts.forEach(p => {
      const lay = p.userData.layer;
      if (['exo', 'leg', 'seta', 'eye'].indexOf(lay) < 0) return;
      const keep = S.sel && p.userData.partId === S.sel;   // bagian terpilih tetap pekat
      p.traverse(o => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (done.has(m)) return;
          done.add(m);
          const base = m.userData.baseOpacity !== undefined ? m.userData.baseOpacity : 1;
          const f = keep ? Math.min(v, 0.15) : v;
          const op = base * (1 - f * 0.92);
          m.opacity = op;
          m.transparent = op < 0.999 || m.userData.baseTransparent;
          m.depthWrite = op > 0.62;
        });
      });
    });
  }

  function raiseXray() {
    if (S.xray < 55) {
      S.xray = 55;
      const sl = $('#xray'); sl.value = 55; syncRange(sl); $('#xrayV').textContent = '55%';
      applyXray();
    }
  }

  function applyClip() {
    if (S.clip >= 100) { renderer.clippingPlanes = []; return; }
    clipPlane.constant = -3 + (S.clip / 100) * 6;
    renderer.clippingPlanes = [clipPlane];
  }

  function applyWire() {
    model.root.traverse(o => {
      if (o.isMesh || o.isInstancedMesh) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m) m.wireframe = S.wire; });
      }
    });
  }

  /* ==========================================================
     KAMERA
     ========================================================== */
  /* Jarak (r) dalam satuan sasis; dikali K jadi milimeter.
     Dihitung dari bidang pandang: lebar terlihat = 1.09 x jarak (fov 36, rasio ~1.7).
     Contoh - rentang sayap 4,96 mm butuh jarak ~6 mm, yaitu r = 6/0.37 = 16.  */
  const VIEWS = {
    lateral:   { theta: Math.PI / 2, phi: Math.PI / 2 - 0.16, r: 13.5, t: [0, -0.25, 0.1] },
    dorsal:    { theta: Math.PI / 2, phi: 0.10, r: 16.5, t: [0, -0.2, -0.3] },
    ventral:   { theta: Math.PI / 2, phi: Math.PI - 0.10, r: 16.5, t: [0, -0.2, -0.3] },
    anterior:  { theta: 0, phi: Math.PI / 2 - 0.10, r: 13.0, t: [0, -0.2, 1.2] },
    posterior: { theta: Math.PI, phi: Math.PI / 2 - 0.10, r: 13.0, t: [0, -0.2, -1.2] },
    head:      { theta: 0.85, phi: Math.PI / 2 - 0.30, r: 4.6, t: [0, -0.05, 2.74] },
    wing:      { theta: 1.15, phi: 0.60, r: 9.0, t: [2.6, 0.7, -0.8] },
    leg:       { theta: 1.30, phi: Math.PI / 2 + 0.28, r: 6.0, t: [1.6, -1.6, 0.9] },
    otak:      { theta: 0.95, phi: Math.PI / 2 - 0.55, r: 3.8, t: [0, 0.16, 2.62] }
  };

  function goView(name) {
    const v = VIEWS[name]; if (!v) return;
    controls.flyTo({
      theta: v.theta, phi: v.phi, radius: v.r * K,
      target: new THREE.Vector3(v.t[0] * K, v.t[1] * K, v.t[2] * K), duration: 0.9
    });
    $$('#viewPresets .chip').forEach(c => c.classList.toggle('active', c.dataset.view === name));
  }

  function focusPart(id) {
    const objs = byId[id]; if (!objs || !objs.length) return;
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    objs.forEach((o, i) => {
      tmp.setFromObject(o);
      if (i === 0) box.copy(tmp); else box.union(tmp);
    });
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const r = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 3.4, 1.4 * K, 22 * K);
    const sp = controls.getSpherical();
    controls.flyTo({ theta: sp.theta, phi: sp.phi, radius: r, target: c, duration: 0.8 });
    $$('#viewPresets .chip').forEach(cc => cc.classList.remove('active'));
  }

  /* ==========================================================
     RAYCAST
     ========================================================== */
  function pick(ev) {
    const r = CANVAS.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(model.root, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      if (!isVisible(o)) continue;
      while (o && !o.userData.partId) o = o.parent;
      if (o && o.userData.partId) return { id: o.userData.partId, point: hits[i].point };
    }
    return null;
  }

  /* ==========================================================
     GIZMO ORIENTASI
     ========================================================== */
  const GZ = $('#gizmoCanvas'), gctx = GZ ? GZ.getContext('2d') : null;
  function drawGizmo() {
    if (!gctx) return;
    const S2 = 110, c = S2 / 2, R = 34;
    gctx.clearRect(0, 0, S2, S2);
    gctx.strokeStyle = 'rgba(255,255,255,.07)';
    gctx.lineWidth = 1;
    gctx.beginPath(); gctx.arc(c, c, R + 10, 0, 6.2832); gctx.stroke();

    const m = camera.matrixWorldInverse;
    const axes = [
      { v: new THREE.Vector3(0, 0, 1), l: 'A', col: '#4fd1c5' },   // anterior
      { v: new THREE.Vector3(0, 1, 0), l: 'D', col: '#ffb454' },   // dorsal
      { v: new THREE.Vector3(1, 0, 0), l: 'K', col: '#a3d977' }    // kanan
    ];
    const proj = axes.map(a => {
      const p = a.v.clone().applyMatrix4(new THREE.Matrix4().extractRotation(m));
      return { x: c + p.x * R, y: c - p.y * R, z: p.z, l: a.l, col: a.col };
    }).sort((p, q) => p.z - q.z);

    proj.forEach(p => {
      gctx.globalAlpha = 0.45 + 0.55 * ((p.z + 1) / 2);
      gctx.strokeStyle = p.col; gctx.lineWidth = 1.8;
      gctx.beginPath(); gctx.moveTo(c, c); gctx.lineTo(p.x, p.y); gctx.stroke();
      gctx.fillStyle = p.col;
      gctx.beginPath(); gctx.arc(p.x, p.y, 7.5, 0, 6.2832); gctx.fill();
      gctx.fillStyle = '#0a0c10';
      gctx.font = '700 9px ui-monospace,monospace';
      gctx.textAlign = 'center'; gctx.textBaseline = 'middle';
      gctx.fillText(p.l, p.x, p.y + 0.5);
    });
    gctx.globalAlpha = 1;
  }

  /* ==========================================================
     SKALA
     ========================================================== */
  function updateScale() {
    const dist = camera.position.distanceTo(controls.target);
    const worldPerPx = 2 * dist * Math.tan((camera.fov / 2) * Math.PI / 180) / innerHeight;
    const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
    let mm = 1;
    for (let i = 0; i < nice.length; i++) {
      if (nice[i] / worldPerPx >= 56) { mm = nice[i]; break; }
      mm = nice[i];
    }
    const px = Math.round(mm / worldPerPx);
    const bar = $('#scalebar .sb-line');
    if (bar) bar.style.width = Math.min(px, 220) + 'px';
    const t = $('#sbTxt');
    if (t) t.textContent = (mm < 1 ? (mm * 1000) + ' µm' : mm + ' mm');
  }

  /* ==========================================================
     UI
     ========================================================== */
  function syncRange(el) {
    const p = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--p', p + '%');
  }

  function bindUI() {
    // preset pandangan
    $$('#viewPresets .chip').forEach(b => b.onclick = () => goView(b.dataset.view));

    // sidebar
    $('#btnSidebar').onclick = () => $('#sidebar').classList.toggle('off');
    $('#search').oninput = e => filterList(e.target.value);
    $('#btnResetSel').onclick = () => { $('#search').value = ''; filterList(''); select(null); };

    // inspector
    $('#btnCloseInsp').onclick = () => select(null);
    $('#btnFocus').onclick = () => { if (S.sel) focusPart(S.sel); };
    $('#btnIsolate').onclick = () => {
      S.isolate = !S.isolate;
      $('#btnIsolate').classList.toggle('on', S.isolate);
      applyLayers();
    };

    // lapisan
    $$('#layers input').forEach(cb => {
      cb.onchange = () => {
        S.layers[cb.dataset.layer] = cb.checked;
        if (cb.checked && ['internal', 'muscle', 'nerve', 'trachea', 'connectome', 'neuron'].indexOf(cb.dataset.layer) >= 0) raiseXray();
        applyLayers();
      };
    });

    // slider
    const ex = $('#explode'), xr = $('#xray'), cl = $('#clip');
    [ex, xr, cl].forEach(syncRange);
    ex.oninput = () => { S.explode = +ex.value; $('#explodeV').textContent = ex.value + '%'; syncRange(ex); applyExplode(); };
    xr.oninput = () => { S.xray = +xr.value; $('#xrayV').textContent = xr.value + '%'; syncRange(xr); applyXray(); };
    cl.oninput = () => {
      S.clip = +cl.value;
      $('#clipV').textContent = cl.value >= 100 ? 'off' : cl.value + '%';
      syncRange(cl); applyClip();
    };

    // tombol
    const tg = (el, fn) => { el.onclick = () => { el.classList.toggle('active'); fn(el.classList.contains('active')); }; };
    tg($('#togLabels'), v => { S.labels = v; });
    tg($('#togRotate'), v => { S.autorot = v; controls.autoRotate = v; });
    tg($('#togWire'), v => { S.wire = v; applyWire(); });
    tg($('#togFlap'), v => { S.flap = v; if (!v) resetWings(); });
    tg($('#togGrid'), v => { S.grid = v; gridHelper.visible = v; });
    tg($('#togHemi'), v => {
      S.light = v;
      backdrop.material.map = TEX.backdrop(v ? '#dfe7ef' : '#1a2029', v ? '#9fb0c2' : '#07090d');
      backdrop.material.needsUpdate = true;
      scene.fog.color.set(v ? 0xc8d4e0 : 0x0a0c10);
      scene.userData.lights.fill.intensity = v ? 0.45 : 0.26;
      scene.userData.lights.hemi.intensity = v ? 0.40 : 0.22;
      renderer.toneMappingExposure = v ? 0.80 : 0.95;
      shadowPlane.material.opacity = v ? 0.50 : 0.85;
      setEnvironment(v);
    });

    // modal
    $('#btnHelp').onclick = () => $('#modal').classList.remove('hidden');
    $('#btnCloseModal').onclick = () => $('#modal').classList.add('hidden');
    $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };

    // tangkapan layar
    $('#btnShot').onclick = () => {
      renderer.render(scene, camera);
      const a = document.createElement('a');
      a.download = 'anatomi-lalat-' + Date.now() + '.png';
      a.href = renderer.domElement.toDataURL('image/png');
      a.click();
    };

    // interaksi kanvas
    CANVAS.addEventListener('pointermove', ev => {
      if (controls._state !== 0) { TIP.classList.remove('on'); hoverId(null); return; }
      const h = pick(ev);
      hoverId(h ? h.id : null);
      if (h) {
        const d = ANATOMI.PARTS[h.id];
        TIP.innerHTML = d ? (d.nama + (d.latin ? '<i>' + d.latin + '</i>' : '')) : h.id;
        TIP.style.left = (ev.clientX + 14) + 'px';
        TIP.style.top = (ev.clientY + 16) + 'px';
        TIP.classList.add('on');
      } else TIP.classList.remove('on');
    });
    CANVAS.addEventListener('pointerleave', () => { TIP.classList.remove('on'); hoverId(null); });
    CANVAS.addEventListener('click', ev => {
      if (controls.wasDrag()) return;
      const h = pick(ev);
      select(h ? h.id : null);
    });
    CANVAS.addEventListener('dblclick', ev => {
      const h = pick(ev);
      if (h) { select(h.id); focusPart(h.id); }
    });

    // papan tik
    const keyViews = ['lateral', 'dorsal', 'ventral', 'anterior', 'posterior', 'head', 'wing', 'leg', 'otak'];
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '9') return goView(keyViews[+k - 1]);
      if (k === 'l') return $('#togLabels').click();
      if (k === 'r') return $('#togRotate').click();
      if (k === 'w') return $('#togWire').click();
      if (k === 'g') return $('#togGrid').click();
      if (k === 'k') return $('#togFlap').click();
      if (k === 'p') return $('#btnShot').click();
      if (k === 'h' || k === '?') return $('#btnHelp').click();
      if (k === 'tab') { e.preventDefault(); return $('#btnSidebar').click(); }
      if (k === 'f') { if (S.sel) focusPart(S.sel); return; }
      if (k === 'n') {
        const cb = $('#layers input[data-layer="neuron"]');
        cb.checked = !cb.checked; cb.onchange(); return;
      }
      if (k === 'b') {
        const cb = $('#layers input[data-layer="connectome"]');
        cb.checked = !cb.checked; cb.onchange(); return;
      }
      if (k === 'i') {
        const cb = $('#layers input[data-layer="internal"]');
        cb.checked = !cb.checked; cb.onchange(); return;
      }
      if (k === 'x') {
        const xr2 = $('#xray');
        xr2.value = +xr2.value > 0 ? 0 : 65; xr2.oninput(); return;
      }
      if (k === 'e') {
        const ex2 = $('#explode');
        ex2.value = +ex2.value > 0 ? 0 : 100; ex2.oninput(); return;
      }
      if (k === 'escape') {
        select(null);
        $('#modal').classList.add('hidden');
        goView('lateral');
      }
    });

    addEventListener('resize', onResize);
  }

  function resetWings() {
    model.wings.forEach(w => {
      w.rotation.z = w.userData.baseZ;
      w.rotation.x = 0;
    });
    model.halteres.forEach(h => { h.rotation.z = 0; });
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    LEAD.setAttribute('width', innerWidth);
    LEAD.setAttribute('height', innerHeight);
    LEAD.setAttribute('viewBox', '0 0 ' + innerWidth + ' ' + innerHeight);
  }

  /* ==========================================================
     LOOP
     ========================================================== */
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    tAcc += dt;

    if (S.flap) {
      const f = 5.2;                                    // diperlambat agar terlihat
      const a = Math.sin(tAcc * Math.PI * 2 * f);
      const b = Math.sin(tAcc * Math.PI * 2 * f + 1.15);
      model.wings.forEach(w => {
        const s = w.userData.side;
        w.rotation.z = w.userData.baseZ + s * a * 0.80;
        w.rotation.x = b * 0.26;
      });
      model.halteres.forEach(h => {
        // berputar terhadap titik asal tubuh; tanda sisi menjaga ayunan tetap simetris
        h.rotation.z = -a * 0.30 * (h.userData.side || 1);
      });
    }

    controls.update(dt);
    shadowPlane.visible = camera.position.y > FLY.GROUND + 0.05 * K;
    renderer.render(scene, camera);

    updateLabels();
    drawGizmo();
    updateScale();

    frames++;
    if (tAcc - fpsT > 0.5) {
      $('#stFps').textContent = Math.round(frames / (tAcc - fpsT));
      $('#stTri').textContent = renderer.info.render.triangles.toLocaleString('id-ID');
      frames = 0; fpsT = tAcc;
    }
  }

  /* ==========================================================
     MULAI
     ========================================================== */
  function start() {
    try {
      init();
    } catch (err) {
      $('#ldStep').textContent = 'WebGL tidak tersedia';
      console.error(err);
      return;
    }
    onResize();
    requestAnimationFrame(() => {
      try {
        buildModel();
        bindUI();
        applyExplode();
        applyXray();
        animate();

        // Pegangan untuk pengembangan & uji otomatis. Dipakai dari konsol:
        //   APP.goView('otak')        APP.controls.getSpherical()
        //   APP.model.parts.length    APP.select('np-medula')
        window.APP = {
          scene: scene, camera: camera, controls: controls, model: model,
          goView: goView, select: select, focusPart: focusPart, state: S
        };

        setTimeout(() => $('#loader').classList.add('done'), 260);
      } catch (err) {
        $('#ldStep').textContent = 'gagal: ' + err.message;
        console.error(err);
      }
    });
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
