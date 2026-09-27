/* ==========================================================
   brain-sim.js - simulasi aktivitas otak yang SUNGGUHAN DIHITUNG
   (bukan animasi kosmetik seperti js/signal.js), berjalan di atas
   data/connections.json (top-K sinaps per neuron, 1.978 neuron yang
   punya geometri di viewer).

   MODEL: "leaky-integrator" sangat disederhanakan.
     da_i/dt = -a_i/tau + Σ_j  sign(nt_j) · bobot_ij · r_j
     r_j     = tanh(max(0, a_j))            (keluaran/"laju tembak" semu)

   Neuron "sensorik" (bundel penciuman & optik-lain) disuntik rangsangan
   ACAK berkala - MENGGANTIKAN input dunia nyata (mata/antena sungguhan
   tidak dipindai kamera, tak ada data sensorik asli). Ini persis
   "otak membayangkan rangsangan", bukan bereaksi ke lingkungan sungguhan.

   PERINGATAN JUJUR - PENYEDERHANAAN, BUKAN AKURASI BIOLOGIS:
     - Tanda neurotransmitter (rangsang/hambat) memakai aturan kasar per
       jenis (ACh/dopamin/oktopamin = +, GABA/glutamat = -, serotonin =
       lemah +) - neurotransmitter sungguhan jauh lebih kontekstual
       (reseptor tujuan menentukan efeknya, bukan zatnya sendiri).
     - Hanya 1.978 dari 139.255 neuron ikut, dan cuma top-20 mitra per
       arah per neuron (lihat tools/fetch_connections.py) - bukan
       konektom penuh.
     - Tundaan sinaps, ambang tembak sungguhan (spiking), dan potensial
       membran nyata TIDAK dimodelkan - ini model laju (rate model)
       paling sederhana, satu langkah di atas animasi pulsa js/signal.js.
     - Sisi kiri/kanan neuron desenden diambil dari teks label anotasi
       ("... (left)"/"... (right)"), bukan bidang data terpisah.

   Untuk simulasi yang benar-benar merepresentasikan otak Drosophila,
   lihat "Simulasi biofisika sungguhan" di docs/flywire.md - itu proyek
   riset tersendiri, jauh di luar cakupan berkas ini.
   ========================================================== */
