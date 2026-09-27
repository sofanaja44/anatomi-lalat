/* ==========================================================
   controls.js - orbit / pan / zoom sederhana untuk three.js
   Ditulis sendiri agar tidak butuh file examples/ dari CDN.
   ========================================================== */
(function (global) {
  'use strict';

  const TWO_PI = Math.PI * 2;
  const EPS = 1e-6;

  function Orbit(camera, dom) {
    this.camera = camera;
    this.dom = dom;

    this.target = new THREE.Vector3(0, 0, 0);
    this.enabled = true;

    this.minDistance = 1.2;
    this.maxDistance = 120;
    this.minPolar = 0.02;
    this.maxPolar = Math.PI - 0.02;

    this.rotateSpeed = 1.0;
    this.zoomSpeed = 1.0;
    this.panSpeed = 1.0;
    this.damping = 0.085;          // makin kecil = makin "licin"

    this.autoRotate = false;
    this.autoRotateSpeed = 0.35;   // rad/detik

    // state sferis (theta = azimut, phi = polar)
    const off = new THREE.Vector3().copy(camera.position).sub(this.target);
    this._radius = off.length();
    this._theta = Math.atan2(off.x, off.z);
    this._phi = Math.acos(THREE.MathUtils.clamp(off.y / this._radius, -1, 1));

    // target interpolasi
    this._tRadius = this._radius;
    this._tTheta = this._theta;
    this._tPhi = this._phi;
    this._tTarget = this.target.clone();

    // animasi "terbang ke" (flyTo)
    this._fly = null;

    this._state = 0;   // 0 idle | 1 rotate | 2 pan
    this._ptr = new Map();
    this._last = { x: 0, y: 0 };
    this._pinch = 0;
    this.onChange = null;

    this._bind();
  }

  Orbit.prototype._bind = function () {
    const d = this.dom;
    const self = this;

    d.addEventListener('contextmenu', e => e.preventDefault());

    d.addEventListener('pointerdown', function (e) {
      if (!self.enabled) return;
      d.setPointerCapture(e.pointerId);
      self._ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (self._ptr.size === 1) {
        self._state = (e.button === 2 || e.shiftKey || e.ctrlKey) ? 2 : 1;
        self._last.x = e.clientX;
        self._last.y = e.clientY;
        self._moved = 0;
      } else if (self._ptr.size === 2) {
        self._state = 2;
        self._pinch = self._pinchDist();
      }
      self._fly = null;
      d.classList.add('dragging');
    });

    d.addEventListener('pointermove', function (e) {
      if (!self.enabled || !self._ptr.has(e.pointerId)) return;
      self._ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (self._ptr.size === 2) {
        const dist = self._pinchDist();
        if (self._pinch > 0) self.dolly(Math.pow(0.995, (dist - self._pinch) * 1.6));
        self._pinch = dist;
        return;
      }

      const dx = e.clientX - self._last.x;
      const dy = e.clientY - self._last.y;
      self._last.x = e.clientX;
      self._last.y = e.clientY;
      self._moved += Math.abs(dx) + Math.abs(dy);

      if (self._state === 1) self.rotate(dx, dy);
      else if (self._state === 2) self.pan(dx, dy);
    });

    function up(e) {
      self._ptr.delete(e.pointerId);
      if (self._ptr.size === 0) { self._state = 0; d.classList.remove('dragging'); }
      if (self._ptr.size < 2) self._pinch = 0;
    }
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    d.addEventListener('lostpointercapture', up);

    d.addEventListener('wheel', function (e) {
      if (!self.enabled) return;
      e.preventDefault();
      self._fly = null;
      const k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
      self.dolly(Math.pow(0.9985, -e.deltaY * k * self.zoomSpeed));
    }, { passive: false });
  };

  Orbit.prototype._pinchDist = function () {
    const p = [...this._ptr.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  };

  /** true kalau drag terakhir memang menggeser (bukan klik) */
  Orbit.prototype.wasDrag = function () { return (this._moved || 0) > 5; };

  Orbit.prototype.rotate = function (dx, dy) {
    const h = this.dom.clientHeight || 1;
    this._tTheta -= (TWO_PI * dx / h) * this.rotateSpeed;
    this._tPhi -= (TWO_PI * dy / h) * this.rotateSpeed;
    this._tPhi = THREE.MathUtils.clamp(this._tPhi, this.minPolar, this.maxPolar);
  };

  Orbit.prototype.pan = function (dx, dy) {
    const cam = this.camera;
    const h = this.dom.clientHeight || 1;
    // jarak layar -> jarak dunia pada bidang target
    const dist = this._tRadius * Math.tan((cam.fov / 2) * Math.PI / 180) * 2;
    const vx = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
    const vy = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
    vx.multiplyScalar(-dx * dist / h * this.panSpeed);
    vy.multiplyScalar(dy * dist / h * this.panSpeed);
    this._tTarget.add(vx).add(vy);
  };

  Orbit.prototype.dolly = function (k) {
    this._tRadius = THREE.MathUtils.clamp(this._tRadius * k, this.minDistance, this.maxDistance);
  };

  /** Geser titik yang dikelilingi kamera secara halus (lewat damping yang
      sama seperti drag), dipakai untuk "mengikuti" objek yang bergerak
      sendiri (mis. lalat berjalan) tanpa mengganggu rotate/zoom manual. */
  Orbit.prototype.setTarget = function (x, y, z) {
    this._tTarget.set(x, y, z);
  };

  /** Animasi halus ke posisi pandang tertentu. */
  Orbit.prototype.flyTo = function (opts) {
    const o = opts || {};
    this._fly = {
      t: 0,
      dur: o.duration != null ? o.duration : 0.85,
      fromTheta: this._tTheta,
      fromPhi: this._tPhi,
      fromRad: this._tRadius,
      fromTgt: this._tTarget.clone(),
      toTheta: o.theta != null ? this._shortestTheta(this._tTheta, o.theta) : this._tTheta,
      toPhi: o.phi != null ? THREE.MathUtils.clamp(o.phi, this.minPolar, this.maxPolar) : this._tPhi,
      toRad: o.radius != null ? THREE.MathUtils.clamp(o.radius, this.minDistance, this.maxDistance) : this._tRadius,
      toTgt: o.target ? o.target.clone() : this._tTarget.clone()
    };
  };

  Orbit.prototype._shortestTheta = function (from, to) {
    let d = (to - from) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return from + d;
  };

  Orbit.prototype.getSpherical = function () {
    return { theta: this._tTheta, phi: this._tPhi, radius: this._tRadius, target: this._tTarget.clone() };
  };

  Orbit.prototype.update = function (dt) {
    dt = Math.min(dt || 0.016, 0.1);

    if (this._fly) {
      const f = this._fly;
      f.t += dt;
      let u = Math.min(f.t / f.dur, 1);
      u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;  // easeInOutCubic
      this._tTheta = f.fromTheta + (f.toTheta - f.fromTheta) * u;
      this._tPhi = f.fromPhi + (f.toPhi - f.fromPhi) * u;
      this._tRadius = f.fromRad + (f.toRad - f.fromRad) * u;
      this._tTarget.lerpVectors(f.fromTgt, f.toTgt, u);
      if (f.t >= f.dur) this._fly = null;
    } else if (this.autoRotate && this._state === 0) {
      this._tTheta -= this.autoRotateSpeed * dt;
    }

    // damping eksponensial (stabil di FPS berapa pun)
    const a = 1 - Math.pow(this.damping, dt * 60);
    this._theta += (this._tTheta - this._theta) * a;
    this._phi += (this._tPhi - this._phi) * a;
    this._radius += (this._tRadius - this._radius) * a;
    this.target.lerp(this._tTarget, a);

    const sp = Math.max(Math.sin(this._phi), EPS);
    this.camera.position.set(
      this.target.x + this._radius * sp * Math.sin(this._theta),
      this.target.y + this._radius * Math.cos(this._phi),
      this.target.z + this._radius * sp * Math.cos(this._theta)
    );
    this.camera.lookAt(this.target);

    if (this.onChange) this.onChange();
  };

  global.Orbit = Orbit;
})(window);
