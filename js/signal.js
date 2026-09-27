/* ==========================================================
   signal.js - animasi sinyal di sepanjang koneksi neuron terpilih.

   MURNI ILUSTRATIF, BUKAN SIMULASI: pulsa bergerak dengan kecepatan &
   arah yang ditentukan dari kekuatan sinaps (syn_count di data/connections.json),
   bukan dari model biofisika sungguhan. Tujuannya membantu membaca arah
   sinyal (mana presinaps -> pascasinaps) yang sudah dihitung
   tools/fetch_connections.py, bukan menghitung ulang aktivitas neuron.

   Dipanggil dari js/app.js begitu satu neuron individual dipilih (lihat
   selectNeuron() di app.js) - hanya menyorot mitra yang JUGA punya
   geometri di viewer (g:1 di connections.json); mitra tanpa geometri
   tetap tampil sebagai teks saja di panel, tidak ikut dianimasikan.
   ========================================================== */
(function (global) {
  'use strict';

  let DOT_TEX = null;

  /** Bulatan lembut radial, digambar sekali di Canvas 2D - dipakai sebagai
      sprite pulsa. Konsisten dengan seluruh tekstur proyek ini: tak ada
      berkas gambar eksternal. */
  function dotTexture() {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  /** Titik wakil satu neuron: tengah cabang terpanjangnya (biasanya batang
      utama akson/dendrit) - cukup untuk titik pangkal/ujung garis sinyal,
      tak perlu presisi anatomis. */
  function repPoint(part, index) {
    const paths = part.userData.neuronRawPaths && part.userData.neuronRawPaths[index];
    if (!paths || !paths.length) return null;
    let best = paths[0];
    paths.forEach(p => { if (p.length > best.length) best = p; });
    const p = best[Math.floor(best.length / 2)].clone();
    part.updateMatrixWorld(true);
    return p.applyMatrix4(part.matrixWorld);
  }

  /**
   * Bangun visual sinyal untuk satu neuron terpilih.
   *   part, index   : objek & index neuron terpilih (dari NEURONS.locate/neuronAt)
   *   connData      : { in:[{p,w,nt,g}], out:[...] } - satu entri connections.json
   *   locate        : NEURONS.locate - root_id -> {object,index} | undefined
   *   opts.maxEach  : maksimum garis per arah (bawaan 6, biar tak ramai)
   * Balikan: { group, update(t), dispose() }. `group` ditambahkan ke scene
   * oleh pemanggil; update(t) dipanggil tiap frame dengan waktu berjalan.
   */
  function build(part, index, connData, locate, opts) {
    const o = opts || {};
    const maxEach = o.maxEach || 6;
    const group = new THREE.Group();
    group.name = 'signal';

    const selfPt = repPoint(part, index);
    const lines = [];             // { curve, dir:'in'|'out', phases:[...], speed }
    const posArr = [], colArr = [];
    const IN_COL = [0.42, 0.82, 0.95];    // cyan - sinyal MASUK (presinaps -> kita)
    const OUT_COL = [1.0, 0.71, 0.33];    // amber - sinyal KELUAR (kita -> pascasinaps)

    function addEdges(list, dir) {
      if (!selfPt) return;
      (list || []).filter(e => e.g).slice(0, maxEach).forEach(e => {
        const loc = locate(e.p);
        if (!loc) return;
        const otherPt = repPoint(loc.object, loc.index);
        if (!otherPt) return;
        const a = dir === 'out' ? selfPt : otherPt;
        const b = dir === 'out' ? otherPt : selfPt;

        // lengkungkan sedikit menjauhi pusat otak, biar tak menembus lurus
        // lewat tengah struktur lain - murni kosmetik.
        const mid = a.clone().lerp(b, 0.5);
        const away = mid.clone().normalize();
        const bow = 0.35 * Math.min(a.distanceTo(b), 0.6);
        mid.addScaledVector(away, bow);
        const curve = new THREE.CatmullRomCurve3([a, mid, b], false, 'catmullrom', 0.5);

        const pts = curve.getPoints(20);
        const c = dir === 'out' ? OUT_COL : IN_COL;
        for (let i = 0; i < pts.length - 1; i++) {
          posArr.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
          colArr.push(c[0], c[1], c[2], c[0], c[1], c[2]);
        }

        // koneksi lebih kuat (sinaps lebih banyak) -> pulsa lebih rapat & cepat
        const w = e.w || 1;
        const nPulse = 1 + Math.min(3, Math.floor(w / 10));
        const phases = [];
        for (let k = 0; k < nPulse; k++) phases.push(k / nPulse);
        lines.push({ curve, dir, phases, speed: 0.30 + Math.min(0.55, w / 50) });
      });
    }
    addEdges(connData.out, 'out');
    addEdges(connData.in, 'in');

    let staticLines = null;
    if (posArr.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false
      });
      staticLines = new THREE.LineSegments(g, mat);
      group.add(staticLines);
    }

    const totalPulses = lines.reduce((s, l) => s + l.phases.length, 0);
    let points = null;
    if (totalPulses) {
      if (!DOT_TEX) DOT_TEX = dotTexture();
      const gp = new THREE.BufferGeometry();
      gp.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(totalPulses * 3), 3));
      gp.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(totalPulses * 3), 3));
      const pm = new THREE.PointsMaterial({
        size: 0.05, map: DOT_TEX, vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
      });
      points = new THREE.Points(gp, pm);
      group.add(points);
    }

    function update(t) {
      if (!points) return;
      const pos = points.geometry.attributes.position.array;
      const col = points.geometry.attributes.color.array;
      let k = 0;
      lines.forEach(l => {
        const c = l.dir === 'out' ? OUT_COL : IN_COL;
        l.phases.forEach(ph => {
          const u = (ph + t * l.speed) % 1;
          const p = l.curve.getPointAt(Math.min(0.999, u < 0 ? u + 1 : u));
          pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
          col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
          k++;
        });
      });
      points.geometry.attributes.position.needsUpdate = true;
      points.geometry.attributes.color.needsUpdate = true;
    }

    function dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }

    return { group, update, dispose, lineCount: lines.length };
  }

  global.SIGNAL = { build: build };
})(window);
