/* ==========================================================
   fly.js - membangun model 3D Drosophila melanogaster (lalat buah)
   secara prosedural.

   SISTEM KOORDINAT
     +X = sisi kanan lalat      +Y = dorsal (punggung)
     +Z = anterior (kepala)     tanah pada y = GROUND

   Geometri dibangun dalam "satuan sasis" lalu seluruh root diskalakan
   dengan SPEC.scale sehingga 1 satuan DUNIA = 1 milimeter. Memisahkan
   keduanya membuat proporsi mudah disetel tanpa menyentuh ratusan
   koordinat literal.

   Semua geometri tubuh dipanggang (baked) pada koordinat sasis akhir
   sehingga mesh berada di posisi (0,0,0); ini memudahkan animasi
   "explode" (cukup menggeser mesh.position dari nol).

   Model mengacu pada BETINA - konektom FlyWire juga berasal dari
   otak Drosophila betina dewasa.
   ========================================================== */
(function (global) {
  'use strict';

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const GROUND = -2.42;
  const EXPLODE_K = 0.58;    // peredam jarak pembongkaran agar diagram tetap terbaca

  /* ==========================================================
     SPESIFIKASI SPESIES - Drosophila melanogaster betina
     ========================================================== */
  const SPEC = {
    // sasis panjang ~6,76 satuan; 6,76 x 0,37 = 2,5 mm (panjang tubuh betina)
    scale: 0.37,
    ommatidiaPerEye: 780,    // literatur: ~750-800 (bandingkan Musca ~4.000)
    wingbeatHz: 200,
    brainNeurons: 139255     // FlyWire v783, seluruh otak
  };

  /* Kerangka acuan otak - dipakai untuk mendudukkan mesh neuropil FlyWire.
     Koordinat FlyWire/FAFB dalam NANOMETER. Rumus pemetaan:
        sasis = (nm * 1e-6 - brainCenterMm) / SPEC.scale + BRAIN.center
     dengan brainCenterMm = titik tengah kotak pembatas otak dalam mm. */
  const BRAIN = {
    center: V3(0, 0.16, 2.62),   // pusat otak dalam satuan sasis
    widthMm: 0.60,               // rentang mediolateral otak sungguhan
    heightMm: 0.34,
    depthMm: 0.20
  };

  const PARTS = [];          // semua objek yang bisa dipilih
  let MAT = {};              // kumpulan material

  /* Posisi & arah tiap omatidium, diisi saat mata dibangun.
     Dipakai js/neurons.js untuk menarik akson fotoreseptor dari faset
     yang benar menuju kartrid lamina pasangannya (peta retinotopik). */
  const OMMATIDIA = { r: [], l: [] };

  /* ==========================================================
     UTILITAS GEOMETRI
     ========================================================== */

  /** Profil lathe dari titik kontrol [zAksial, radius] -> Vector2(radius, tinggi) */
  function profile(pts, n) {
    const curve = new THREE.CatmullRomCurve3(
      pts.map(p => V3(p[0], p[1], 0)), false, 'catmullrom', 0.5
    );
    return curve.getPoints(n || 60).map(v => new THREE.Vector2(Math.max(v.y, 0.0012), v.x));
  }

  /**
   * Badan putar sepanjang sumbu Z.
   * opts: { seg, sx, sy, phiStart, phiLength, shift:[x,y] }
   */
  function lathe(pts, opts) {
    const o = opts || {};
    const g = new THREE.LatheGeometry(
      profile(pts, o.profSeg || 64),
      o.seg || 64,
      o.phiStart || 0,
      o.phiLength || Math.PI * 2
    );
    g.rotateX(Math.PI / 2);                       // sumbu lathe Y -> Z
    g.scale(o.sx != null ? o.sx : 1, o.sy != null ? o.sy : 1, 1);
    if (o.shift) g.translate(o.shift[0], o.shift[1], 0);
    g.computeVertexNormals();
    return g;
  }

  /** Klon tekstur untuk lathe parsial agar UV tetap sejajar badan utama. */
  function subTex(t, phiStart, phiLength) {
    if (!t) return t;
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(phiLength / (Math.PI * 2), t.repeat.y);
    c.offset.set(phiStart / (Math.PI * 2), 0);
    return c;
  }

  /** Silinder meruncing antara dua titik. */
  function link(a, b, r1, r2, mat, seg) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(dir.length(), 1e-5);
    const g = new THREE.CylinderGeometry(r2, r1, len, seg || 12, 1, false);
    g.translate(0, len / 2, 0);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
    return m;
  }

  /** Bola/elipsoid pada posisi tertentu. */
  function blob(pos, rx, ry, rz, mat, seg) {
    const g = new THREE.SphereGeometry(1, seg || 24, (seg || 24) / 2);
    g.scale(rx, ry, rz);
    g.translate(pos[0], pos[1], pos[2]);
    return new THREE.Mesh(g, mat);
  }

  /** Tabung mengikuti kurva melalui daftar titik. */
  function tube(pts, r, mat, tSeg, rSeg) {
    const curve = new THREE.CatmullRomCurve3(
      pts.map(p => (p.isVector3 ? p : V3(p[0], p[1], p[2]))), false, 'catmullrom', 0.5
    );
    const g = new THREE.TubeGeometry(curve, tSeg || Math.max(16, pts.length * 6), r, rSeg || 8, false);
    return new THREE.Mesh(g, mat);
  }

  /** Sendi bulat kecil. */
  function joint(pos, r, mat) { return blob([pos.x, pos.y, pos.z], r, r, r, mat, 12); }

  /**
   * Makrokaeta: bulu besar bernama. Pada Drosophila jumlah & letaknya
   * tetap dan simetris - dipakai sebagai penanda baku dalam taksonomi
   * maupun biologi perkembangan.
   * pos = pangkal, dir = arah tumbuh, len = panjang (satuan sasis)
   */
  function bristle(pos, dir, len, rBase) {
    const d = (dir.isVector3 ? dir.clone() : V3(dir[0], dir[1], dir[2])).normalize();
    const a = pos.isVector3 ? pos : V3(pos[0], pos[1], pos[2]);
    const g = new THREE.Group();
    // sedikit melengkung: dua ruas
    const mid = a.clone().addScaledVector(d, len * 0.55);
    const tip = mid.clone().addScaledVector(d, len * 0.45).add(V3(0, -len * 0.10, 0));
    g.add(link(a, mid, rBase || 0.034, (rBase || 0.034) * 0.45, MAT.seta, 6));
    g.add(link(mid, tip, (rBase || 0.034) * 0.45, 0.003, MAT.seta, 5));
    g.add(blob([a.x, a.y, a.z], 0.045, 0.045, 0.045, MAT.dark, 10));   // soket
    return g;
  }

  /** Ambil titik+normal acak dari daftar geometri (sudah di ruang lalat). */
  function sampleSurface(geos, count, filter) {
    const pool = [];
    geos.forEach(g => {
      const p = g.attributes.position, n = g.attributes.normal;
      const step = Math.max(1, Math.floor(p.count / 1400));
      for (let i = 0; i < p.count; i += step) {
        const pos = V3(p.getX(i), p.getY(i), p.getZ(i));
        const nrm = V3(n.getX(i), n.getY(i), n.getZ(i)).normalize();
        if (!filter || filter(pos, nrm)) pool.push({ p: pos, n: nrm });
      }
    });
    const out = [];
    for (let i = 0; i < count && pool.length; i++) {
      out.push(pool[Math.floor(TEX.rnd() * pool.length)]);
    }
    return out;
  }

  /** Bangun InstancedMesh seta/bulu dari daftar titik+normal. */
  function setaeMesh(samples, mat, len, rad, jitter) {
    const g = new THREE.ConeGeometry(rad, len, 5, 1, false);
    g.translate(0, len / 2, 0);
    const im = new THREE.InstancedMesh(g, mat, samples.length);
    const d = new THREE.Object3D();
    const up = V3(0, 1, 0);
    samples.forEach((s, i) => {
      d.position.copy(s.p);
      const n = s.n.clone();
      n.x += (TEX.rnd() - .5) * (jitter || .5);
      n.y += (TEX.rnd() - .5) * (jitter || .5) * .4;
      n.z += (TEX.rnd() - .5) * (jitter || .5);
      n.normalize();
      d.quaternion.setFromUnitVectors(up, n);
      const k = 0.55 + TEX.rnd() * 0.95;
      d.scale.set(1, k, 1);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    return im;
  }

  /* ==========================================================
     REGISTRASI BAGIAN (agar bisa diklik / dilabeli / dibedah)
     ========================================================== */
  function reg(obj, id, opts) {
    const o = opts || {};
    const info = ANATOMI.PARTS[id];
    obj.userData.partId = id;
    obj.userData.info = info || null;
    obj.userData.layer = o.layer || (info && info.layer) || 'exo';
    obj.userData.explode = o.explode
      ? V3(o.explode[0] * EXPLODE_K, o.explode[1] * EXPLODE_K, o.explode[2] * EXPLODE_K)
      : null;
    obj.userData.label = !!o.label;
    obj.userData.home = obj.position.clone();
    PARTS.push(obj);
    return obj;
  }

  /* ==========================================================
     MATERIAL
     ========================================================== */
  function buildMaterials() {
    const bump = TEX.bump(5);

    const chit = c => new THREE.MeshStandardMaterial({
      color: c || 0xffffff, roughness: .42, metalness: .30,
      bumpMap: bump, bumpScale: .012
    });

    MAT = {};

    MAT.thorax = chit(); MAT.thorax.map = TEX.thorax();
    MAT.abdomen = chit(); MAT.abdomen.map = TEX.abdomen(); MAT.abdomen.roughness = .5; MAT.abdomen.metalness = .2;
    // warna dibawa oleh peta tekstur; color dibiarkan putih agar tidak berlipat gelap
    MAT.head = chit(); MAT.head.map = TEX.chitin('#6b5638');
    MAT.dark = chit(); MAT.dark.map = TEX.chitin('#3a2e1c'); MAT.dark.roughness = .5;
    MAT.plate = chit(); MAT.plate.map = TEX.chitin('#5a4830');
    MAT.pale = chit(0xe0d3ae); MAT.pale.roughness = .55;   // halter & kaliptra pucat

    MAT.eyeBase = new THREE.MeshStandardMaterial({
      map: TEX.eye(), color: 0xffffff, roughness: .35, metalness: .15
    });
    MAT.omma = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: .15, metalness: .20, envMapIntensity: 1.5
    });
    MAT.ocellus = new THREE.MeshStandardMaterial({ color: 0xf0d8a0, roughness: .06, metalness: .5 });

    MAT.wing = new THREE.MeshStandardMaterial({
      map: TEX.wing(), color: 0xffffff, roughness: .18, metalness: .0,
      envMapIntensity: 2.1, emissive: 0x16232b, emissiveIntensity: 1,
      transparent: true, opacity: .27, side: THREE.DoubleSide, depthWrite: false
    });
    MAT.vein = new THREE.MeshStandardMaterial({ color: 0x7a6748, roughness: .45, metalness: .25 });
    MAT.veinMain = new THREE.MeshStandardMaterial({ color: 0x5c4a2f, roughness: .40, metalness: .3 });
    MAT.veinKey = new THREE.MeshStandardMaterial({
      color: 0xe0913a, roughness: .35, metalness: .3,
      emissive: 0x2a1600, emissiveIntensity: 1
    });

    MAT.cell = new THREE.MeshBasicMaterial({
      color: 0x4fd1c5, transparent: true, opacity: .13, side: THREE.DoubleSide, depthWrite: false
    });

    MAT.leg = chit(); MAT.leg.map = TEX.chitin('#8a7146');    // tungkai kuning pucat
    MAT.legDark = chit(0x5a4828);
    MAT.claw = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: .3, metalness: .5 });
    MAT.pulv = new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: .78, metalness: .02 });

    MAT.seta = new THREE.MeshStandardMaterial({
      color: 0x241a0e, roughness: .78, metalness: .05, envMapIntensity: .30
    });

    MAT.soft = new THREE.MeshStandardMaterial({
      map: TEX.labellum(), color: 0xb9a690, roughness: .78, metalness: .02, envMapIntensity: .5
    });
    MAT.spiracle = new THREE.MeshStandardMaterial({ color: 0x0d0f13, roughness: .55, metalness: .2 });

    // ---- organ dalam (semi transparan) ----
    const organ = (c, op, rough) => new THREE.MeshStandardMaterial({
      color: c, roughness: rough != null ? rough : .55, metalness: .03,
      transparent: true, opacity: op != null ? op : .92,
      side: THREE.DoubleSide
    });
    MAT.muscleDLM = organ(0xd04a62, .95, .62);
    MAT.muscleDVM = organ(0x9c3450, .95, .62);
    MAT.muscleDir = organ(0xf593a8, .95, .55);
    MAT.gut = organ(0x9c7a22, .86);          // usus  - zaitun keemasan
    MAT.crop = organ(0xd9a83e, .84);         // tembolok - kuning madu
    MAT.malpighi = organ(0xdfe07a, .92, .45);// tubulus - kuning hijau
    MAT.ovary = organ(0xc9b96a, .82);
    MAT.heart = organ(0xd8543c, .92);
    MAT.gland = organ(0x86c4a6, .88);
    MAT.fat = organ(0xf2ead6, .32, .88);
    MAT.brain = organ(0x9f86ee, .95, .5);
    MAT.nerve = organ(0xc0a8ff, .95, .5);
    MAT.trachea = organ(0xa8d4ff, .48, .32);

    return MAT;
  }

  /* ==========================================================
     1. TORAKS
     ========================================================== */
  function buildThorax(root) {
    const g = new THREE.Group(); g.name = 'toraks'; root.add(g);

    // --- badan utama (mesotoraks membengkak) ---
    const prof = [
      [2.24, 0.02], [2.18, 0.34], [2.06, 0.62], [1.88, 0.83],
      [1.62, 0.97], [1.30, 1.05], [0.98, 1.05], [0.72, 0.97],
      [0.52, 0.80], [0.40, 0.52], [0.34, 0.20], [0.30, 0.02]
    ];
    const gt = lathe(prof, { sx: 1.0, sy: 1.06, seg: 72 });
    const mThorax = new THREE.Mesh(gt, MAT.thorax);
    g.add(reg(mThorax, 'toraks', { label: true }));

    // --- skutum: cangkang punggung tipis dengan 4 garis ---
    const phiS = Math.PI - 1.55, phiL = 3.10;
    const gs = lathe(prof.map(p => [p[0], p[1] * 1.035]), {
      sx: 1.0, sy: 1.06, seg: 56, phiStart: phiS, phiLength: phiL
    });
    const matScutum = MAT.thorax.clone();
    matScutum.map = subTex(MAT.thorax.map, phiS, phiL);
    matScutum.side = THREE.DoubleSide;
    const mScutum = new THREE.Mesh(gs, matScutum);
    g.add(reg(mScutum, 'skutum', { label: true, explode: [0, 1.5, .25] }));

    // --- skutelum ---
    const gsc = new THREE.SphereGeometry(1, 28, 18);
    gsc.scale(0.60, 0.36, 0.44);
    gsc.translate(0, 0.60, 0.42);
    const mSc = new THREE.Mesh(gsc, MAT.thorax);
    g.add(reg(mSc, 'skutelum', { label: true, explode: [0, 1.1, -.9] }));

    // --- pleuron (pelat sisi) ---
    [-1, 1].forEach(s => {
      const gp = new THREE.SphereGeometry(1, 20, 14);
      gp.scale(0.20, 0.52, 0.72);
      gp.translate(s * 0.92, -0.26, 1.18);
      g.add(reg(new THREE.Mesh(gp, MAT.plate), 'pleuron', { explode: [s * 1.2, -.2, 0] }));
    });

    // --- leher (serviks) ---
    const neck = lathe([[2.30, 0.02], [2.26, 0.30], [2.16, 0.36], [2.05, 0.30], [2.00, 0.03]],
      { sx: 1, sy: .92, seg: 24 });
    g.add(new THREE.Mesh(neck, MAT.dark));

    // --- spirakel toraks (2 pasang) ---
    [[1.72, 'mesotorakal'], [0.62, 'metatorakal']].forEach(sp => {
      [-1, 1].forEach(s => {
        const gg = new THREE.SphereGeometry(1, 14, 10);
        gg.scale(0.055, 0.095, 0.13);
        gg.translate(s * 0.99, -0.34, sp[0]);
        g.add(reg(new THREE.Mesh(gg, MAT.spiracle), 'spirakel-toraks', { explode: [s * .9, 0, 0] }));
      });
    });

    return { group: g, geo: gt };
  }

  /* ==========================================================
     2. ABDOMEN
     ========================================================== */
  function buildAbdomen(root) {
    const g = new THREE.Group(); g.name = 'abdomen'; root.add(g);

    const prof = [
      [0.46, 0.02], [0.42, 0.62], [0.30, 0.92], [0.05, 1.10],
      [-0.45, 1.19], [-1.00, 1.21], [-1.55, 1.15], [-2.05, 1.01],
      [-2.50, 0.84], [-2.90, 0.62], [-3.20, 0.38], [-3.42, 0.02]
    ];
    const ga = lathe(prof, { sx: 1.0, sy: 0.86, seg: 72 });
    const mAbd = new THREE.Mesh(ga, MAT.abdomen);
    g.add(reg(mAbd, 'abdomen', { label: true, explode: [0, 0, -.5] }));

    // --- 5 tergit (pelat punggung) yang saling menumpuk ---
    // radius badan pada posisi z tertentu (dipakai tergit & sternit)
    const rAt = z => {
      for (let k = 0; k < prof.length - 1; k++) {
        const a = prof[k], b = prof[k + 1];
        if (z <= a[0] && z >= b[0]) {
          const t = (a[0] - z) / (a[0] - b[0] || 1);
          return a[1] + (b[1] - a[1]) * t;
        }
      }
      return 0.30;
    };

    const segZ = [[0.40, -0.30], [-0.25, -1.05], [-1.00, -1.80], [-1.75, -2.50], [-2.45, -3.15]];
    const phiS = Math.PI - 1.62, phiL = 3.24;
    segZ.forEach((sz, i) => {
      const pts = [[sz[0], rAt(sz[0]) * 1.028], [(sz[0] + sz[1]) / 2, rAt((sz[0] + sz[1]) / 2) * 1.024],
                   [sz[1], rAt(sz[1]) * 1.006]];
      const gg = lathe(pts, { sx: 1.0, sy: 0.86, seg: 56, phiStart: phiS, phiLength: phiL, profSeg: 18 });
      const mm = MAT.abdomen.clone();
      mm.map = subTex(MAT.abdomen.map, phiS, phiL);
      mm.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(gg, mm);
      g.add(reg(mesh, 'tergit', { label: i === 1, explode: [0, 1.0, -0.35 * (i + 1)] }));
    });

    // --- sternit (pelat perut) ---
    const phiSv = -0.85, phiLv = 1.70;
    segZ.forEach((sz, i) => {
      const pts = [[sz[0], rAt(sz[0]) * 1.012], [(sz[0] + sz[1]) / 2, rAt((sz[0] + sz[1]) / 2) * 1.008],
                   [sz[1], rAt(sz[1]) * 0.996]];
      const gg = lathe(pts, { sx: 1.0, sy: 0.86, seg: 40, phiStart: phiSv, phiLength: phiLv, profSeg: 14 });
      const mm = MAT.abdomen.clone();
      mm.map = subTex(MAT.abdomen.map, phiSv, phiLv);
      mm.side = THREE.DoubleSide;
      g.add(reg(new THREE.Mesh(gg, mm), 'sternit', { explode: [0, -1.0, -0.3 * (i + 1)] }));
    });

    // --- spirakel abdomen (7 pasang) ---
    for (let i = 0; i < 7; i++) {
      const z = 0.10 - i * 0.50;
      const r = 1.10 - i * 0.08;
      [-1, 1].forEach(s => {
        const gg = new THREE.SphereGeometry(1, 12, 8);
        gg.scale(0.05, 0.075, 0.10);
        gg.translate(s * r * 0.97, -0.42, z);
        g.add(reg(new THREE.Mesh(gg, MAT.spiracle), 'spirakel-abdomen',
          { label: i === 2, explode: [s * 1.0, -.1, 0] }));
      });
    }

    // --- ovipositor teleskopik ---
    const ov = lathe([[-3.20, 0.30], [-3.42, 0.22], [-3.62, 0.15], [-3.78, 0.02]],
      { sx: 1, sy: .9, seg: 24 });
    g.add(reg(new THREE.Mesh(ov, MAT.dark), 'ovipositor', { label: true, explode: [0, 0, -1.6] }));

    return { group: g, geo: ga };
  }

  /* ==========================================================
     3. KEPALA
     ========================================================== */
  const HEAD = { x: 0, y: 0.16, z: 2.74 };

  function buildHead(root) {
    const g = new THREE.Group(); g.name = 'kepala'; root.add(g);

    // --- kapsul kepala ---
    const gh = new THREE.SphereGeometry(1, 40, 28);
    gh.scale(0.46, 0.78, 0.60);
    gh.translate(HEAD.x, HEAD.y, HEAD.z);
    const mHead = new THREE.Mesh(gh, MAT.head);
    g.add(reg(mHead, 'caput', { label: true, explode: [0, .2, 1.5] }));

    // --- dahi / frons (betina: lebar) ---
    const gf = new THREE.SphereGeometry(1, 24, 16);
    gf.scale(0.30, 0.46, 0.20);
    gf.translate(HEAD.x, HEAD.y + 0.30, HEAD.z + 0.44);
    const mf = new THREE.Mesh(gf, MAT.dark);
    g.add(reg(mf, 'frons', { label: true, explode: [0, .6, 1.2] }));

    // --- mata majemuk + omatidia ---
    [-1, 1].forEach(s => {
      /* Lebar kepala = 2 x (0,58 + 0,50) = 2,16 satuan sasis = 0,80 mm,
         sesuai literatur. Ukuran ini juga memastikan lobus optik otak
         FlyWire (lebar 0,81 mm) benar-benar terbungkus di dalam retina. */
      const cen = [s * 0.58, HEAD.y + 0.05, HEAD.z - 0.02];
      const rx = 0.50, ry = 0.76, rz = 0.64;

      const ge = new THREE.SphereGeometry(1, 36, 26);
      ge.scale(rx * 0.955, ry * 0.955, rz * 0.955);
      ge.translate(cen[0], cen[1], cen[2]);
      const eye = new THREE.Mesh(ge, MAT.eyeBase);
      g.add(reg(eye, 'mata-majemuk', { label: s > 0, explode: [s * 1.25, .1, .1] }));

      g.add(reg(buildOmmatidia(s, cen, rx, ry, rz), 'omatidium',
        { layer: 'eye', explode: [s * 1.25, .1, .1] }));
    });

    // --- oselus (3 mata tunggal di vertex) ---
    const oc = new THREE.Group();
    [[0, 0.92, 2.42], [-0.15, 0.86, 2.34], [0.15, 0.86, 2.34]].forEach(p => {
      oc.add(blob([p[0], p[1], p[2]], 0.055, 0.045, 0.055, MAT.ocellus, 12));
    });
    g.add(reg(oc, 'oselus', { label: true, explode: [0, 1.2, .3] }));

    // --- antena ---
    [-1, 1].forEach(s => g.add(buildAntenna(s)));

    // --- probosis ---
    g.add(buildProboscis());

    // --- palpus maksila ---
    [-1, 1].forEach(s => {
      const p = new THREE.Group();
      const a = V3(s * 0.17, -0.52, HEAD.z + 0.30);
      const b = V3(s * 0.21, -0.92, HEAD.z + 0.34);
      p.add(link(a, b, 0.045, 0.075, MAT.dark, 10));
      p.add(joint(b, 0.075, MAT.dark));
      g.add(reg(p, 'palpus', { explode: [s * .8, -.6, .8] }));
    });

    return { group: g, geo: gh };
  }

  /* ---------- omatidia: InstancedMesh ribuan lensa ---------- */
  /** Titik Fibonacci pada bola satuan, dipangkas ke bagian mata yang terlihat. */
  function eyePoints(N, side) {
    const pts = [];
    const ga = Math.PI * (3 - Math.sqrt(5));            // sudut emas
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = ga * i;
      const p = V3(Math.cos(th) * r, y, Math.sin(th) * r);
      // buang sisi dalam yang menempel kapsul kepala & bagian bawah
      if (p.x * side < -0.48) continue;
      if (p.y < -0.86) continue;
      pts.push(p);
    }
    return pts;
  }

  function buildOmmatidia(side, cen, rx, ry, rz) {
    /* Cari N sedemikian rupa sehingga setelah pemangkasan jumlah lensa
       mendekati SPEC.ommatidiaPerEye. Menyetel N (bukan membuang titik
       berlebih) menjaga kerapatan tetap seragam, sehingga kisi heksagonal
       tidak berlubang. */
    const target = SPEC.ommatidiaPerEye;
    let N = Math.round(target / 0.80), pts = eyePoints(N, side);
    for (let it = 0; it < 12 && Math.abs(pts.length - target) > 6; it++) {
      N = Math.max(40, Math.round(N * target / Math.max(pts.length, 1)));
      pts = eyePoints(N, side);
    }

    // Jari-jari lensa diturunkan dari kerapatan titik supaya heksagon
    // selalu bersinggungan berapa pun jumlah omatidia.
    const rMean = (rx + ry + rz) / 3;
    const spacing = Math.sqrt((4 * Math.PI / N) / 0.866) * rMean;
    const lens = spacing * 0.56;
    const gl = new THREE.SphereGeometry(1, 6, 4);
    const im = new THREE.InstancedMesh(gl, MAT.omma, pts.length);
    const d = new THREE.Object3D();
    const up = V3(0, 1, 0);
    const col = new THREE.Color();

    const store = OMMATIDIA[side > 0 ? 'r' : 'l'];
    pts.forEach((p, i) => {
      const pos = V3(cen[0] + p.x * rx, cen[1] + p.y * ry, cen[2] + p.z * rz);
      // normal elipsoid
      const n = V3(p.x / rx, p.y / ry, p.z / rz).normalize();
      // rekam untuk lapisan neuron: titik permukaan + arah pandang + koordinat bola
      store.push({ pos: pos.clone(), nrm: n.clone(), u: p.y, v: p.z });
      d.position.copy(pos).addScaledVector(n, lens * 0.42);
      d.quaternion.setFromUnitVectors(up, n);
      d.scale.set(lens, lens * 0.68, lens);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);

      // gradasi warna: lebih terang di depan-atas, gelap di belakang-bawah
      // Drosophila tipe liar: merah terang (drosopterin) - jauh lebih menyala
      // daripada merah kecoklatan lalat rumah.
      const t = THREE.MathUtils.clamp(0.5 + 0.5 * (p.z * 0.7 + p.y * 0.4), 0, 1);
      const band = Math.abs(p.y + 0.05) < 0.10 ? -0.06 : 0;   // pita gelap khatulistiwa
      col.setHSL(0.005 + 0.010 * t, 0.86, 0.19 + 0.22 * t + band + (TEX.rnd() - .5) * 0.035);
      im.setColorAt(i, col);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return im;
  }

  /* ---------- antena aristat 3 ruas ---------- */
  function buildAntenna(s) {
    const g = new THREE.Group();
    const x = s * 0.19;

    const a0 = V3(x, HEAD.y - 0.02, HEAD.z + 0.50);
    const a1 = V3(x, HEAD.y - 0.14, HEAD.z + 0.56);   // ujung skapus
    const a2 = V3(x, HEAD.y - 0.28, HEAD.z + 0.58);   // ujung pedisel

    const sk = link(a0, a1, 0.075, 0.085, MAT.dark, 12);
    g.add(reg(sk, 'antena', { label: s > 0, explode: [s * .7, .4, 1.1] }));
    const pd = link(a1, a2, 0.085, 0.095, MAT.dark, 12);
    g.add(reg(pd, 'antena', { explode: [s * .7, .4, 1.1] }));

    // funikulus: ruas ke-3 besar & pipih
    const gf = new THREE.SphereGeometry(1, 20, 14);
    gf.scale(0.075, 0.19, 0.115);
    gf.translate(x, HEAD.y - 0.47, HEAD.z + 0.55);
    const fun = new THREE.Mesh(gf, MAT.head);
    g.add(reg(fun, 'funikulus', { label: s > 0, explode: [s * .8, -.1, 1.3] }));

    // arista berbulu dua sisi (plumose)
    const ar = new THREE.Group();
    const base = V3(x, HEAD.y - 0.34, HEAD.z + 0.62);
    const tip = V3(x + s * 0.10, HEAD.y - 0.16, HEAD.z + 1.06);
    const mid = V3(x + s * 0.03, HEAD.y - 0.27, HEAD.z + 0.84);
    ar.add(tube([base, mid, tip], 0.014, MAT.seta, 26, 6));

    /* Arista Drosophila: ~6 cabang dorsal panjang + ~3 ventral + garpu
       di ujung. Jauh lebih jarang dan lebih panjang daripada sisir rapat
       milik Musca - salah satu pembeda cepat di bawah mikroskop. */
    const curve = new THREE.CatmullRomCurve3([base, mid, tip]);
    const cabang = [
      { t: 0.20, d: 1, L: 0.30 }, { t: 0.34, d: 1, L: 0.34 }, { t: 0.48, d: 1, L: 0.33 },
      { t: 0.62, d: 1, L: 0.29 }, { t: 0.74, d: 1, L: 0.23 }, { t: 0.85, d: 1, L: 0.16 },
      { t: 0.30, d: -1, L: 0.24 }, { t: 0.50, d: -1, L: 0.26 }, { t: 0.68, d: -1, L: 0.20 }
    ];
    cabang.forEach(c => {
      const p = curve.getPoint(c.t);
      const q = p.clone().add(V3(s * 0.05 * c.d, c.d * c.L, c.L * 0.45));
      ar.add(link(p, q, 0.011, 0.0025, MAT.seta, 5));
    });
    // garpu terminal
    [1, -1].forEach(d => {
      const q = tip.clone().add(V3(s * 0.03, d * 0.11, 0.13));
      ar.add(link(tip, q, 0.010, 0.0025, MAT.seta, 5));
    });
    g.add(reg(ar, 'arista', { label: s > 0, explode: [s * .9, .2, 1.5] }));

    return g;
  }

  /* ---------- probosis: rostrum + haustelum + labelum ---------- */
  function buildProboscis() {
    const g = new THREE.Group();
    const z = HEAD.z + 0.10;

    // rostrum (pangkal, lebar)
    const r1 = lathe([[0, 0.02], [-0.05, 0.22], [-0.22, 0.27], [-0.45, 0.22], [-0.52, 0.17]],
      { sx: 1.1, sy: 1, seg: 36 });
    r1.rotateX(-Math.PI / 2);          // sumbu Z -> -Y, probosis menggantung ke bawah
    r1.translate(0, -0.52, z);
    const mr = new THREE.Mesh(r1, MAT.head);
    g.add(reg(mr, 'probosis', { label: true, explode: [0, -1.4, .5] }));

    // haustelum (batang)
    const h = link(V3(0, -1.02, z + 0.02), V3(0, -1.46, z + 0.05), 0.17, 0.15, MAT.dark, 16);
    g.add(reg(h, 'probosis', { explode: [0, -1.4, .5] }));

    // labelum: dua cuping berdaging
    [-1, 1].forEach(s => {
      const gl = new THREE.SphereGeometry(1, 26, 18);
      gl.scale(0.165, 0.145, 0.235);
      gl.translate(s * 0.135, -1.63, z + 0.10);
      const lob = new THREE.Mesh(gl, MAT.soft);
      lob.rotation.z = -s * 0.28;
      g.add(reg(lob, 'labelum', { label: s > 0, explode: [s * .9, -1.7, .5] }));
    });

    // pseudotrakea: alur tipis di permukaan bawah cuping
    const ps = new THREE.Group();
    [-1, 1].forEach(s => {
      for (let i = 0; i < 13; i++) {
        const t = (i / 12 - 0.5);
        const a = V3(s * 0.04, -1.73, z + 0.10 + t * 0.34);
        const b = V3(s * 0.27, -1.70 + Math.abs(t) * 0.05, z + 0.10 + t * 0.40);
        ps.add(link(a, b, 0.010, 0.007, MAT.claw, 5));
      }
    });
    g.add(reg(ps, 'pseudotrakea', { explode: [0, -1.9, .5] }));

    return g;
  }

  /* ==========================================================
     4. SAYAP + HALTER + KALIPTRA
     ========================================================== */

  /* Kontur sayap dinyatakan sebagai dua fungsi tepi:
     x = jarak dari pangkal (0 .. 6,30 mm), y = posisi tali busur (+ = tepi depan). */

  /** Ubah daftar titik tepi menjadi fungsi y(x) lewat sampling kurva halus. */
  function edgeFn(pts) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], p[1], 0)), false, 'catmullrom', 0.5);
    const s = c.getPoints(240);
    return function (x) {
      if (x <= s[0].x) return s[0].y;
      for (let i = 0; i < s.length - 1; i++) {
        if (x >= s[i].x && x <= s[i + 1].x) {
          const t = (x - s[i].x) / ((s[i + 1].x - s[i].x) || 1);
          return s[i].y + (s[i + 1].y - s[i].y) * t;
        }
      }
      return s[s.length - 1].y;
    };
  }

  // Sayap Drosophila lebih membundar & relatif lebih lebar daripada Musca.
  const WING_LE = edgeFn([[0.00, 0.15], [0.60, 0.55], [1.60, 0.90], [2.80, 1.10], [4.00, 1.18],
                          [5.00, 1.10], [5.80, 0.85], [6.20, 0.45], [6.35, 0.05]]);
  const WING_TE = edgeFn([[0.00, -0.10], [0.50, -0.50], [1.20, -0.90], [2.20, -1.20], [3.40, -1.32],
                          [4.50, -1.25], [5.40, -0.95], [6.00, -0.50], [6.35, 0.05]]);

  /* Venasi Drosophila. Penamaan L1-L5 adalah konvensi baku genetika lalat;
     padanan morfologi klasiknya dicantumkan di anatomy-data.js.
     Berbeda dari Musca, urat L4 (media) TIDAK membelok tajam ke depan. */
  const VEINS = {
    'urat-kosta':    { r: 0.032, mat: 'veinMain', pts: [[0.00, 0.15], [0.60, 0.55], [1.60, 0.90], [2.80, 1.10], [4.00, 1.18], [5.00, 1.10], [5.80, 0.85], [6.20, 0.45], [6.33, 0.05]] },
    'urat-subkosta': { r: 0.015, mat: 'vein', pts: [[0.08, 0.06], [0.55, 0.34], [1.05, 0.56], [1.45, 0.72]] },
    'urat-l2':       { r: 0.019, mat: 'vein', pts: [[0.15, 0.00], [1.00, 0.35], [2.20, 0.68], [3.40, 0.92], [4.33, 1.13]] },
    'urat-l3':       { r: 0.020, mat: 'vein', pts: [[0.18, -0.06], [1.20, 0.15], [2.60, 0.38], [4.00, 0.58], [5.20, 0.72], [5.74, 0.73]] },
    'urat-l4':       { r: 0.021, mat: 'veinKey', pts: [[0.20, -0.16], [1.20, -0.22], [2.60, -0.20], [4.00, -0.09], [5.20, 0.02], [5.96, 0.12]] },
    'urat-l5':       { r: 0.019, mat: 'vein', pts: [[0.22, -0.28], [1.20, -0.55], [2.40, -0.85], [3.60, -1.08], [4.54, -1.21]] },
    'urat-anal':     { r: 0.014, mat: 'vein', pts: [[0.22, -0.36], [0.80, -0.70], [1.35, -0.95]] },
    'urat-silang':   { r: 0.015, mat: 'vein', pts: [[2.62, 0.39], [2.65, 0.10], [2.68, -0.20]] },
    'urat-silang2':  { r: 0.015, mat: 'vein', pts: [[4.02, -0.09], [3.99, -0.60], [3.95, -1.13]], alias: 'urat-silang' }
  };

  // Sel diskal: dibatasi urat silang anterior (acv), L4, urat silang posterior (pcv), dan L5.
  const DISCAL = [[2.68, -0.20], [3.35, -0.15], [4.02, -0.09], [3.99, -0.60], [3.95, -1.13],
                  [3.20, -1.02], [2.65, -0.90], [2.66, -0.55]];

  const ALULA = [[0.25, -0.30], [0.70, -0.58], [1.05, -0.85], [1.10, -0.96],
                 [0.80, -0.88], [0.48, -0.64], [0.23, -0.44]];

  /** lengkung membran: fungsi y dari (rentang, tali busur) */
  function camber(x, c) {
    const u = THREE.MathUtils.clamp(x / 6.3, 0, 1);
    const v = THREE.MathUtils.clamp((c + 1.34) / 2.54, 0, 1);
    return 0.075 * Math.sin(Math.PI * v) * (0.30 + 0.70 * u) - 0.13 * Math.pow(u, 3);
  }

  function smoothLoop(pts, n) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], p[1], 0)), true, 'catmullrom', 0.5);
    return c.getPoints(n).map(v => new THREE.Vector2(v.x, v.y));
  }

  function buildWing(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.60, 0.88, 1.06);
    pivot.rotation.y = side * 0.52;
    pivot.rotation.z = side * 0.10;
    pivot.userData.side = side;
    pivot.userData.baseZ = side * 0.10;

    const sx = side;  // geometri langsung dicerminkan, bukan lewat scale negatif

    // ---------- membran: grid halus antara tepi depan & tepi belakang ----------
    const NU = 100, NV = 26;
    const vPos = [], vUv = [], vIdx = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const x = 6.30 * (1 - Math.pow(1 - u, 1.55));        // titik lebih rapat di ujung
      const yle = WING_LE(x), yte = WING_TE(x);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        const c = yte + (yle - yte) * v;
        vPos.push(x * sx, camber(x, c), c);
        vUv.push(u, (c + 1.34) / 2.54);
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j, b = a + NV + 1;
        if (sx > 0) vIdx.push(a, b, a + 1, b, b + 1, a + 1);
        else vIdx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
    gm.setAttribute('uv', new THREE.Float32BufferAttribute(vUv, 2));
    gm.setIndex(vIdx);
    gm.computeVertexNormals();
    const membrane = new THREE.Mesh(gm, MAT.wing);
    membrane.renderOrder = 2;
    pivot.add(reg(membrane, 'sayap', { label: side > 0, explode: [side * 1.4, 1.2, 0] }));

    // ---------- urat ----------
    const mk = pts => pts.map(p => V3(p[0] * sx, camber(p[0], p[1]) + 0.012, p[1]));
    Object.keys(VEINS).forEach(k => {
      const v = VEINS[k];
      const m = tube(mk(v.pts), v.r, MAT[v.mat], Math.max(24, v.pts.length * 8), 7);
      m.renderOrder = 3;
      pivot.add(reg(m, v.alias || k, { label: (k === 'urat-l4' && side > 0) }));
    });

    // ---------- sel diskal (penanda) ----------
    const dl = smoothLoop(DISCAL.map(p => [p[0] * sx, p[1]]), 80);
    const gd = new THREE.ShapeGeometry(new THREE.Shape(dl), 1);
    gd.rotateX(Math.PI / 2);
    const pd = gd.attributes.position;
    for (let i = 0; i < pd.count; i++) pd.setY(i, camber(Math.abs(pd.getX(i)), pd.getZ(i)) + 0.02);
    gd.computeVertexNormals();
    const disc = new THREE.Mesh(gd, MAT.cell);
    disc.renderOrder = 4;
    pivot.add(reg(disc, 'sel-diskal', {}));

    // ---------- alula ----------
    const al = smoothLoop(ALULA.map(p => [p[0] * sx, p[1]]), 60);
    const gal = new THREE.ShapeGeometry(new THREE.Shape(al), 1);
    gal.rotateX(Math.PI / 2);
    const pa = gal.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setY(i, camber(Math.abs(pa.getX(i)), pa.getZ(i)) - 0.03);
    gal.computeVertexNormals();
    const alu = new THREE.Mesh(gal, MAT.wing.clone());
    alu.material.opacity = 0.42;
    alu.renderOrder = 2;
    pivot.add(reg(alu, 'alula', { explode: [side * 0.8, -0.4, -0.6] }));

    return pivot;
  }

  function buildHaltere(side) {
    const g = new THREE.Group();
    const a = V3(side * 0.60, -0.10, 0.62);
    const b = V3(side * 0.74, -0.24, 0.16);
    const c = V3(side * 0.80, -0.30, -0.14);

    g.add(link(a, b, 0.055, 0.035, MAT.pale, 10));          // skabelum
    g.add(link(b, c, 0.035, 0.045, MAT.pale, 10));          // pedisel
    const knob = blob([c.x, c.y, c.z - 0.10], 0.115, 0.105, 0.135, MAT.pale, 18);  // kapitelum
    g.add(knob);
    g.userData.side = side;
    return reg(g, 'halter', { label: side > 0, explode: [side * 1.15, -0.2, -0.5] });
  }

  function buildCalypter(side) {
    const g = new THREE.Group();
    // Drosophila termasuk Acalyptratae: kaliptra kecil & nyaris tak menutupi halter.
    [[0.02, 0.62, 0.08], [-0.07, 0.48, 0.00]].forEach((o, i) => {
      const gg = new THREE.SphereGeometry(1, 18, 12);
      gg.scale(0.055, 0.13 - i * 0.025, 0.15 - i * 0.02);
      gg.translate(side * (0.84 + o[0]), o[1] - 0.10, 0.76 + o[2]);
      const m = new THREE.Mesh(gg, MAT.wing.clone());
      m.material.opacity = 0.50;
      m.material.side = THREE.DoubleSide;
      m.renderOrder = 2;
      g.add(m);
    });
    return reg(g, 'kaliptra', { label: side > 0, explode: [side * 1.0, 0.5, -0.4] });
  }

  /* ==========================================================
     5. TUNGKAI
     ========================================================== */
  const LEG_PLAN = [
    { name: 'depan', base: [0.42, -0.72, 1.72],
      j: [[0.52, -1.02, 1.82], [0.58, -1.14, 1.88], [0.96, -1.60, 2.58], [1.16, -2.12, 3.06], [1.26, -2.28, 3.86]] },
    { name: 'tengah', base: [0.52, -0.78, 1.00],
      j: [[0.74, -1.08, 1.04], [0.82, -1.20, 1.02], [1.64, -1.52, 1.34], [2.06, -2.14, 1.02], [2.34, -2.30, 0.40]] },
    { name: 'belakang', base: [0.48, -0.72, 0.38],
      j: [[0.68, -1.02, 0.30], [0.76, -1.14, 0.24], [1.48, -1.42, -0.58], [1.88, -2.08, -1.38], [2.02, -2.30, -2.34]] }
  ];

  function buildLeg(side, idx) {
    const plan = LEG_PLAN[idx];
    const g = new THREE.Group();
    g.name = 'tungkai-' + plan.name + (side > 0 ? '-kanan' : '-kiri');

    const P = [V3(plan.base[0] * side, plan.base[1], plan.base[2])]
      .concat(plan.j.map(p => V3(p[0] * side, p[1], p[2])));

    const out = V3(side, -0.35, 0).normalize();
    const ex = [out.x * 1.35, out.y * 1.35, out.z * 1.35];

    // koksa, trokanter, femur, tibia
    const chain = [
      { id: 'koksa',     a: 0, b: 1, r: [0.146, 0.124], label: idx === 1 && side > 0 },
      { id: 'trokanter', a: 1, b: 2, r: [0.124, 0.116], label: false },
      { id: 'femur',     a: 2, b: 3, r: [0.142, 0.088], label: idx === 1 && side > 0 },
      { id: 'tibia',     a: 3, b: 4, r: [0.088, 0.062], label: idx === 1 && side > 0 }
    ];
    chain.forEach(c => {
      const m = link(P[c.a], P[c.b], c.r[0], c.r[1], MAT.leg, 14);
      g.add(reg(m, c.id, { label: c.label, explode: ex }));
      g.add(joint(P[c.b], c.r[1] * 1.08, MAT.legDark));
    });

    // --- tarsus: 5 tarsomer ---
    const tA = P[4], tB = P[5];
    const cuts = [0, 0.32, 0.51, 0.68, 0.84, 1.0];
    const tp = cuts.map(t => {
      const p = new THREE.Vector3().lerpVectors(tA, tB, t);
      p.y += 0.055 * Math.sin(Math.PI * t);
      return p;
    });
    const tars = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const r1 = 0.062 - k * 0.0062, r2 = 0.062 - (k + 1) * 0.0062;
      tars.add(link(tp[k], tp[k + 1], r1, r2, MAT.leg, 12));
      if (k < 4) tars.add(joint(tp[k + 1], r2 * 1.1, MAT.legDark));
    }
    g.add(reg(tars, 'tarsus', { label: idx === 2 && side > 0, explode: ex }));

    // --- pretarsus: cakar + pulvilus + empodium ---
    const end = tp[5];
    const fwd = new THREE.Vector3().subVectors(tp[5], tp[4]).normalize();
    const lat = V3(-fwd.z, 0, fwd.x).normalize();

    // pangkal pretarsus
    const gpre = new THREE.SphereGeometry(1, 14, 10);
    gpre.scale(0.062, 0.048, 0.062);
    gpre.translate(end.x, end.y, end.z);
    g.add(reg(new THREE.Mesh(gpre, MAT.legDark), 'pretarsus', { explode: ex }));

    const pre = new THREE.Group();
    [1, -1].forEach(d => {
      const c0 = end.clone().addScaledVector(lat, d * 0.035);
      const c1 = c0.clone().addScaledVector(fwd, 0.085).add(V3(0, -0.02, 0));
      const c2 = c1.clone().addScaledVector(fwd, 0.055).add(V3(0, -0.075, 0));
      pre.add(tube([c0, c1, c2], 0.020, MAT.claw, 14, 6));
    });
    g.add(reg(pre, 'cakar', { explode: ex }));

    const pul = new THREE.Group();
    [1, -1].forEach(d => {
      const cc = end.clone().addScaledVector(fwd, 0.075).addScaledVector(lat, d * 0.058).add(V3(0, -0.05, 0));
      const gg = new THREE.SphereGeometry(1, 16, 12);
      gg.scale(0.055, 0.030, 0.075);
      gg.translate(cc.x, cc.y, cc.z);
      pul.add(new THREE.Mesh(gg, MAT.pulv));
    });
    g.add(reg(pul, 'pulvilus', { label: idx === 2 && side > 0, explode: ex }));

    const emp = end.clone().addScaledVector(fwd, 0.10).add(V3(0, -0.055, 0));
    g.add(reg(link(end, emp, 0.016, 0.004, MAT.claw, 6), 'empodium', { explode: ex }));

    // --- duri & seta pada femur/tibia ---
    const br = new THREE.Group();
    [[2, 3], [3, 4]].forEach(seg => {
      const a = P[seg[0]], b = P[seg[1]];
      const dir = new THREE.Vector3().subVectors(b, a);
      const L = dir.length(); dir.normalize();
      const perp = V3(-dir.z, 0, dir.x).normalize();
      const n = Math.round(L * 9);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        const ang = TEX.rnd() * Math.PI * 2;
        const dv = perp.clone().multiplyScalar(Math.cos(ang))
          .add(V3(0, 1, 0).multiplyScalar(Math.sin(ang) * 0.8))
          .addScaledVector(dir, -0.35).normalize();
        const len = 0.10 + TEX.rnd() * 0.13;
        br.add(link(p, p.clone().addScaledVector(dv, len), 0.013, 0.002, MAT.seta, 4));
      }
    });
    g.add(reg(br, 'seta-tungkai', { layer: 'seta', explode: ex }));

    // Bungkus seluruh kaki dalam "pivot" di pangkal koksa (P[0]) supaya bisa
    // diayun sebagai satu batang kaku dari bahu (dipakai js/app.js &
    // js/alive.js untuk gerak kaki dari simulasi otak) - geometri di atas
    // TIDAK berubah, cuma dipindah satu level supaya posisi absolutnya
    // tetap sama persis saat pivot.rotation masih nol. Sendi individual
    // (lutut dst.) tetap statis; ini bukan rig IK penuh per-sendi.
    const pivot = new THREE.Group();
    pivot.name = g.name;
    pivot.position.copy(P[0]);
    g.position.copy(P[0]).multiplyScalar(-1);
    pivot.add(g);
    pivot.userData.side = side;
    pivot.userData.legIndex = idx;
    // gaya jalan tripod serangga: (depan+belakang sisi X) melangkah bareng
    // dengan (tengah sisi berlawanan) - lihat pemakaiannya di js/app.js.
    pivot.userData.tripod = ((idx === 1) === (side > 0)) ? 'A' : 'B';
    return pivot;
  }

  /* ==========================================================
     6. SETA TUBUH
     ========================================================== */
  function buildBodySetae(geos) {
    const g = new THREE.Group();

    // toraks + abdomen: seta panjang di dorsal & lateral
    const s1 = sampleSurface([geos.thorax], 150, (p, n) => n.y > -0.25 && p.z < 2.15);
    const s2 = sampleSurface([geos.abdomen], 190, (p, n) => n.y > -0.55);
    const s3 = sampleSurface([geos.head], 70, (p, n) => n.y > 0.1 || p.z > 3.0);

    g.add(reg(setaeMesh(s1, MAT.seta, 0.20, 0.013, 0.30), 'mikrokaeta', { layer: 'seta' }));
    g.add(reg(setaeMesh(s2, MAT.seta, 0.18, 0.012, 0.36), 'mikrokaeta', { layer: 'seta' }));
    g.add(reg(setaeMesh(s3, MAT.seta, 0.13, 0.010, 0.42), 'mikrokaeta', { layer: 'seta', label: true }));

    g.add(buildMacrochaetae());
    return g;
  }

  /**
   * Makrokaeta bernama pada kepala & toraks Drosophila.
   * Jumlah dan posisinya mengikuti pola baku spesies ini.
   */
  function buildMacrochaetae() {
    const g = new THREE.Group();
    const kepala = new THREE.Group();
    const toraks = new THREE.Group();

    // --- kepala ---
    [-1, 1].forEach(sd => {
      // oselar (sepasang, menghadap ke depan-atas dekat oselus)
      kepala.add(bristle(V3(sd * 0.11, 0.90, 2.46), V3(sd * 0.35, 0.72, 0.60), 0.62, 0.032));
      // postvertikal (menyilang di tengkuk)
      kepala.add(bristle(V3(sd * 0.13, 0.84, 2.24), V3(sd * -0.25, 0.62, -0.74), 0.52, 0.030));
      // orbital: 2 reklinat + 1 proklinat di tepi dahi
      kepala.add(bristle(V3(sd * 0.27, 0.68, 2.96), V3(sd * 0.48, 0.70, -0.52), 0.54, 0.030));
      kepala.add(bristle(V3(sd * 0.29, 0.48, 3.06), V3(sd * 0.52, 0.66, -0.54), 0.50, 0.028));
      kepala.add(bristle(V3(sd * 0.30, 0.28, 3.10), V3(sd * 0.46, 0.34, 0.82), 0.46, 0.028));
      // vibrisa (di tepi mulut)
      kepala.add(bristle(V3(sd * 0.26, -0.44, 3.02), V3(sd * 0.36, -0.44, 0.82), 0.44, 0.030));
    });
    g.add(reg(kepala, 'makrokaeta-kepala', { layer: 'seta', label: true }));

    // --- toraks ---
    [-1, 1].forEach(sd => {
      // humeral (postpronotal)
      toraks.add(bristle(V3(sd * 0.62, 0.60, 1.98), V3(sd * 0.60, 0.72, 0.34), 0.60, 0.034));
      // presutural
      toraks.add(bristle(V3(sd * 0.74, 0.62, 1.78), V3(sd * 0.68, 0.70, 0.22), 0.56, 0.032));
      // notopleural (2)
      toraks.add(bristle(V3(sd * 0.92, 0.32, 1.84), V3(sd * 0.86, 0.48, 0.18), 0.52, 0.032));
      toraks.add(bristle(V3(sd * 0.94, 0.20, 1.62), V3(sd * 0.88, 0.42, -0.20), 0.50, 0.032));
      // dorsosentral (2 pasang)
      toraks.add(bristle(V3(sd * 0.30, 1.06, 1.38), V3(sd * 0.26, 0.90, -0.34), 0.68, 0.036));
      toraks.add(bristle(V3(sd * 0.32, 1.04, 0.86), V3(sd * 0.28, 0.88, -0.38), 0.70, 0.036));
      // supraalar & postalar
      toraks.add(bristle(V3(sd * 0.76, 0.74, 1.02), V3(sd * 0.70, 0.66, -0.26), 0.58, 0.032));
      toraks.add(bristle(V3(sd * 0.70, 0.66, 0.74), V3(sd * 0.66, 0.62, -0.42), 0.54, 0.032));
      // skutelar: 1 basal + 1 apikal (total 4 dengan pasangannya)
      toraks.add(bristle(V3(sd * 0.36, 0.84, 0.48), V3(sd * 0.40, 0.68, -0.62), 0.72, 0.036));
      toraks.add(bristle(V3(sd * 0.13, 0.68, 0.06), V3(sd * 0.18, 0.44, -0.88), 0.76, 0.036));
    });
    g.add(reg(toraks, 'makrokaeta-toraks', { layer: 'seta', label: true }));

    return g;
  }

  /* ==========================================================
     7. OTOT TERBANG
     ========================================================== */
  function buildMuscles(root) {
    const g = new THREE.Group(); g.name = 'otot'; root.add(g);

    // --- DLM: 6 berkas memanjang tiap sisi ---
    const dlm = new THREE.Group();
    [-1, 1].forEach(s => {
      [0.16, 0.42, 0.66].forEach((x, i) => {
        const gg = new THREE.SphereGeometry(1, 18, 12);
        gg.scale(0.125, 0.30 - i * 0.03, 0.72);
        gg.translate(s * x, 0.38 - i * 0.05, 1.28);
        dlm.add(new THREE.Mesh(gg, MAT.muscleDLM));
      });
    });
    g.add(reg(dlm, 'otot-dlm', { label: true, explode: [0, 1.6, 0.2] }));

    // --- DVM: berkas tegak ---
    const dvm = new THREE.Group();
    [-1, 1].forEach(s => {
      [0.78, 1.25, 1.72].forEach(z => {
        const gg = new THREE.SphereGeometry(1, 16, 12);
        gg.scale(0.17, 0.52, 0.20);
        gg.translate(s * 0.60, 0.02, z);
        dvm.add(new THREE.Mesh(gg, MAT.muscleDVM));
      });
    });
    g.add(reg(dvm, 'otot-dvm', { label: true, explode: [0, -1.4, 0] }));

    // --- otot kendali langsung di pangkal sayap ---
    const dir = new THREE.Group();
    [-1, 1].forEach(s => {
      [[0.72, 0.52, 1.20], [0.80, 0.34, 0.92], [0.66, 0.58, 1.48]].forEach(p => {
        const gg = new THREE.SphereGeometry(1, 14, 10);
        gg.scale(0.085, 0.13, 0.11);
        gg.translate(s * p[0], p[1], p[2]);
        dir.add(new THREE.Mesh(gg, MAT.muscleDir));
      });
    });
    g.add(reg(dir, 'otot-kendali', { explode: [0, 1.2, 0.8] }));

    return g;
  }

  /* ==========================================================
     8. ORGAN DALAM
     ========================================================== */
  function buildInternal(root) {
    const g = new THREE.Group(); g.name = 'internal'; root.add(g);

    // --- esofagus + faring ---
    g.add(reg(tube([
      V3(0, -0.30, 3.00), V3(0, -0.18, 2.70), V3(0, -0.22, 2.20),
      V3(0, -0.26, 1.60), V3(0, -0.24, 0.90), V3(0, -0.20, 0.30)
    ], 0.055, MAT.gut, 60, 8), 'esofagus', { explode: [0, -1.1, 0] }));

    // --- tembolok (bercuping dua) ---
    const crop = new THREE.Group();
    [-1, 1].forEach(s => {
      const gg = new THREE.SphereGeometry(1, 22, 16);
      gg.scale(0.30, 0.26, 0.44);
      gg.translate(s * 0.26, -0.42, -0.78);
      crop.add(new THREE.Mesh(gg, MAT.crop));
    });
    crop.add(tube([V3(0, -0.22, 0.20), V3(0, -0.34, -0.20), V3(0, -0.40, -0.52)], 0.042, MAT.crop, 24, 7));
    g.add(reg(crop, 'tembolok', { label: true, explode: [0, -1.5, -0.3] }));

    // --- proventrikulus ---
    g.add(reg(blob([0, -0.16, 0.10], 0.115, 0.105, 0.105, MAT.gut, 18), 'proventrikulus',
      { explode: [0, -0.9, 0.4] }));

    // --- usus tengah (melingkar) ---
    const mid = [];
    for (let i = 0; i <= 44; i++) {
      const t = i / 44;
      const z = 0.02 - t * 2.15;
      const a = t * Math.PI * 3.1;
      mid.push(V3(Math.sin(a) * (0.36 - t * 0.14), -0.12 + Math.cos(a) * (0.26 - t * 0.10), z));
    }
    g.add(reg(tube(mid, 0.082, MAT.gut, 170, 9), 'usus-tengah', { label: true, explode: [0, -1.2, -0.6] }));

    // --- usus belakang + rektum ---
    g.add(reg(tube([
      V3(0.10, -0.10, -2.15), V3(0.04, 0.10, -2.50), V3(0, 0.06, -2.85)
    ], 0.070, MAT.gut, 30, 8), 'usus-belakang', { explode: [0, 0.4, -1.5] }));
    g.add(reg(blob([0, 0.00, -3.02], 0.18, 0.16, 0.20, MAT.gut, 18), 'usus-belakang',
      { explode: [0, 0.4, -1.5] }));

    // --- tubulus Malpighi (4 pipa berkelok) ---
    const mp = new THREE.Group();
    [[1, 0.9], [-1, 0.9], [1, -0.7], [-1, -0.7]].forEach((d, k) => {
      const pts = [];
      for (let i = 0; i <= 34; i++) {
        const t = i / 34;
        const z = -2.05 + t * (d[1] > 0 ? 1.60 : -0.85);
        const a = t * Math.PI * (4.4 + k * 0.6) + k;
        pts.push(V3(d[0] * (0.28 + Math.sin(a) * 0.30), 0.14 + Math.cos(a * 1.2) * 0.30, z));
      }
      mp.add(tube(pts, 0.031, MAT.malpighi, 120, 7));
    });
    g.add(reg(mp, 'malpighi', { label: true, explode: [0, 1.3, -0.4] }));

    // --- kelenjar ludah ---
    const sal = new THREE.Group();
    [-1, 1].forEach(s => {
      sal.add(tube([
        V3(s * 0.10, -0.42, 2.50), V3(s * 0.22, -0.52, 1.80),
        V3(s * 0.32, -0.55, 1.10), V3(s * 0.30, -0.50, 0.50)
      ], 0.040, MAT.gland, 46, 7));
    });
    g.add(reg(sal, 'kelenjar-ludah', { explode: [0, -1.3, 0.8] }));

    // --- ovarium (sepasang berkas ovariol) ---
    const ov = new THREE.Group();
    [-1, 1].forEach(s => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const gg = new THREE.SphereGeometry(1, 14, 10);
        gg.scale(0.085, 0.085, 0.30);
        gg.translate(s * (0.42 + Math.cos(a) * 0.17), 0.14 + Math.sin(a) * 0.20, -1.45 - (i % 3) * 0.12);
        ov.add(new THREE.Mesh(gg, MAT.ovary));
      }
    });
    g.add(reg(ov, 'ovarium', { label: true, explode: [0, 0.9, -1.0] }));

    // --- pembuluh dorsal (jantung) ---
    g.add(reg(tube([
      V3(0, 0.62, -3.05), V3(0, 0.74, -2.20), V3(0, 0.80, -1.20),
      V3(0, 0.80, -0.30), V3(0, 0.70, 0.60), V3(0, 0.55, 1.60), V3(0, 0.34, 2.45)
    ], 0.042, MAT.heart, 90, 8), 'jantung', { label: true, explode: [0, 1.8, 0] }));

    // --- badan lemak ---
    const fat = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const gg = new THREE.SphereGeometry(1, 10, 8);
      const r = 0.12 + TEX.rnd() * 0.16;
      gg.scale(r * 1.5, r, r * 1.3);
      gg.translate((TEX.rnd() - .5) * 1.5, -0.1 + (TEX.rnd() - .5) * 0.9, -0.4 - TEX.rnd() * 2.4);
      fat.add(new THREE.Mesh(gg, MAT.fat));
    }
    g.add(reg(fat, 'badan-lemak', { explode: [0, -1.5, -1.0] }));

    return g;
  }

  /* ==========================================================
     9. SISTEM SARAF
     ========================================================== */
  function buildNerves(root) {
    const g = new THREE.Group(); g.name = 'saraf'; root.add(g);

    // --- otak: serebrum sentral + 2 lobus optik besar ---
    /* Otak Drosophila mengisi sebagian besar kapsul kepala:
       ~0,60 x 0,34 x 0,20 mm. Lobus optik (kiri-kanan) sendiri menempati
       hampir separuh volumenya. Ukuran di bawah sudah disesuaikan agar
       cocok dengan kotak pembatas mesh neuropil FlyWire (lihat BRAIN). */
    const brain = new THREE.Group();
    brain.add(blob([0, 0.16, 2.66], 0.30, 0.34, 0.26, MAT.brain, 22));   // otak sentral
    [-1, 1].forEach(s => {
      const gg = new THREE.SphereGeometry(1, 22, 16);
      gg.scale(0.26, 0.44, 0.34);
      gg.translate(s * 0.52, 0.14, 2.64);                                 // lobus optik
      brain.add(new THREE.Mesh(gg, MAT.brain));
    });
    g.add(reg(brain, 'otak', { label: true, explode: [0, 1.4, 1.2] }));

    // --- ganglion subesofageal ---
    g.add(reg(blob([0, -0.32, 2.58], 0.24, 0.19, 0.22, MAT.nerve, 18), 'ganglion-subesofageal',
      { explode: [0, -1.2, 1.2] }));

    // --- tali saraf ventral ---
    g.add(reg(tube([V3(0, -0.34, 2.45), V3(0, -0.40, 2.10), V3(0, -0.42, 1.80)],
      0.045, MAT.nerve, 24, 7), 'tali-saraf', { explode: [0, -1.2, 0.6] }));

    // --- ganglion toraks (melebur) ---
    const tg = new THREE.Group();
    tg.add(blob([0, -0.38, 1.28], 0.30, 0.22, 0.46, MAT.nerve, 20));
    g.add(reg(tg, 'ganglion-toraks', { label: true, explode: [0, -1.5, 0] }));

    /* ==========================================================
       SARAF TEPI - urat saraf yang keluar dari otak & ganglion
       toraks menuju organ. Semuanya berpasangan kecuali saraf
       abdomen yang tunggal di garis tengah.
       ========================================================== */
    const GANGLION = V3(0, -0.38, 1.28);      // pusat ganglion toraks
    const OTAK = V3(0, 0.10, 2.60);           // pusat otak

    function nerve(pts, r) {
      return tube(pts, r || 0.020, MAT.nerve, Math.max(20, pts.length * 8), 7);
    }

    // --- saraf antena: antena -> lobus antena ---
    const nAnt = new THREE.Group();
    [-1, 1].forEach(sd => {
      nAnt.add(nerve([
        V3(sd * 0.19, -0.30, 3.34), V3(sd * 0.18, -0.20, 3.12),
        V3(sd * 0.16, -0.12, 2.96), V3(sd * 0.15, -0.07, 2.86)
      ], 0.024));
    });
    g.add(reg(nAnt, 'saraf-antena', { label: true, explode: [0, 0.4, 1.4] }));

    // --- saraf labial & faring: probosis -> ganglion gnatal ---
    const nLab = new THREE.Group();
    [-1, 1].forEach(sd => {
      nLab.add(nerve([
        V3(sd * 0.10, -1.60, 2.90), V3(sd * 0.09, -1.20, 2.82),
        V3(sd * 0.08, -0.80, 2.72), V3(sd * 0.05, -0.42, 2.62)
      ], 0.019));
    });
    g.add(reg(nLab, 'saraf-labial', { explode: [0, -1.4, 0.8] }));

    // --- konektif serviks: otak -> ganglion toraks (lewat leher) ---
    const nCerv = new THREE.Group();
    [-1, 1].forEach(sd => {
      nCerv.add(nerve([
        V3(sd * 0.07, -0.34, 2.46), V3(sd * 0.08, -0.40, 2.16),
        V3(sd * 0.08, -0.42, 1.80), V3(sd * 0.07, -0.40, 1.50)
      ], 0.032));
    });
    g.add(reg(nCerv, 'tali-saraf', { label: true, explode: [0, -1.0, 0.6] }));

    // --- saraf tungkai: ganglion -> pangkal tiap koksa ---
    const nLeg = new THREE.Group();
    [[0.42, -0.72, 1.72], [0.52, -0.78, 1.00], [0.48, -0.72, 0.38]].forEach(b => {
      [-1, 1].forEach(sd => {
        const tgt = V3(sd * b[0], b[1], b[2]);
        const mid = GANGLION.clone().lerp(tgt, 0.55).add(V3(0, -0.10, 0));
        nLeg.add(nerve([GANGLION.clone().add(V3(sd * 0.12, -0.08, 0)), mid, tgt], 0.021));
      });
    });
    g.add(reg(nLeg, 'saraf-tungkai', { label: true, explode: [0, -1.3, 0] }));

    // --- saraf sayap: ganglion -> pangkal sayap ---
    const nWing = new THREE.Group();
    [-1, 1].forEach(sd => {
      nWing.add(nerve([
        GANGLION.clone().add(V3(sd * 0.14, 0.10, 0.10)),
        V3(sd * 0.36, 0.10, 0.80), V3(sd * 0.52, 0.52, 1.00),
        V3(sd * 0.58, 0.82, 1.05)
      ], 0.020));
    });
    g.add(reg(nWing, 'saraf-sayap', { label: true, explode: [0, 1.3, 0.2] }));

    // --- saraf halter: pendek & tebal, jalur refleks tercepat ---
    const nHalt = new THREE.Group();
    [-1, 1].forEach(sd => {
      nHalt.add(nerve([
        GANGLION.clone().add(V3(sd * 0.14, 0.02, -0.12)),
        V3(sd * 0.38, -0.08, 0.42), V3(sd * 0.56, -0.16, 0.56)
      ], 0.023));
    });
    g.add(reg(nHalt, 'saraf-halter', { explode: [0, -0.4, -1.1] }));

    // --- saraf abdomen: ganglion -> ruas-ruas perut ---
    const nAbd = new THREE.Group();
    nAbd.add(nerve([
      V3(0, -0.40, 0.90), V3(0, -0.38, 0.40), V3(0, -0.30, -0.30),
      V3(0, -0.22, -1.10), V3(0, -0.14, -1.90), V3(0, -0.10, -2.50)
    ], 0.022));
    for (let i = 0; i < 4; i++) {
      const z = -0.20 - i * 0.60;
      [-1, 1].forEach(sd => {
        nAbd.add(nerve([
          V3(0, -0.30 + i * 0.05, z),
          V3(sd * 0.28, -0.34 + i * 0.05, z - 0.10),
          V3(sd * 0.52, -0.38 + i * 0.05, z - 0.16)
        ], 0.011));
      });
    }
    g.add(reg(nAbd, 'saraf-abdomen', { label: true, explode: [0, -1.2, -0.8] }));

    // --- neuron raksasa (giant fiber): otak -> otot lompat ---
    const nGF = new THREE.Group();
    [-1, 1].forEach(sd => {
      nGF.add(nerve([
        OTAK.clone().add(V3(sd * 0.10, -0.06, -0.14)),
        V3(sd * 0.09, -0.30, 2.20), V3(sd * 0.09, -0.36, 1.70),
        V3(sd * 0.10, -0.34, 1.32)
      ], 0.030));
    });
    g.add(reg(nGF, 'saraf-giant-fiber', { label: true, explode: [0, -0.8, 0.3] }));

    return g;
  }

  /* ==========================================================
     10. SISTEM TRAKEA
     ========================================================== */
  function buildTrachea(root) {
    const g = new THREE.Group(); g.name = 'trakea'; root.add(g);

    const trunks = new THREE.Group();
    [-1, 1].forEach(s => {
      // batang longitudinal utama
      const main = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const z = 2.30 - t * 5.40;
        main.push(V3(s * (0.72 - Math.abs(z - 0.5) * 0.045), -0.28 + Math.sin(t * 3) * 0.06, z));
      }
      trunks.add(tube(main, 0.048, MAT.trachea, 110, 8));

      // cabang ke spirakel & organ
      for (let i = 0; i < 9; i++) {
        const z = 1.75 - i * 0.52;
        const a = V3(s * 0.70, -0.30, z);
        const b = V3(s * 0.34, -0.10 + (i % 2) * 0.35, z - 0.12);
        const c = V3(s * 0.10, 0.12 + (i % 3) * 0.20, z - 0.22);
        trunks.add(tube([a, b, c], 0.020, MAT.trachea, 22, 6));
      }
    });
    g.add(reg(trunks, 'trakea', { label: true, explode: [0, 0.3, 0] }));

    // kantung udara besar di toraks & abdomen
    const sacs = new THREE.Group();
    [[0.46, 0.30, 1.30, 0.34, 0.28, 0.52], [0, 0.20, -0.60, 0.42, 0.30, 0.48],
     [0, 0.10, -1.90, 0.36, 0.26, 0.42]].forEach(s6 => {
      [-1, 1].forEach(s => {
        if (s6[0] === 0 && s > 0) return;
        const gg = new THREE.SphereGeometry(1, 16, 12);
        gg.scale(s6[3], s6[4], s6[5]);
        gg.translate(s * s6[0], s6[1], s6[2]);
        sacs.add(new THREE.Mesh(gg, MAT.trachea));
      });
    });
    g.add(reg(sacs, 'kantung-udara', { explode: [0, 1.0, 0] }));

    return g;
  }

  /* ==========================================================
     BUILD UTAMA
     ========================================================== */
  function build(onStep) {
    PARTS.length = 0;
    OMMATIDIA.r.length = 0;
    OMMATIDIA.l.length = 0;
    TEX.reseed(20260924);

    const step = onStep || function () {};

    step('menyiapkan material & tekstur');
    buildMaterials();

    const root = new THREE.Group();
    root.name = 'lalat';

    step('membangun toraks');
    const th = buildThorax(root);

    step('membangun abdomen');
    const ab = buildAbdomen(root);

    step('membangun kepala & mata majemuk');
    const hd = buildHead(root);

    step('membangun sayap & halter');
    const gW = new THREE.Group(); gW.name = 'sayap'; root.add(gW);
    const wingR = buildWing(1), wingL = buildWing(-1);
    gW.add(wingR, wingL);
    gW.add(buildHaltere(1), buildHaltere(-1));
    gW.add(buildCalypter(1), buildCalypter(-1));

    step('membangun enam tungkai');
    const gL = new THREE.Group(); gL.name = 'tungkai'; root.add(gL);
    for (let i = 0; i < 3; i++) { gL.add(buildLeg(1, i)); gL.add(buildLeg(-1, i)); }

    step('menanam seta & bulu');
    root.add(buildBodySetae({ thorax: th.geo, abdomen: ab.geo, head: hd.geo }));

    step('membangun otot terbang');
    const gMus = buildMuscles(root);

    step('membangun organ dalam');
    const gInt = buildInternal(root);

    step('membangun sistem saraf & trakea');
    const gNer = buildNerves(root);
    const gTra = buildTrachea(root);

    // lapisan internal default tersembunyi
    [gMus, gInt, gNer, gTra].forEach(x => { x.visible = false; });

    step('menghitung titik label');
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    PARTS.forEach(p => {
      box.setFromObject(p);
      const c = box.getCenter(new THREE.Vector3());
      p.userData.anchor = p.worldToLocal(c.clone());
      p.userData.anchorWorld = c.clone();
    });

    // sasis -> milimeter dunia
    root.scale.setScalar(SPEC.scale);
    root.updateMatrixWorld(true);

    return {
      root: root,
      parts: PARTS.slice(),
      wings: [wingR, wingL],
      legs: gL.children.slice(),   // 6 pivot koksa - lihat buildLeg()
      layerRoots: { muscle: gMus, internal: gInt, nerve: gNer, trachea: gTra },
      ground: GROUND * SPEC.scale,
      ommatidia: OMMATIDIA,
      scale: SPEC.scale,
      brain: BRAIN,
      spec: SPEC,
      materials: MAT
    };
  }

  global.FLY = {
    build: build,
    GROUND: GROUND * SPEC.scale,
    SCALE: SPEC.scale,
    SPEC: SPEC,
    BRAIN: BRAIN
  };
})(window);
