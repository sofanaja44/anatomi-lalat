/* ==========================================================
   neurons.js - lapisan bentuk sel saraf di dalam otak.

   DUA MODE (sama polanya dengan connectome.js):

   1. SKEMATIS (bawaan, selalu jalan)
      Berkas serabut digambar mengikuti jalur yang memang diketahui
      benar secara anatomis - termasuk peta retinotopik 1:1 dari tiap
      faset mata ke lamina, dan dua persilangan (khiasma) di lobus
      optik. BUKAN rekonstruksi FlyWire: bentuk tiap sel disederhanakan.

   2. SKELETON ASLI FlyWire
      Jalankan  python tools/fetch_neurons.py  untuk menghasilkan
      data/neurons.json dari berkas SWC, lalu sajikan lewat HTTP.
      Berkas itu dimuat otomatis dan MENGGANTIKAN bentuk skematis.

   Digambar sebagai THREE.LineSegments - satu geometri gabungan per
   berkas, sehingga ratusan ribu ruas pun tetap ringan.
   ========================================================== */
(function (global) {
  'use strict';

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const PARTS = [];

  /* ---------- akses tabel neuropil dari connectome.js ---------- */
  function np(id) {
    const list = (global.CONNECTOME && global.CONNECTOME.NEUROPIL) || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------- material & geometri berkas ---------- */
  function lineMat(opacity) {
    return new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true,
      opacity: opacity == null ? 0.55 : opacity, depthWrite: false
    });
  }

  /** Haluskan daftar titik menjadi kurva. */
  function smooth(pts, n) {
    if (pts.length < 3) return pts;
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5).getPoints(n || 14);
  }

  /**
   * Gabungkan banyak lintasan menjadi satu LineSegments.
   * Warna bergradasi dari c0 (pangkal) ke c1 (ujung) -> arah aliran sinyal.
   */
  function bundle(paths, c0, c1, opacity) {
    const pos = [], col = [];
    const a = new THREE.Color(c0), b = new THREE.Color(c1), t = new THREE.Color();
    paths.forEach(pts => {
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        pos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        t.copy(a).lerp(b, i / (n - 1)); col.push(t.r, t.g, t.b);
        t.copy(a).lerp(b, (i + 1) / (n - 1)); col.push(t.r, t.g, t.b);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.LineSegments(g, lineMat(opacity));
  }

  function reg(obj, id, opts) {
    const o = opts || {};
    obj.userData.partId = id;
    obj.userData.info = ANATOMI.PARTS[id] || null;
    obj.userData.layer = 'neuron';
    obj.userData.explode = o.explode ? V3(o.explode[0], o.explode[1], o.explode[2]) : null;
    obj.userData.label = !!o.label;
    obj.userData.home = obj.position.clone();
    PARTS.push(obj);
    return obj;
  }

  /** Titik pada "lembar" neuropil dari koordinat retinotopik (u,v). */
  function sheet(def, side, u, v, k, flipV) {
    return V3(
      side * def.pos[0],
      def.pos[1] + u * def.r[1] * (k || 0.85),
      def.pos[2] + (flipV ? -v : v) * def.r[2] * (k || 0.85)
    );
  }

  /* ==========================================================
     1. AKSON FOTORESEPTOR  (retina -> lamina)
        Satu serabut per omatidium. Inilah peta retinotopik:
        faset ke-n mengirim ke kartrid ke-n.
     ========================================================== */
  function buildPhotoreceptors(omm) {
    const LA = np('np-lamina');
    const paths = [];
    ['r', 'l'].forEach(key => {
      const side = key === 'r' ? 1 : -1;
      (omm[key] || []).forEach(o => {
        const target = sheet(LA, side, o.u, o.v, 0.85);
        const entry = target.clone();
        entry.x = side * (LA.pos[0] + LA.r[0] * 1.5);          // masuk dari sisi luar lamina
        const start = o.pos.clone();
        const dip = start.clone().addScaledVector(o.nrm, -0.07); // menukik di balik lensa
        paths.push(smooth([start, dip, entry, target], 8));
      });
    });
    return bundle(paths, '#ff8a1f', '#00a8c6', 0.13);
  }

  /* ==========================================================
     2. KHIASMA LUAR  (lamina -> medula)
        Serabut BERSILANGAN: urutan depan-belakang terbalik.
     ========================================================== */
  function buildOuterChiasm(omm, step) {
    const LA = np('np-lamina'), ME = np('np-medula');
    const paths = [];
    ['r', 'l'].forEach(key => {
      const side = key === 'r' ? 1 : -1;
      const list = omm[key] || [];
      for (let i = 0; i < list.length; i += step) {
        const o = list[i];
        const a = sheet(LA, side, o.u, o.v, 0.80);
        const b = sheet(ME, side, o.u, o.v, 0.80, true);        // <- v dibalik
        const mid = a.clone().lerp(b, 0.5);
        mid.x = side * (LA.pos[0] + ME.pos[0]) / 2;
        paths.push(smooth([a, mid, b], 12));
      }
    });
    return bundle(paths, '#00a8c6', '#1272c4', 0.28);
  }

  /* ==========================================================
     3. KHIASMA DALAM  (medula -> lobula & lobula plate)
        Persilangan kedua: urutan kembali seperti semula.
     ========================================================== */
  function buildInnerChiasm(omm, step) {
    const ME = np('np-medula'), LO = np('np-lobula'), LOP = np('np-lobula-plate');
    const paths = [];
    ['r', 'l'].forEach(key => {
      const side = key === 'r' ? 1 : -1;
      const list = omm[key] || [];
      for (let i = 0; i < list.length; i += step) {
        const o = list[i];
        const a = sheet(ME, side, o.u, o.v, 0.78, true);
        const tgt = (i % (step * 2) === 0) ? LO : LOP;          // bercabang ke dua tujuan
        const b = sheet(tgt, side, o.u, o.v, 0.78);
        const mid = a.clone().lerp(b, 0.5);
        mid.x = side * (ME.pos[0] + tgt.pos[0]) / 2;
        paths.push(smooth([a, mid, b], 12));
      }
    });
    return bundle(paths, '#1272c4', '#5e3aa8', 0.32);
  }

  /* ==========================================================
     4. NEURON PROYEKSI OLFAKTORI  (lobus antena -> kaliks -> tanduk lateral)
     ========================================================== */
  function buildOlfactoryPN() {
    const AL = np('np-lobus-antena'), CA = np('np-mb-kaliks'), LH = np('np-tanduk-lateral');
    const paths = [];
    [-1, 1].forEach(side => {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const start = V3(
          side * (AL.pos[0] + Math.cos(a) * AL.r[0] * 0.7),
          AL.pos[1] + Math.sin(a) * AL.r[1] * 0.7,
          AL.pos[2] + Math.cos(a * 1.7) * AL.r[2] * 0.5
        );
        const calyx = V3(
          side * (CA.pos[0] + Math.cos(a) * CA.r[0] * 0.6),
          CA.pos[1] + Math.sin(a) * CA.r[1] * 0.6,
          CA.pos[2]
        );
        const lh = V3(
          side * (LH.pos[0] + Math.cos(a) * LH.r[0] * 0.6),
          LH.pos[1] + Math.sin(a) * LH.r[1] * 0.6,
          LH.pos[2]
        );
        const mid = V3(side * 0.26, 0.10, 2.66);
        paths.push(smooth([start, mid, calyx, lh], 20));
      }
    });
    return bundle(paths, '#3fa83f', '#e08a1e', 0.50);
  }

  /* ==========================================================
     5. SEL KENYON  (kaliks -> pedunkulus -> lobus)
        Badan jamur: pusat pembelajaran & ingatan.
     ========================================================== */
  function buildKenyon() {
    const CA = np('np-mb-kaliks');
    const paths = [];
    [-1, 1].forEach(side => {
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const start = V3(
          side * (CA.pos[0] + Math.cos(a) * CA.r[0] * 0.75),
          CA.pos[1] + Math.sin(a) * CA.r[1] * 0.75,
          CA.pos[2] + Math.cos(a * 2.3) * CA.r[2] * 0.5
        );
        const ped1 = V3(side * 0.185, 0.22, 2.50);
        const ped2 = V3(side * 0.16, 0.14, 2.74);
        const junc = V3(side * 0.148, 0.118, 2.815);
        // separuh ke lobus vertikal, separuh ke lobus medial
        const end = (i % 2 === 0)
          ? V3(side * (0.135 + (i % 5) * 0.004), 0.34, 2.84)
          : V3(side * (0.04 + (i % 5) * 0.010), 0.10, 2.845);
        paths.push(smooth([start, ped1, ped2, junc, end], 22));
      }
    });
    return bundle(paths, '#e08a1e', '#d1401c', 0.45);
  }

  /* ==========================================================
     6. NEURON KOMPAS E-PG  (badan elipsoid <-> jembatan protoserebral)
        Lingkar yang menyimpan arah hadap lalat.
     ========================================================== */
  function buildEPG() {
    const EB = np('np-badan-elipsoid');
    const paths = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const eb = V3(
        EB.pos[0] + Math.cos(a) * EB.r[0] * 0.82,
        EB.pos[1] + Math.sin(a) * EB.r[1] * 0.82,
        EB.pos[2]
      );
      // separuh menyeberang ke sisi otak yang berlawanan
      const sd = (i < N / 2) ? 1 : -1;
      const t = (i % (N / 2)) / (N / 2 - 1);
      const pb = V3(sd * (0.04 + t * 0.19), 0.28 + Math.sin(t * Math.PI) * 0.02, 2.465);
      const mid = V3(sd * 0.06, 0.18, 2.58);
      paths.push(smooth([eb, mid, pb], 18));
    }
    return bundle(paths, '#e03878', '#9a4fd0', 0.62);
  }

  /* ==========================================================
     7. NEURON DESENDEN  (otak -> ganglion toraks)
        Seluruh perintah dari otak ke tubuh lewat leher yang sempit ini.
     ========================================================== */
  function buildDescending() {
    const paths = [];
    [-1, 1].forEach(side => {
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const start = V3(
          side * (0.06 + t * 0.22),
          0.30 - t * 0.34,
          2.72 - t * 0.26
        );
        const neck = V3(side * 0.065, -0.36, 2.10);
        const neck2 = V3(side * 0.07, -0.40, 1.72);
        const end = V3(side * (0.04 + t * 0.18), -0.40 + t * 0.08, 1.30 - t * 0.18);
        paths.push(smooth([start, neck, neck2, end], 22));
      }
    });
    return bundle(paths, '#d13a6b', '#7a5ae0', 0.58);
  }

  /* ==========================================================
     API
     ========================================================== */
  function build(flyModel) {
    PARTS.length = 0;
    const root = new THREE.Group();
    root.name = 'neuron';

    const omm = (flyModel && flyModel.ommatidia) || { r: [], l: [] };

    root.add(reg(buildPhotoreceptors(omm), 'nrn-fotoreseptor', { label: true, explode: [0, 0.6, 1.2] }));
    root.add(reg(buildOuterChiasm(omm, 3), 'nrn-khiasma-luar', { label: true, explode: [0, 0.8, 0.6] }));
    root.add(reg(buildInnerChiasm(omm, 5), 'nrn-khiasma-dalam', { explode: [0, 0.8, 0.2] }));
    root.add(reg(buildOlfactoryPN(), 'nrn-pn-olfaktori', { label: true, explode: [0, 1.0, 0.8] }));
    root.add(reg(buildKenyon(), 'nrn-kenyon', { label: true, explode: [0, 1.2, 0.4] }));
    root.add(reg(buildEPG(), 'nrn-epg', { label: true, explode: [0, 1.3, 0] }));
    root.add(reg(buildDescending(), 'nrn-desenden', { label: true, explode: [0, -1.0, 0.4] }));

    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    PARTS.forEach(p => {
      box.setFromObject(p);
      p.userData.anchor = p.worldToLocal(box.getCenter(new THREE.Vector3()));
    });

    let ruas = 0;
    root.traverse(o => {
      if (o.isLineSegments) ruas += o.geometry.attributes.position.count / 2;
    });

    return { group: root, parts: PARTS.slice(), mode: 'skematis', segments: ruas };
  }

  /**
   * Muat skeleton neuron FlyWire (hasil tools/fetch_neurons.py).
   * Gagal dengan tenang bila berkas belum ada.
   *
   * Format data/neurons.json:
   *   { source, space:"chassis",
   *     bundles:[ { id, nama, color, color2,
   *                 paths:[ [x,y,z, x,y,z, ...], ... ] } ] }
   *   Setiap "path" adalah satu cabang neuron: deret titik berurutan.
   */
  function loadReal(url, onDone) {
    if (typeof fetch !== 'function') { onDone(null); return; }
    fetch(url, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(d => {
        if (!d || !Array.isArray(d.bundles) || !d.bundles.length) throw new Error('kosong');
        if (d.space !== 'chassis') throw new Error('ruang koordinat bukan "chassis"');

        PARTS.length = 0;
        const root = new THREE.Group();
        root.name = 'neuron-flywire';
        let ruas = 0;

        d.bundles.forEach(bd => {
          const paths = (bd.paths || []).map(flat => {
            const pts = [];
            for (let i = 0; i + 2 < flat.length; i += 3) pts.push(V3(flat[i], flat[i + 1], flat[i + 2]));
            return pts;
          }).filter(p => p.length > 1);
          if (!paths.length) return;
          const ls = bundle(paths, bd.color || '#7ee8e0', bd.color2 || bd.color || '#a78bfa', bd.opacity || 0.6);
          ruas += ls.geometry.attributes.position.count / 2;
          root.add(reg(ls, bd.id, { label: !!bd.label, explode: [0, 1.0, 0.4] }));
        });

        root.updateMatrixWorld(true);
        const box = new THREE.Box3();
        PARTS.forEach(p => {
          box.setFromObject(p);
          p.userData.anchor = p.worldToLocal(box.getCenter(new THREE.Vector3()));
        });

        onDone({ group: root, parts: PARTS.slice(), mode: 'flywire', meta: d, segments: ruas });
      })
      .catch(() => onDone(null));
  }

  global.NEURONS = { build: build, loadReal: loadReal };
})(window);
