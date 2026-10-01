/* ==========================================================
   lif-brain.js - simulator otak "leaky integrate-and-fire" (LIF)
   yang menyalin model Shiu dkk. (Nature 2024) apa adanya:
   https://github.com/philshiu/Drosophila_brain_model (model.py)

     dv/dt = (v_0 - v + g) / t_mbr     (beku saat refraktori)
     dg/dt = -g / tau                  (beku saat refraktori)
     v > v_th  ->  spike, v = v_rst, g = 0, refraktori t_rfc
     spike presinaps -> setelah t_dly: g_post += w_syn x (jumlah sinaps x tanda)

   Diintegrasikan EKSAK (solusi analitik sistem linear, sama dengan
   method='linear' Brian2), dt = 0.1 ms seperti aslinya.

   SATU-SATUNYA PERBEDAAN dari model asli: input indra. Aslinya
   PoissonInput (acak). Di sini tiap neuron indra diberi laju tembak
   (Hz) dari dunia 3D, lalu ditembakkan TERATUR (akumulator fase:
   tembak tiap kali fase >= 1), dengan fase awal tetap per neuron dari
   indeksnya. Tidak ada Math.random() di berkas ini - dengan input
   yang sama, hasilnya selalu sama persis.

   Optimasi: neuron yang diam di potensial istirahat (v = v_0, g = 0,
   tidak refraktori) tidak dihitung sama sekali ("active set"). Karena
   model ini tak punya aktivitas spontan, neuron diam tetap diam sampai
   menerima input - jadi melewatinya tidak mengubah hasil (kecuali sisa
   < ACTIVE_EPS mV yang dibulatkan ke nol).

   Bisa dipakai di browser (window.LIFBRAIN / Web Worker) dan Node
   (require), dari data CSR: offsets (Int32Array n+1), post (Int32Array),
   w (Int16Array/Int32Array, jumlah sinaps bertanda), dan opsional key
   (indeks tiap neuron di otak utuh - untuk fase input, lihat markInputs).
   ========================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LIFBRAIN = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const P = {
    dt: 0.1,          // ms
    v_0: -52, v_rst: -52, v_th: -45,   // mV
    t_mbr: 20,        // ms, konstanta waktu membran
    tau: 5,           // ms, konstanta waktu sinaps
    t_rfc: 2.2,       // ms, refraktori
    t_dly: 1.8,       // ms, tunda sinaps
    w_syn: 0.275,     // mV per sinaps
    f_poi: 250,       // pengali bobot input indra (sama dengan model asli)
    // Adaptasi laju tembak (TAMBAHAN, tidak ada di model asli; 0 = mati):
    // tiap spike menambah arus adaptasi a sebesar adapt_b mV, meluruh
    // dengan tau_a ms, dan mengurangi dorongan membran: du/dt += -a/t_mbr.
    adapt_b: 0,       // mV per spike
    tau_a: 200        // ms
  };
  const ACTIVE_EPS = 1e-4;   // mV - di bawah ini dianggap kembali istirahat

  function create(net, opts) {
    const p = Object.assign({}, P, opts || {});
    const n = net.n, offsets = net.offsets, post = net.post, wRaw = net.w;
    // kunci fase input: indeks neuron di otak UTUH (net.key), supaya otak
    // potongan menembakkan input pada fase yang sama persis dengan otak utuh
    const key = net.key || null;

    const dt = p.dt;
    const eM = Math.exp(-dt / p.t_mbr), eS = Math.exp(-dt / p.tau);
    const A = p.tau / (p.tau - p.t_mbr);          // lihat solusi eksak di step()
    const eA = Math.exp(-dt / p.tau_a), Aa = p.tau_a / (p.tau_a - p.t_mbr);
    const useAdapt = p.adapt_b > 0;
    const rfcSteps = Math.round(p.t_rfc / dt);
    const dlySteps = Math.round(p.t_dly / dt);
    const inputKick = p.w_syn * p.f_poi;          // 68.75 mV, pasti menembak
    // konstanta yang dipakai tiap langkah - dihitung sekali. Urutan operasi
    // aritmetika di step() SENGAJA sama persis dengan rumusnya, supaya hasil
    // tetap identik bit-per-bit (dicek terhadap versi tanpa optimasi).
    const dSE = eS - eM;
    const thrU = p.v_th - p.v_0, rstU = p.v_rst - p.v_0, adaptB = p.adapt_b;
    const wS = new Float64Array(wRaw.length);     // bobot x w_syn (mV), double = sama dgn hitung langsung
    for (let e = 0; e < wRaw.length; e++) wS[e] = wRaw[e] * p.w_syn;

    const u = new Float32Array(n);      // v - v_0
    const g = new Float32Array(n);
    const a = new Float32Array(n);      // arus adaptasi (mV), lihat adapt_b
    const rfc = new Int16Array(n);      // sisa langkah refraktori
    const noRfc = new Uint8Array(n);    // neuron indra: tanpa refraktori (seperti aslinya)
    const inActive = new Uint8Array(n);
    let active = new Int32Array(1024), nActive = 0;

    // antrean spike untuk tunda sinaps: ring buffer per langkah
    const ring = [];
    for (let k = 0; k <= dlySteps; k++) ring.push([]);
    let tStep = 0;

    // input indra: indeks -> laju (Hz); fase tetap dari indeks (bukan acak)
    const drive = new Float64Array(n);
    const phase = new Float64Array(n);
    let driven = [];

    // hitungan spike per neuron (untuk laju tembak) - dibaca pemakai
    const spikeCount = new Uint32Array(n);
    let totalSpikes = 0;
    const listeners = [];

    function activate(i) {
      if (inActive[i]) return;
      inActive[i] = 1;
      if (nActive === active.length) {
        const b = new Int32Array(active.length * 2); b.set(active); active = b;
      }
      active[nActive++] = i;
    }

    // Tandai neuron input (seperti model asli: target PoissonInput tak punya
    // refraktori). Fase awal tetap per neuron (deret rasio emas) supaya
    // neuron sekelompok tidak menembak serentak - deterministik.
    function markInputs(list) {
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        if (noRfc[i]) continue;
        noRfc[i] = 1;
        phase[i] = ((key ? key[i] : i) * 0.6180339887498949) % 1;
      }
    }

    function setDrive(rates) {
      // rates: Map/objek {indeks: Hz}. Neuron yang tak disebut -> 0 Hz.
      for (let k = 0; k < driven.length; k++) drive[driven[k]] = 0;
      driven = [];
      const keys = rates instanceof Map ? Array.from(rates.keys()) : Object.keys(rates);
      for (let k = 0; k < keys.length; k++) {
        const i = +keys[k];
        const r = rates instanceof Map ? rates.get(keys[k]) : rates[keys[k]];
        if (!(r > 0)) continue;
        markInputs([i]);
        drive[i] = r; driven.push(i);
      }
    }

    function step() {
      let act = active, nAct = nActive;

      // 1) input indra (setara PoissonInput ke v, tapi teratur)
      for (let k = 0; k < driven.length; k++) {
        const i = driven[k];
        phase[i] += drive[i] * dt * 1e-3;
        if (phase[i] >= 1) {
          phase[i] -= 1; u[i] += inputKick;
          if (!inActive[i]) {
            inActive[i] = 1;
            if (nAct === act.length) { const b = new Int32Array(act.length * 2); b.set(act); act = b; }
            act[nAct++] = i;
          }
        }
      }

      // 2) integrasi eksak + ambang + reset, hanya neuron aktif
      const fired = ring[tStep % ring.length];   // slot ini: spike yang akan dikirim nanti
      fired.length = 0;
      let w = 0;
      for (let k = 0; k < nAct; k++) {
        const i = act[k];
        let ui, gi;
        if (rfc[i] > 0) {
          rfc[i]--;
          ui = u[i]; gi = g[i];
        } else {
          gi = g[i];
          // u(t+dt) = u e^{-dt/t_mbr} + A g (e^{-dt/tau} - e^{-dt/t_mbr})
          // (= (u - A g) e^{-dt/t_mbr} + A g e^{-dt/tau}, solusi eksak)
          let un = u[i] * eM + A * gi * dSE;
          g[i] = gi * eS;
          if (useAdapt && a[i] !== 0) {
            un -= Aa * a[i] * (eA - eM);   // suku adaptasi, bentuk eksak yang sama
            a[i] *= eA;
          }
          u[i] = un;
          ui = u[i]; gi = g[i];            // dibaca ulang: nilai float32 yang tersimpan
        }
        if (ui > thrU) {
          u[i] = rstU; g[i] = 0;
          ui = u[i]; gi = 0;
          rfc[i] = noRfc[i] ? 0 : rfcSteps;
          if (useAdapt && !noRfc[i]) a[i] += adaptB;
          fired.push(i);
          spikeCount[i]++; totalSpikes++;
        }
        if (rfc[i] === 0 && ui < ACTIVE_EPS && ui > -ACTIVE_EPS && gi < ACTIVE_EPS && gi > -ACTIVE_EPS &&
            (!useAdapt || (a[i] < ACTIVE_EPS && a[i] > -ACTIVE_EPS))) {
          u[i] = 0; g[i] = 0; a[i] = 0; inActive[i] = 0;
        } else {
          act[w++] = i;
        }
      }
      nAct = w;

      // 3) kirim spike yang sudah lewat t_dly (tembak di langkah tStep-dlySteps)
      const due = ring[(tStep + 1) % ring.length];
      for (let k = 0; k < due.length; k++) {
        const s = due[k];
        for (let e = offsets[s], end = offsets[s + 1]; e < end; e++) {
          const j = post[e];
          g[j] += wS[e];
          if (!inActive[j]) {
            inActive[j] = 1;
            if (nAct === act.length) { const b = new Int32Array(act.length * 2); b.set(act); act = b; }
            act[nAct++] = j;
          }
        }
      }
      active = act; nActive = nAct;
      if (fired.length) for (let l = 0; l < listeners.length; l++) listeners[l](fired, tStep);
      tStep++;
    }

    function run(ms) {
      const steps = Math.round(ms / dt);
      for (let s = 0; s < steps; s++) step();
    }

    return {
      params: p, n: n,
      setDrive: setDrive, markInputs: markInputs, step: step, run: run,
      onSpikes: fn => listeners.push(fn),
      spikeCount: spikeCount,
      get totalSpikes() { return totalSpikes; },
      get activeCount() { return nActive; },
      get timeMs() { return tStep * dt; },
      voltage: i => u[i] + p.v_0
    };
  }

  return { create: create, DEFAULTS: P };
});
