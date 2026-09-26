/* ==========================================================
   textures.js - semua tekstur dibuat prosedural di <canvas>.
   Tidak ada file gambar eksternal sama sekali.

   Catatan pemetaan UV pada LatheGeometry yang sudah di-rotateX(PI/2):
     u = 0.00 -> ventral (bawah)
     u = 0.25 -> sisi kanan (+X)
     u = 0.50 -> dorsal (atas)   <- garis tengah punggung
     u = 0.75 -> sisi kiri (-X)
     v = 0..1 sepanjang sumbu tubuh
   ========================================================== */
(function (global) {
  'use strict';

  const TEX = {};

  /* ---------- util ---------- */
  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }

  function tex(canvas, repX, repY) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX || 1, repY || 1);
    t.anisotropy = 8;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function dataTex(canvas, repX, repY) {           // untuk bump/rough (linear, bukan sRGB)
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX || 1, repY || 1);
    t.anisotropy = 4;
    return t;
  }

  // PRNG deterministik supaya model selalu sama tiap buka
  let _seed = 20260924;
  function rnd() {
    _seed = (_seed * 1664525 + 1013904223) % 4294967296;
    return _seed / 4294967296;
  }
  TEX.rnd = rnd;
  TEX.reseed = s => { _seed = s; };

  /* ---------- bintik / noise halus ---------- */
  function speckle(ctx, w, h, n, minR, maxR, colorFn, alpha) {
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h;
      const r = minR + rnd() * (maxR - minR);
      ctx.globalAlpha = alpha * (0.4 + rnd() * 0.6);
      ctx.fillStyle = colorFn(rnd());
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ==========================================================
     1. KUTIKULA UMUM - abu gelap berkilau dengan bintik halus
     ========================================================== */
  TEX.chitin = function (base, opts) {
    const o = opts || {};
    const c = cv(512), x = c.getContext('2d');
    x.fillStyle = base || '#3a4150';
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, 2600, 0.6, 2.4, t => (t > 0.5 ? '#0e1219' : '#5c6678'), 0.22);
    // guratan kutikula tipis
    x.strokeStyle = 'rgba(255,255,255,.05)';
    x.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      x.beginPath();
      const y = rnd() * 512;
      x.moveTo(0, y);
      x.bezierCurveTo(170, y + (rnd() - .5) * 22, 340, y + (rnd() - .5) * 22, 512, y);
      x.stroke();
    }
    return tex(c, o.repX || 1, o.repY || 1);
  };

  /* ==========================================================
     2. TORAKS - cokelat kekuningan polos.
        Drosophila TIDAK punya empat garis hitam memanjang seperti
        Musca domestica; yang tampak hanyalah deret mikrokaeta
        (baris akrostikal) dan sedikit penggelapan ke arah belakang.
     ========================================================== */
  TEX.thorax = function () {
    const W = 1024, H = 512;
    const c = cv(W, H), x = c.getContext('2d');

    // dasar: cokelat kekuningan, lebih terang di punggung
    const g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.00, '#3a2c19');   // ventral
    g.addColorStop(0.25, '#6d5730');   // kanan
    g.addColorStop(0.50, '#8a6f3d');   // dorsal
    g.addColorStop(0.75, '#6d5730');   // kiri
    g.addColorStop(1.00, '#3a2c19');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // penggelapan ke arah skutelum (v besar)
    const p = x.createLinearGradient(0, 0, 0, H);
    p.addColorStop(0, 'rgba(255,236,200,.10)');
    p.addColorStop(.60, 'rgba(0,0,0,0)');
    p.addColorStop(1, 'rgba(38,26,12,.42)');
    x.fillStyle = p; x.fillRect(0, 0, W, H);

    // baris akrostikal: deretan titik mikrokaeta yang sangat halus
    x.fillStyle = 'rgba(44,32,16,.45)';
    for (let r = -4; r <= 4; r++) {
      const cxp = (0.5 + r * 0.018) * W;
      for (let i = 0; i < 30; i++) {
        const y = (i / 30) * H * 0.92 + 6;
        x.beginPath(); x.arc(cxp, y, 1.5, 0, 6.2832); x.fill();
      }
    }

    speckle(x, W, H, 3000, 0.5, 1.8, t => (t > 0.55 ? '#2a1e0e' : '#b89a62'), 0.15);
    return tex(c);
  };

  /* ==========================================================
     3. ABDOMEN - kuning pucat dengan PITA GELAP MELINTANG per ruas.
        Inilah pola betina Drosophila: tiap tergit punya pita hitam di
        tepi belakangnya, melebar ke arah punggung, dan makin pekat ke
        ujung abdomen. (Jantan berbeda: ruas belakang melebur jadi
        ujung hitam pekat.) Bandingkan Musca yang justru bergaris
        MEMBUJUR di garis tengah punggung.
     ========================================================== */
  TEX.abdomen = function () {
    const W = 1024, H = 512;
    const c = cv(W, H), x = c.getContext('2d');

    // dasar kuning pucat; sisi ventral sedikit lebih pucat
    const g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.00, '#c2a765');   // ventral
    g.addColorStop(0.22, '#c8ad68');
    g.addColorStop(0.50, '#b0904c');   // dorsal
    g.addColorStop(0.78, '#c8ad68');
    g.addColorStop(1.00, '#c2a765');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    /* Pita melintang: satu per tergit. Tinggi pita bergantung pada u
       (paling lebar di punggung, menyempit ke perut) sehingga digambar
       kolom demi kolom. */
    const RUAS = 6;
    for (let seg = 0; seg < RUAS; seg++) {
      const v0 = seg / RUAS, vh = 1 / RUAS;
      const pekat = 0.55 + 0.42 * (seg / (RUAS - 1));     // makin belakang makin hitam
      for (let px = 0; px < W; px += 2) {
        const u = px / W;
        // 1 di dorsal (u=0.5), 0 di ventral (u=0 atau 1)
        const dors = Math.max(0, 1 - Math.abs(u - 0.5) / 0.5);
        const tinggi = vh * (0.22 + 0.34 * dors);           // porsi ruas yang tertutup pita
        const yTop = (v0 + vh - tinggi) * H;
        x.fillStyle = 'rgba(26,18,8,' + (pekat * (0.35 + 0.65 * dors)).toFixed(3) + ')';
        x.fillRect(px, yTop, 2, tinggi * H);
      }
    }

    // tepi belakang tiap pita sedikit dipertegas
    x.strokeStyle = 'rgba(18,12,5,.35)';
    x.lineWidth = 2;
    for (let seg = 1; seg <= RUAS; seg++) {
      const y = (seg / RUAS) * H;
      x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
    }

    speckle(x, W, H, 3000, 0.5, 2.0, t => (t > 0.5 ? '#e0c98d' : '#2a1f0d'), 0.14);
    return tex(c);
  };

  /* ==========================================================
     4. BUMP kutikula - benjolan mikro seragam
     ========================================================== */
  TEX.bump = function (scale) {
    const c = cv(256), x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) {
      const v = Math.floor(90 + rnd() * 90);
      x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 1.9, 0, 6.2832); x.fill();
    }
    return dataTex(c, scale || 4, scale || 4);
  };

  /* ==========================================================
     5. MEMBRAN SAYAP - bening dengan kilau interferensi lembut
        (dipakai sebagai map; urat digambar terpisah sbg geometri)
        u = arah rentang (basis->ujung), v = arah tali busur
     ========================================================== */
  TEX.wing = function () {
    const W = 1024, H = 512;
    const c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = '#cfe4ea'; x.fillRect(0, 0, W, H);

    // pita warna interferensi tipis (thin-film) - miring mengikuti rentang
    const hues = [188, 205, 262, 318, 42, 160];
    for (let i = 0; i < 26; i++) {
      const hu = hues[i % hues.length];
      const gx = (i / 26) * W * 1.25 - W * 0.12;
      const g = x.createLinearGradient(gx, 0, gx + W * 0.10, H);
      g.addColorStop(0, 'hsla(' + hu + ',70%,72%,0)');
      g.addColorStop(.5, 'hsla(' + hu + ',70%,72%,.32)');
      g.addColorStop(1, 'hsla(' + hu + ',70%,72%,0)');
      x.fillStyle = g;
      x.fillRect(gx, 0, W * 0.11, H);
    }

    // mikrotrikia (bulu mikro pada membran)
    x.globalAlpha = .18;
    x.strokeStyle = '#6f8e98'; x.lineWidth = 1;
    for (let i = 0; i < 2200; i++) {
      const px = rnd() * W, py = rnd() * H;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + 3.5, py + 1.6); x.stroke();
    }
    x.globalAlpha = 1;
    return tex(c);
  };

  /* ==========================================================
     6. MATA MAJEMUK - dasar gradien merah (omatidia dibuat 3D)
     ========================================================== */
  TEX.eye = function () {
    const S = 512;
    const c = cv(S), x = c.getContext('2d');
    const g = x.createRadialGradient(S * .38, S * .34, S * .04, S * .5, S * .5, S * .62);
    g.addColorStop(0.00, '#a81f14');
    g.addColorStop(0.28, '#8a150d');
    g.addColorStop(0.62, '#5e0d08');
    g.addColorStop(1.00, '#340604');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    // pita gelap horizontal (pseudopupil / variasi zona)
    x.fillStyle = 'rgba(40,8,6,.28)';
    x.fillRect(0, S * 0.46, S, S * 0.1);
    speckle(x, S, S, 1400, 0.8, 2.6, t => (t > .5 ? '#c4553a' : '#2a0604'), 0.18);
    return tex(c);
  };

  /* ==========================================================
     7. LATAR - gradien radial untuk kubah langit
     ========================================================== */
  TEX.backdrop = function (inner, outer) {
    const S = 512;
    const c = cv(S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S * 0.42, 0, S / 2, S * 0.42, S * 0.72);
    g.addColorStop(0, inner || '#1a2029');
    g.addColorStop(1, outer || '#07090d');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return tex(c);
  };

  /* ==========================================================
     8. MEMBRAN LABELUM - alur pseudotrakea
     ========================================================== */
  TEX.labellum = function () {
    const W = 512, H = 512;
    const c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = '#6a5233'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(120,96,74,.45)');
    g.addColorStop(1, 'rgba(45,33,25,.6)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // ~30 alur pseudotrakea menyerupai sisir
    x.strokeStyle = 'rgba(28,20,15,.72)';
    for (let i = 0; i < 30; i++) {
      const y = (i / 30) * H + 4;
      x.lineWidth = 2.2;
      x.beginPath();
      x.moveTo(W * 0.5, y);
      x.quadraticCurveTo(W * 0.25, y + (i - 15) * 1.2, W * 0.03, y + (i - 15) * 3.0);
      x.stroke();
      x.beginPath();
      x.moveTo(W * 0.5, y);
      x.quadraticCurveTo(W * 0.75, y + (i - 15) * 1.2, W * 0.97, y + (i - 15) * 3.0);
      x.stroke();
    }
    return tex(c);
  };

  /* ==========================================================
     9. PETA LINGKUNGAN (equirectangular) untuk pantulan PBR.
        Tanpa ini, material halus seperti membran sayap & lensa
        omatidia akan tampak hitam karena tidak ada yang dipantulkan.
     ========================================================== */
  TEX.envEquirect = function (bright) {
    const W = 1024, H = 512;
    const c = cv(W, H), x = c.getContext('2d');

    const g = x.createLinearGradient(0, 0, 0, H);
    if (bright) {
      g.addColorStop(0.00, '#ffffff');
      g.addColorStop(0.42, '#dae6f2');
      g.addColorStop(0.52, '#aebccc');
      g.addColorStop(1.00, '#6e7987');
    } else {
      g.addColorStop(0.00, '#8fa8c4');   // zenit
      g.addColorStop(0.38, '#4d6076');
      g.addColorStop(0.50, '#2b3540');   // cakrawala
      g.addColorStop(0.72, '#15191f');
      g.addColorStop(1.00, '#0a0c10');   // nadir
    }
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // dua sumber cahaya lembut -> memberi kilau memanjang pada kutikula
    [[0.24, 0.24, 210, 'rgba(255,248,235,'], [0.72, 0.34, 150, 'rgba(150,195,235,']].forEach(L => {
      const rg = x.createRadialGradient(L[0] * W, L[1] * H, 0, L[0] * W, L[1] * H, L[2]);
      rg.addColorStop(0, L[3] + (bright ? 1 : 0.95) + ')');
      rg.addColorStop(0.45, L[3] + '0.28)');
      rg.addColorStop(1, L[3] + '0)');
      x.fillStyle = rg;
      x.fillRect(L[0] * W - L[2], L[1] * H - L[2], L[2] * 2, L[2] * 2);
    });

    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  };

  global.TEX = TEX;
})(window);
