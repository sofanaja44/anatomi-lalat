/* ==========================================================
   connectome.js - lapisan neuropil otak.

   DUA MODE:

   1. SKEMATIS (bawaan, selalu jalan)
      Wilayah neuropil digambar sebagai bentuk sederhana pada posisi
      anatomis yang benar. Berguna untuk orientasi & pengajaran, TETAPI
      BUKAN geometri FlyWire. Setiap entri diberi tanda "skematis".

   2. MESH ASLI FlyWire
      Jalankan  python tools/fetch_flywire.py  untuk menghasilkan
      data/neuropil.json, lalu sajikan lewat HTTP (node serve.js).
      Berkas itu dimuat otomatis dan MENGGANTIKAN bentuk skematis.
      Lihat docs/flywire.md untuk format & transformasinya.

   Semua koordinat dalam SATUAN SASIS fly.js (lihat FLY.BRAIN).
   ========================================================== */
(function (global) {
  'use strict';

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ==========================================================
     TABEL WILAYAH NEUROPIL
     Singkatan mengikuti tata nama baku otak serangga (Ito dkk. 2014)
     yang juga dipakai FlyWire/Codex.
     bentuk: elipsoid [rx,ry,rz] | tabung (daftar titik)
     ========================================================== */
  const NEUROPIL = [
    // ---------- lobus optik (berpasangan, lateral) ----------
    { id: 'np-lamina',  abbr: 'LA',  warna: 0x4dd0e1, sisi: true,
      pos: [0.70, 0.16, 2.66], r: [0.085, 0.34, 0.26] },
    { id: 'np-medula',  abbr: 'ME',  warna: 0x29b6f6, sisi: true,
      pos: [0.56, 0.14, 2.64], r: [0.115, 0.36, 0.285] },
    { id: 'np-lobula',  abbr: 'LO',  warna: 0x5c6bc0, sisi: true,
      pos: [0.42, 0.05, 2.74], r: [0.085, 0.22, 0.155] },
    { id: 'np-lobula-plate', abbr: 'LOP', warna: 0x7e57c2, sisi: true,
      pos: [0.42, 0.11, 2.55], r: [0.07, 0.235, 0.125] },

    // ---------- penciuman ----------
    { id: 'np-lobus-antena', abbr: 'AL', warna: 0x66bb6a, sisi: true,
      pos: [0.15, -0.07, 2.86], r: [0.10, 0.09, 0.09] },
    { id: 'np-tanduk-lateral', abbr: 'LH', warna: 0x9ccc65, sisi: true,
      pos: [0.30, 0.28, 2.74], r: [0.09, 0.08, 0.08] },

    // ---------- badan jamur ----------
    { id: 'np-mb-kaliks', abbr: 'CA', warna: 0xffa726, sisi: true,
      pos: [0.19, 0.26, 2.45], r: [0.09, 0.09, 0.075] },
    { id: 'np-mb-pedunkulus', abbr: 'PED', warna: 0xffb74d, sisi: true,
      tube: [[0.19, 0.24, 2.47], [0.17, 0.18, 2.64], [0.15, 0.12, 2.80]], tr: 0.028 },
    { id: 'np-mb-lobus', abbr: 'MBL', warna: 0xff8a65, sisi: true,
      tube: [[0.145, 0.12, 2.81], [0.14, 0.24, 2.83], [0.135, 0.34, 2.84]], tr: 0.030,
      tube2: [[0.15, 0.115, 2.82], [0.10, 0.105, 2.83], [0.04, 0.10, 2.84]], tr2: 0.028 },

    // ---------- kompleks sentral (garis tengah) ----------
    { id: 'np-badan-kipas', abbr: 'FB', warna: 0xf06292, sisi: false,
      pos: [0, 0.18, 2.62], r: [0.17, 0.085, 0.055] },
    { id: 'np-badan-elipsoid', abbr: 'EB', warna: 0xec407a, sisi: false,
      pos: [0, 0.055, 2.70], r: [0.095, 0.085, 0.048] },
    { id: 'np-jembatan-protoserebral', abbr: 'PB', warna: 0xba68c8, sisi: false,
      tube: [[-0.22, 0.27, 2.47], [0, 0.30, 2.45], [0.22, 0.27, 2.47]], tr: 0.026 },
    { id: 'np-noduli', abbr: 'NO', warna: 0xce93d8, sisi: true,
      pos: [0.065, -0.02, 2.60], r: [0.038, 0.038, 0.034] },

    // ---------- lain-lain ----------
    { id: 'np-aotu', abbr: 'AOTU', warna: 0x4db6ac, sisi: true,
      pos: [0.22, 0.28, 2.84], r: [0.055, 0.055, 0.045] },
    { id: 'np-gng', abbr: 'GNG', warna: 0x8d6e63, sisi: false,
      pos: [0, -0.30, 2.60], r: [0.22, 0.16, 0.20] }
  ];

  const PARTS = [];
  let MAT = null;

  function material(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex, roughness: .62, metalness: .02,
      transparent: true, opacity: .34, side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function reg(obj, id, opts) {
    const o = opts || {};
    const info = ANATOMI.PARTS[id] || null;
    obj.userData.partId = id;
    obj.userData.info = info;
    obj.userData.layer = 'connectome';
    obj.userData.explode = o.explode ? V3(o.explode[0], o.explode[1], o.explode[2]) : null;
    obj.userData.label = !!o.label;
    obj.userData.home = obj.position.clone();
    PARTS.push(obj);
    return obj;
  }

  function ellipsoid(pos, r, mat) {
    const g = new THREE.SphereGeometry(1, 20, 14);
    g.scale(r[0], r[1], r[2]);
    g.translate(pos[0], pos[1], pos[2]);
    return new THREE.Mesh(g, mat);
  }

  function tubeOf(pts, rad, mat) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], p[1], p[2])), false, 'catmullrom', 0.5);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 34, rad, 10, false), mat);
  }

  /* ---------- bangun satu wilayah (kiri+kanan bila berpasangan) ---------- */
  function buildRegion(def, label) {
    const g = new THREE.Group();
    const mat = material(def.warna);
    const sides = def.sisi ? [-1, 1] : [1];

    sides.forEach(sd => {
      if (def.tube) {
        g.add(tubeOf(def.tube.map(p => [p[0] * sd, p[1], p[2]]), def.tr, mat));
        if (def.tube2) g.add(tubeOf(def.tube2.map(p => [p[0] * sd, p[1], p[2]]), def.tr2, mat));
      } else {
        g.add(ellipsoid([def.pos[0] * sd, def.pos[1], def.pos[2]], def.r, mat));
      }
    });

    // arah pembongkaran: menjauh dari garis tengah otak
    const ex = def.sisi ? [0, 1.1, 0.5] : [0, 1.4, 0.2];
    return reg(g, def.id, { label: label, explode: ex });
  }

  /* ==========================================================
     API
     ========================================================== */

  /** Bangun lapisan skematis. Mengembalikan { group, parts, mode }. */
  function build() {
    PARTS.length = 0;
    const root = new THREE.Group();
    root.name = 'konektom';

    const berlabel = { 'np-medula': 1, 'np-lobus-antena': 1, 'np-mb-kaliks': 1, 'np-badan-kipas': 1 };
    NEUROPIL.forEach(def => root.add(buildRegion(def, !!berlabel[def.id])));

    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    PARTS.forEach(p => {
      box.setFromObject(p);
      p.userData.anchor = p.worldToLocal(box.getCenter(new THREE.Vector3()));
    });

    return { group: root, parts: PARTS.slice(), mode: 'skematis' };
  }

  /**
   * Coba muat mesh neuropil FlyWire yang sudah diubah ke satuan sasis.
   * Gagal dengan tenang (mis. dibuka lewat file://, atau berkas belum ada)
   * sehingga bentuk skematis tetap dipakai.
   *
   * Format data/neuropil.json - lihat docs/flywire.md:
   *   { source, generated, space:"chassis",
   *     regions:[ { id, abbr, nama, side, color, positions:[...], indices:[...] } ] }
   */
  function loadReal(url, onDone) {
    if (typeof fetch !== 'function') { onDone(null); return; }
    fetch(url, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(d => {
        if (!d || !Array.isArray(d.regions) || !d.regions.length) throw new Error('kosong');
        if (d.space !== 'chassis') throw new Error('ruang koordinat bukan "chassis"');

        PARTS.length = 0;
        const root = new THREE.Group();
        root.name = 'konektom-flywire';
        const byId = {};

        d.regions.forEach(rg => {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(rg.positions, 3));
          if (rg.indices && rg.indices.length) g.setIndex(rg.indices);
          g.computeVertexNormals();
          const mesh = new THREE.Mesh(g, material(new THREE.Color(rg.color || '#8ab4f8').getHex()));

          // gabungkan kiri & kanan di bawah satu id bila ada
          const id = rg.id;
          if (!byId[id]) { byId[id] = new THREE.Group(); root.add(byId[id]); }
          byId[id].add(mesh);
        });

        Object.keys(byId).forEach(id => {
          reg(byId[id], id, { label: false, explode: [0, 1.1, 0.4] });
        });

        root.updateMatrixWorld(true);
        const box = new THREE.Box3();
        PARTS.forEach(p => {
          box.setFromObject(p);
          p.userData.anchor = p.worldToLocal(box.getCenter(new THREE.Vector3()));
        });

        onDone({ group: root, parts: PARTS.slice(), mode: 'flywire', meta: d });
      })
      .catch(() => onDone(null));
  }

  global.CONNECTOME = { build: build, loadReal: loadReal, NEUROPIL: NEUROPIL };
})(window);