(function (global) {
  'use strict';

  // Penyederhanaan tanda rangsang(+)/hambat(-) per neurotransmitter dominan.
  const NT_SIGN = { ach: 1, da: 0.8, oct: 0.8, ser: 0.35, glut: -1, gaba: -1 };

  const TAU = 0.55;            // detik - waktu peluruhan aktivasi
  const WEIGHT_SCALE = 1 / 35; // syn_count -> bobot sinyal (dikalibrasi kasar,
                                // sekadar biar jaringan tak meledak/mati)
  const AMBIENT_SCALE = 0.18;  // porsi bobot mitra-di-luar-sampel yang dipakai
                                // sebagai dorongan latar konstan (lihat build())
  const NOISE_RATE = 0.30;     // peluang rangsangan spontan / neuron sensorik / detik

  // Dorongan latar (ambient) di atas KONSTAN per neuron -> asimetri
  // kiri/kanan jadi ikut konstan (tubuh cuma condong sekali lalu diam,
  // tak pernah "menoleh"). Di dunia nyata, input dari bagian otak yang
  // tak kita simulasikan juga tak benar-benar tetap - dia berfluktuasi
  // pelan. DRIFT_* meniru itu: satu nilai hanyut acak per sisi (kiri &
  // kanan independen, mean-reverting), ikut ditambahkan ke dorongan
  // latar neuron bersisi itu tiap langkah. Ini simplifikasi kosmetik di
  // atas simplifikasi (ambient sendiri sudah taksiran) - tapi tetap
  // bagian dari perhitungan aktivasi, bukan sekadar dikalikan ke hasil
  // akhir gerak tubuh.
  const DRIFT_TAU = 4.0;       // detik - makin besar makin lambat hanyutnya
  const DRIFT_STEP = 0.45;     // besar lompatan acak per detik
  const DRIFT_GAIN = 0.55;     // seberapa kuat drift ikut mendorong aktivasi
  const ACT_MIN = -1, ACT_MAX = 6;
  const SENSORY_BUNDLES = { 'nrn-pn-olfaktori': 1, 'nrn-optik-lain': 1 };
  const MOTOR_BUNDLE = 'nrn-desenden';

  function sideOf(label) {
    if (!label) return 0;
    if (/\(left\)\s*$/i.test(label)) return -1;
    if (/\(right\)\s*$/i.test(label)) return 1;
    return 0;
  }

  /**
   * Bangun simulasi dari data/connections.json (sudah dimuat sebagai `conn`)
   * dan NEURONS.locate (root_id -> {object,index} kalau punya geometri).
   * Balikan: { step(dt), state, neuronCount, edgeCount, activationAt(rid) }
   */
  function build(conn, locate) {
    if (!conn || !conn.neurons) return null;
    const ids = Object.keys(conn.neurons);
    const n = ids.length;
    if (!n) return null;

    const idx = Object.create(null);
    ids.forEach((id, i) => { idx[id] = i; });

    const act = new Float32Array(n);
    const scratch = new Float32Array(n);   // buffer input, dipakai ulang tiap step (hindari GC)
    const ambient = new Float32Array(n);   // dorongan latar dari mitra DI LUAR sampel (lihat bawah)
    const bundleOf = new Array(n);
    const sideArr = new Int8Array(n);
    let edgeCount = 0;

    const outEdges = new Array(n);
    ids.forEach((id, i) => {
      const loc = locate(id);
      bundleOf[i] = loc ? loc.object.userData.partId : null;
      sideArr[i] = sideOf(conn.labels && conn.labels[id]);
      const list = (conn.neurons[id].out || []).filter(e => e.g && idx[e.p] !== undefined);
      outEdges[i] = list.map(e => ({
        j: idx[e.p], w: e.w,
        sign: NT_SIGN[e.nt] != null ? NT_SIGN[e.nt] : 0.3
      }));
      edgeCount += outEdges[i].length;

      // Cuma 1.978/139.255 neuron ikut disimulasikan, jadi sebagian besar
      // mitra presinaps (g:0) TIDAK ikut dihitung dinamikanya - tapi bobot
      // sinapsnya tetap data nyata. Daripada dibuang (jaringan jadi nyaris
      // putus, cuma 802 edge sekali gabung), dijadikan dorongan latar KONSTAN
      // per neuron sebesar sebagian kecil bobot itu - mewakili "rata-rata
      // sumbangan otak yang tak ikut disimulasikan", bukan dinamika sungguhan
      // dari mitra tersebut (yang tak kita ketahui aktivasinya).
      (conn.neurons[id]['in'] || []).forEach(e => {
        if (e.g) return;   // yang g:1 sudah masuk lewat outEdges pasangannya
        const sign = NT_SIGN[e.nt] != null ? NT_SIGN[e.nt] : 0.3;
        ambient[i] += sign * e.w * WEIGHT_SCALE * AMBIENT_SCALE;
      });
    });

    const sensoryPool = [], motorPool = [];
    bundleOf.forEach((b, i) => {
      if (SENSORY_BUNDLES[b]) sensoryPool.push(i);
      if (b === MOTOR_BUNDLE) motorPool.push(i);
    });

    const state = { overall: 0, motorL: 0, motorR: 0, motor: 0, sensoryFire: 0 };
    let driftL = (Math.random() - 0.5) * 2, driftR = (Math.random() - 0.5) * 2;

    function step(dt) {
      dt = Math.min(dt, 0.1);   // jaga stabilitas kalau ada jeda/lag frame
      if (dt <= 0) return;

      // 0) hanyutkan drift kiri/kanan (random walk mean-reverting, lihat DRIFT_*)
      driftL += (Math.random() - 0.5) * DRIFT_STEP * Math.sqrt(dt) - driftL * (dt / DRIFT_TAU);
      driftR += (Math.random() - 0.5) * DRIFT_STEP * Math.sqrt(dt) - driftR * (dt / DRIFT_TAU);
      if (driftL > 1) driftL = 1; else if (driftL < -1) driftL = -1;
      if (driftR > 1) driftR = 1; else if (driftR < -1) driftR = -1;

      // 1) rangsangan spontan ke neuron sensorik - pengganti input dunia nyata
      let fired = 0;
      const pNoise = NOISE_RATE * dt;
      sensoryPool.forEach(i => {
        if (Math.random() < pNoise) { act[i] += 0.7 + Math.random() * 0.6; fired++; }
      });

      // 2) sebarkan: input_i = dorongan-latar (+ drift sesisi) + Σ tanda·bobot·keluaran(presinaps)
      scratch.set(ambient);
      for (let i = 0; i < n; i++) {
        const side = sideArr[i];
        if (side < 0) scratch[i] += driftL * DRIFT_GAIN;
        else if (side > 0) scratch[i] += driftR * DRIFT_GAIN;
      }
      for (let i = 0; i < n; i++) {
        const a = act[i];
        if (a <= 0.01) continue;
        const r = Math.tanh(a);
        const edges = outEdges[i];
        for (let k = 0; k < edges.length; k++) {
          const e = edges[k];
          scratch[e.j] += e.sign * e.w * WEIGHT_SCALE * r;
        }
      }

      // 3) integrasi Euler eksplisit, bocor menuju nol
      for (let i = 0; i < n; i++) {
        let a = act[i] + dt * (-act[i] / TAU + scratch[i]);
        if (a < ACT_MIN) a = ACT_MIN; else if (a > ACT_MAX) a = ACT_MAX;
        act[i] = a;
      }

      // 4) baca keluaran motor (neuron desenden), dipisah kiri/kanan dari label
      let sL = 0, nL = 0, sR = 0, nR = 0, sAll = 0;
      motorPool.forEach(i => {
        const r = Math.tanh(Math.max(0, act[i]));
        sAll += r;
        const side = sideArr[i];
        if (side < 0) { sL += r; nL++; } else if (side > 0) { sR += r; nR++; }
        else { sL += r * 0.5; sR += r * 0.5; nL += 0.5; nR += 0.5; }
      });
      let overall = 0;
      for (let i = 0; i < n; i++) overall += Math.max(0, act[i]);

      state.motorL = nL ? sL / nL : 0;
      state.motorR = nR ? sR / nR : 0;
      state.motor = motorPool.length ? sAll / motorPool.length : 0;
      state.overall = overall / n;
      state.sensoryFire = fired;
    }

    return {
      step: step, state: state,
      neuronCount: n, edgeCount: edgeCount,
      activationAt: rid => (idx[rid] !== undefined ? act[idx[rid]] : null),
      rawActivations: act, ids: ids
    };
  }

  global.BRAINSIM = { build: build };
})(window);
