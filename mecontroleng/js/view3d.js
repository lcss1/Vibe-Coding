/* ============================================================
   MeControlEng — Vista 3D animada (Three.js)
   O esquemático é "montado" sobre uma bancada: eixos giram com o
   ângulo θ(t) do nó, massas/hastes deslizam com x(t), molas esticam
   e torcem, engrenagens engrenam, motores esquentam com a corrente.
   Coordenadas: esquemático (x, y) → 3D (x, altura, z=y).
   ============================================================ */
'use strict';

MS.View3D = class {
  constructor(el, app) {
    this.el = el; this.app = app;
    this.dispScale = 10;           // escala visual de deslocamento (unid. de grade por metro)
    this.updaters = [];
    this.res = null;
    this.t = 0;
    if (!window.THREE) { el.innerHTML = '<div class="v3d-msg">Three.js não carregado — vista 3D indisponível.</div>'; this.disabled = true; return; }
    const T = THREE;
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;
    try {
      this.renderer = new T.WebGLRenderer({ antialias: true });
    } catch (err) { el.innerHTML = '<div class="v3d-msg">WebGL indisponível neste navegador.</div>'; this.disabled = true; return; }
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputEncoding = T.sRGBEncoding;
    el.appendChild(this.renderer.domElement);

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x070d18);
    this.scene.fog = new T.Fog(0x070d18, 60, 160);
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 500);

    this.scene.add(new T.HemisphereLight(0xcfe3ff, 0x0b1322, 0.9));
    const sun = this.sun = new T.DirectionalLight(0xffffff, 1.6);
    sun.position.set(12, 26, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    this.scene.add(sun); this.scene.add(sun.target);
    const rim = new T.DirectionalLight(0x4fb3ff, 0.35); rim.position.set(-15, 10, -20); this.scene.add(rim);

    const floor = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshStandardMaterial({ color: 0x101b2c, roughness: 0.95, metalness: 0.0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    const grid = new T.GridHelper(400, 400, 0x1b2d4a, 0x111e33); grid.position.y = 0.002; this.scene.add(grid);

    this.root = new T.Group(); this.scene.add(this.root);
    this.orbit = { target: new T.Vector3(0, 0, 0), r: 30, th: 0.3, ph: 1.0 };
    this._mats();
    this._bind();
    this.resize();
    const loop = () => { requestAnimationFrame(loop); this.render(); };
    requestAnimationFrame(loop);
  }

  _mats() {
    const T = THREE, S = (c, m = 0.6, r = 0.4, extra = {}) => new T.MeshStandardMaterial({ color: c, metalness: m, roughness: r, ...extra });
    this.M = {
      steel: S(0xa9b6c8, 0.85, 0.3), dark: S(0x33405a, 0.7, 0.45), key: S(0xff9f1c, 0.4, 0.4),
      chrome: S(0xdfe8f5, 1.0, 0.15), copper: S(0xd27a3a, 0.9, 0.3), brass: S(0xc9a24a, 0.9, 0.3),
      gear1: S(0xffb04a, 0.75, 0.35), gear2: S(0x7aa2ff, 0.75, 0.35),
      mass: S(0x2fbf7a, 0.35, 0.45), wall: S(0x223451, 0.1, 0.9), wallEdge: S(0x3a5684, 0.2, 0.7),
      spring: S(0x9fe8c0, 0.8, 0.25), springR: S(0xffc36b, 0.8, 0.25),
      glass: S(0x8fb6ff, 0.2, 0.1, { transparent: true, opacity: 0.32 }),
      motor: S(0x2b4a78, 0.75, 0.35, { emissive: 0x000000 }), motorCap: S(0x1b2a44, 0.6, 0.5),
      src: S(0x5d3a9c, 0.5, 0.4), arrow: S(0xff4d6d, 0.3, 0.4, { emissive: 0x401020 }),
      resistor: S(0xd8c39a, 0.1, 0.7, { emissive: 0x000000 }), capBlue: S(0x2763c4, 0.3, 0.4), black: S(0x15181f, 0.3, 0.5),
      pcb: S(0x0d6b3a, 0.2, 0.6), chip: S(0x111111, 0.2, 0.5), led: S(0x3dff9a, 0.1, 0.3, { emissive: 0x000000 }),
      wire: S(0xc8742f, 0.9, 0.35),
      heat: S(0xb0603a, 0.6, 0.45), pipe: S(0x9fd8ff, 0.1, 0.1, { transparent: true, opacity: 0.28 }), water: S(0x2f7fd6, 0.1, 0.25, { transparent: true, opacity: 0.85 }),
      plastic: S(0x23262d, 0.1, 0.55), dip: S(0x1a1a1e, 0.2, 0.6), pin: S(0xd0d4da, 1, 0.25), relay: S(0x2f5fb8, 0.2, 0.5), tank: S(0xbfd4ea, 0.3, 0.2, { transparent: true, opacity: 0.25, side: THREE.DoubleSide }), base: S(0x182640, 0.4, 0.7), band: S(0x7a2b1a, 0.2, 0.6), band2: S(0x222222, 0.2, 0.6), band3: S(0xd4a017, 0.6, 0.4),
    };
  }

  resize() {
    if (this.disabled) return;
    const r = this.el.getBoundingClientRect();
    const w = Math.max(10, r.width), h = Math.max(10, r.height);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _bind() {
    const c = this.renderer.domElement;
    let drag = null;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }; });
    window.addEventListener('mouseup', () => { drag = null; });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      const o = this.orbit;
      if (drag.b === 0 && !drag.shift) { o.th -= dx * 0.008; o.ph = Math.max(0.08, Math.min(1.52, o.ph - dy * 0.008)); }
      else {
        const k = o.r * 0.0016;
        const right = new THREE.Vector3(Math.cos(o.th), 0, -Math.sin(o.th));
        const fwd = new THREE.Vector3(Math.sin(o.th), 0, Math.cos(o.th));
        o.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
      }
    });
    c.addEventListener('wheel', e => { e.preventDefault(); this.orbit.r = Math.max(3, Math.min(250, this.orbit.r * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
    c.addEventListener('dblclick', () => this.fit());
  }

  fit() {
    if (this.disabled) return;
    const b = this.bbox;
    if (!b) return;
    this.orbit.target.set((b.x0 + b.x1) / 2, 0.8, (b.y0 + b.y1) / 2);
    const span = Math.max(b.x1 - b.x0, (b.y1 - b.y0) * 1.2, 8);
    const tv = Math.tan(this.camera.fov * Math.PI / 360) * Math.min(1.3, this.camera.aspect);
    this.orbit.r = span * 0.46 / tv + 3;
    const s = this.sun;
    s.position.set(this.orbit.target.x + 12, 26, this.orbit.target.z + 18); s.target.position.copy(this.orbit.target);
    const sc = s.shadow.camera, ext = span * 0.9 + 6;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 120; sc.updateProjectionMatrix();
  }

  render() {
    if (this.disabled || !this.el.offsetParent) return;
    const o = this.orbit;
    this.camera.position.set(o.target.x + o.r * Math.sin(o.ph) * Math.sin(o.th), o.target.y + o.r * Math.cos(o.ph), o.target.z + o.r * Math.sin(o.ph) * Math.cos(o.th));
    this.camera.lookAt(o.target);
    const f = this.frame();
    for (const u of this.updaters) u(f);
    this.renderer.render(this.scene, this.camera);
  }

  setResult(res) {
    this.res = res;
    this.qmax = new Map();
    this.trange = [20, 100];
    if (res) {
      for (const [id, s] of res.signals) { let m = 0; for (let i = 0; i < s.data.length; i++) m = Math.max(m, Math.abs(s.data[i])); this.qmax.set(id, m || 1); }
      let lo = Infinity, hi = -Infinity;
      for (const s of res.signals.values()) if (s.dom === 'H' && s.kind === 'across') for (let i = 0; i < s.data.length; i++) { lo = Math.min(lo, s.data[i]); hi = Math.max(hi, s.data[i]); }
      if (isFinite(lo)) this.trange = [lo, Math.max(hi, lo + 1)];
    }
  }
  setTime(t) { this.t = t; }

  /* acesso ao estado no instante atual (interpolado) */
  frame() {
    const res = this.res, t = this.t, nl = this.nl;
    let lo = 0, hi = 0, fr = 0;
    if (res && res.n > 1) {
      const T = res.t; hi = res.n - 1;
      if (t <= T[0]) hi = 0; else if (t >= T[res.n - 1]) lo = hi; else {
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
        fr = (t - T[lo]) / (T[hi] - T[lo] || 1);
      }
    }
    const val = id => { if (!res || !id) return 0; const s = res.signals.get(id); if (!s) return 0; return s.data[lo] + (s.data[hi] - s.data[lo]) * fr; };
    const sc = this.dispScale;
    return {
      t,
      pos: node => (res && node > 0 && res.posSig[node] ? val(res.posSig[node]) : 0),
      ang: node => (res && node > 0 && res.posSig[node] ? val(res.posSig[node]) : 0),
      disp: node => (res && node > 0 && res.posSig[node] ? val(res.posSig[node]) * sc : 0),
      across: node => (res && node > 0 ? val(res.nodeSig[node]) : 0),
      q: (cid, k) => { if (!res) return 0; const ids = res.compSig.get(cid); if (!ids) return 0; const id = ids.find(i => i.endsWith(':' + k)) || ids[0]; return val(id); },
      qn: (cid, k) => { if (!res) return 0; const ids = res.compSig.get(cid); if (!ids) return 0; const id = ids.find(i => i.endsWith(':' + k)) || ids[0]; return Math.abs(val(id)) / (this.qmax.get(id) || 1); },
      has: !!res,
      nl,
      sig: (cid, k) => { if (!res) return 0; const ids = res.compSig.get(cid); if (!ids) return 0; const id = ids.find(i => i.endsWith(':' + k)); return id ? val(id) : 0; },
      /* cor de temperatura: azul (frio) → vermelho → amarelo (quente) */
      tcolor: (color, node) => {
        const T = res && node > 0 ? val(res.nodeSig[node]) : this.trange[0];
        const k = Math.max(0, Math.min(1, (T - this.trange[0]) / (this.trange[1] - this.trange[0])));
        color.setRGB(Math.min(1, 0.15 + 1.6 * k), Math.max(0.12, k > 0.6 ? (k - 0.6) * 2.2 : 0.25 - 0.2 * k), Math.max(0, 0.75 - 1.3 * k));
      },
    };
  }

  /* ───────────── construção da cena ───────────── */
  build(doc) {
    if (this.disabled) return;
    const T = THREE;
    // descartar
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.root.clear();
    this.updaters = [];
    const nl = this.nl = MS.netlist(doc);
    const M = this.M;
    const AX = MS.AX3D, EH = MS.EH3D;

    const V = (x, y, z) => new T.Vector3(x, y, z);
    const mesh = (geo, mat) => { const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
    const sgnL = (vx, vy, rot) => { const r = MS.rotPt(vx, vy, rot); return (r.x + r.y) >= 0 ? 1 : -1; };

    // haste/eixo genérico de a→b; retorna {g, spin}; spin gira em torno do próprio eixo
    const rod = (a, b, r, mat, key) => {
      const dir = b.clone().sub(a), len = dir.length();
      const g = new T.Group(); g.position.copy(a);
      if (len > 1e-6) g.quaternion.setFromUnitVectors(V(1, 0, 0), dir.clone().normalize());
      const spin = new T.Group(); g.add(spin);
      const cyl = mesh(new T.CylinderGeometry(r, r, Math.max(len, 1e-3), 16), mat); cyl.rotation.z = -Math.PI / 2; cyl.position.x = len / 2; spin.add(cyl);
      if (key) { const k = mesh(new T.BoxGeometry(Math.max(len * 0.96, 1e-3), r * 0.55, r * 0.55), M.key); k.position.set(len / 2, r * 0.92, 0); spin.add(k); }
      return { g, spin, len };
    };
    // disco/cilindro com eixo em x local
    const discX = (r, w, mat, seg = 40) => { const m = mesh(new T.CylinderGeometry(r, r, w, seg), mat); m.rotation.z = Math.PI / 2; return m; };

    // molas helicoidais (geometria reconstruída quando muda)
    class Helix extends T.Curve {
      constructor() { super(); this.p = { x1: 0, x2: 1, R: 0.35, n: 6, a1: 0, a2: 0 }; }
      getPoint(t, out = new T.Vector3()) {
        // rotação positiva em torno de +x corresponde a ângulo de fase decrescente
        const p = this.p, a = 2 * Math.PI * p.n * t - (p.a1 + (p.a2 - p.a1) * t);
        return out.set(p.x1 + (p.x2 - p.x1) * t, p.R * Math.sin(a), p.R * Math.cos(a));
      }
    }
    const coil = (mat, R, n, wr) => {
      const curve = new Helix(); curve.p.R = R; curve.p.n = n;
      const m = mesh(new T.BufferGeometry(), mat);
      let last = '';
      return {
        mesh: m,
        set(x1, x2, a1 = 0, a2 = 0) {
          const k = [x1, x2, a1, a2].map(v => v.toFixed(3)).join();
          if (k === last) return; last = k;
          Object.assign(curve.p, { x1, x2, a1, a2 });
          m.geometry.dispose();
          m.geometry = new T.TubeGeometry(curve, Math.round(n * 22), wr, 7, false);
        },
      };
    };

    // engrenagem de dentes retos (eixo em x local)
    const gearMesh = (z, rp, w, mat) => {
      const mod = 2 * rp / z, ra = rp + mod, rf = rp - 1.25 * mod;
      const s = new T.Shape();
      for (let i = 0; i < z; i++) {
        const a0 = (i / z) * Math.PI * 2, da = Math.PI * 2 / z;
        const pts = [[rf, a0 - da * 0.5], [rf, a0 - da * 0.27], [ra, a0 - da * 0.14], [ra, a0 + da * 0.14], [rf, a0 + da * 0.27]];
        pts.forEach(([r, a], j) => { const x = r * Math.cos(a), y = r * Math.sin(a); (i === 0 && j === 0) ? s.moveTo(x, y) : s.lineTo(x, y); });
      }
      s.closePath();
      const hole = new T.Path(); hole.absarc(0, 0, Math.min(0.12, rf * 0.4), 0, Math.PI * 2, true); s.holes.push(hole);
      const geo = new T.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 6 });
      geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
      const g = new T.Group(); g.add(mesh(geo, mat));
      // marcador radial (visualiza rotação)
      const mk = mesh(new T.BoxGeometry(w * 1.05, rf * 0.75, 0.06), M.key); mk.position.y = rf * 0.45; g.add(mk);
      return g;
    };

    const wall = (g, axisLen = 5.2) => {
      const w = mesh(new T.BoxGeometry(axisLen, AX * 2 + 0.4, 0.35), M.wall); w.position.set(0, AX + 0.2 - 0.0, 0.55); g.add(w);
      const e = mesh(new T.BoxGeometry(axisLen + 0.1, 0.12, 0.42), M.wallEdge); e.position.set(0, AX * 2 + 0.45, 0.55); g.add(e);
    };

    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;

    /* eixo principal de movimento de cada nó translacional (voto dos componentes que se movem) */
    const nodeAxis = new Map();
    const vote = (node, ax) => { if (node > 0) { const v = nodeAxis.get(node) || { x: 0, z: 0 }; v[ax]++; nodeAxis.set(node, v); } };
    for (const c of doc.comps) {
      const nd = nl.pinNode.get(c.id) || [];
      const axX = (c.rot % 2 === 0) ? 'x' : 'z', axZ = axX === 'x' ? 'z' : 'x';
      if (['M', 'K', 'B'].includes(c.type)) { vote(nd[0], axX); vote(nd[1], axX); }
      if (c.type === 'VCOIL') vote(nd[2], axX);
      if (c.type === 'CYL') vote(nd[1], axX);
      if (c.type === 'VSENS') vote(nd[0], axX);
      if (c.type === 'RACK') vote(nd[1], axZ);
    }

    /* ── fios ── */
    for (const w of doc.wires) {
      const dom = nl.wireDom.get(w.id), node = nl.wireNode.get(w.id);
      bx0 = Math.min(bx0, w.x1, w.x2); bx1 = Math.max(bx1, w.x1, w.x2); by0 = Math.min(by0, w.y1, w.y2); by1 = Math.max(by1, w.y1, w.y2);
      let x1 = w.x1, y1 = w.y1, x2 = w.x2, y2 = w.y2;
      if ((x2 - x1) + (y2 - y1) < 0) { [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1]; }
      if (dom === 'R') {
        const r = rod(V(x1, AX, y1), V(x2, AX, y2), 0.09, M.steel, true);
        this.root.add(r.g);
        this.updaters.push(f => { r.spin.rotation.x = f.ang(node); });
      } else if (dom === 'T') {
        const r = rod(V(x1, AX, y1), V(x2, AX, y2), 0.075, M.chrome, false);
        const base = r.g.position.clone();
        const nv = nodeAxis.get(node);
        const dir = nv ? (nv.x >= nv.z ? V(1, 0, 0) : V(0, 0, 1)) : V(x2 - x1, 0, y2 - y1).normalize();
        this.root.add(r.g);
        this.updaters.push(f => { r.g.position.copy(base).addScaledVector(dir, f.disp(node)); });
      } else if (dom === 'H') {
        const mat = M.heat.clone();
        const r = rod(V(x1, MS.TH3D, y1), V(x2, MS.TH3D, y2), 0.07, mat, false);
        this.root.add(r.g);
        this.updaters.push(f => { if (f.has) f.tcolor(mat.color, node); });
      } else if (dom === 'F') {
        const r = rod(V(x1, MS.FH3D, y1), V(x2, MS.FH3D, y2), 0.13, M.pipe, false);
        const core = rod(V(x1, MS.FH3D, y1), V(x2, MS.FH3D, y2), 0.085, M.water, false);
        this.root.add(r.g, core.g);
      } else {
        const r = rod(V(x1, EH, y1), V(x2, EH, y2), 0.045, M.wire, false);
        this.root.add(r.g);
      }
    }

    /* ── componentes ── */
    for (const c of doc.comps) {
      const d = MS.DEFS[c.type];
      const nodes = nl.pinNode.get(c.id) || [];
      const P = k => MS.parseEng(c.params[k]);
      const g = new T.Group();
      g.position.set(c.x, 0, c.y); g.rotation.y = -c.rot * Math.PI / 2;
      const sx = sgnL(1, 0, c.rot), sz = sgnL(0, 1, c.rot);
      const ang = (f, i) => f.ang(nodes[i]), disp = (f, i) => f.disp(nodes[i]);
      const up = fn => this.updaters.push(fn);
      const bb = { x0: c.x - 2, y0: c.y - 2, x1: c.x + 2, y1: c.y + 2 };
      bx0 = Math.min(bx0, bb.x0); bx1 = Math.max(bx1, bb.x1); by0 = Math.min(by0, bb.y0); by1 = Math.max(by1, bb.y1);
      const lead = (a, b, r = 0.04, mat = M.steel) => { const q = rod(a, b, r, mat, false); g.add(q.g); return q; };
      const elecLeads = (z1 = -0.85, z2 = 0.85) => { lead(V(0, EH, -2), V(0, EH, z1)); lead(V(0, EH, z2), V(0, EH, 2)); };

      switch (c.type) {
        /* ───── elétricos (estáticos, alguns brilham com a corrente) ───── */
        case 'R': {
          elecLeads();
          const body = mesh(new T.CylinderGeometry(0.24, 0.24, 1.7, 20), M.resistor.clone()); body.rotation.x = Math.PI / 2; body.position.y = EH; g.add(body);
          [[-0.45, M.band], [-0.15, M.band2], [0.15, M.band], [0.5, M.band3]].forEach(([z, m]) => { const b = mesh(new T.CylinderGeometry(0.25, 0.25, 0.12, 20), m); b.rotation.x = Math.PI / 2; b.position.set(0, EH, z); g.add(b); });
          up(f => { const k = f.qn(c.id, 'I'); body.material.emissive.setRGB(k * 0.9, k * 0.25, 0); });
          break;
        }
        case 'C': {
          elecLeads(-0.3, 0.3);
          const b = mesh(new T.CylinderGeometry(0.42, 0.42, 1.0, 24), M.capBlue); b.position.set(0, EH + 0.5, 0); g.add(b);
          const top = mesh(new T.CylinderGeometry(0.4, 0.4, 0.04, 24), M.steel); top.position.set(0, EH + 1.02, 0); g.add(top);
          const st = mesh(new T.BoxGeometry(0.08, 0.95, 0.3), M.steel); st.position.set(0.39, EH + 0.5, 0); g.add(st);
          break;
        }
        case 'L': {
          elecLeads(-1.1, 1.1);
          const core = mesh(new T.CylinderGeometry(0.2, 0.2, 2.2, 16), M.dark); core.rotation.x = Math.PI / 2; core.position.y = EH + 0.2; g.add(core);
          const cl = coil(M.copper, 0.32, 9, 0.05); cl.set(-1.1, 1.1); cl.mesh.rotation.y = -Math.PI / 2; cl.mesh.position.y = EH + 0.2; g.add(cl.mesh);
          break;
        }
        case 'VS': case 'IS': {
          elecLeads(-1.0, 1.0);
          const b = mesh(new T.CylinderGeometry(0.45, 0.45, 2.0, 28), c.type === 'VS' ? M.black : M.capBlue); b.rotation.x = Math.PI / 2; b.position.y = EH + 0.2; g.add(b);
          const cap = mesh(new T.CylinderGeometry(0.46, 0.46, 0.5, 28), M.key); cap.rotation.x = Math.PI / 2; cap.position.set(0, EH + 0.2, -0.75); g.add(cap);
          const tip = mesh(new T.CylinderGeometry(0.15, 0.15, 0.15, 16), M.steel); tip.rotation.x = Math.PI / 2; tip.position.set(0, EH + 0.2, -1.05); g.add(tip);
          break;
        }
        case 'D': {
          elecLeads(-0.45, 0.45);
          const b = mesh(new T.CylinderGeometry(0.17, 0.17, 0.9, 16), M.black); b.rotation.x = Math.PI / 2; b.position.y = EH; g.add(b);
          const band = mesh(new T.CylinderGeometry(0.18, 0.18, 0.12, 16), M.steel); band.rotation.x = Math.PI / 2; band.position.set(0, EH, 0.32); g.add(band);
          break;
        }
        case 'SW': {
          elecLeads(-0.8, 0.8);
          const base = mesh(new T.BoxGeometry(0.9, 0.2, 2.0), M.base); base.position.y = 0.1; g.add(base);
          const lever = new T.Group(); lever.position.set(0, EH + 0.05, 0.8); g.add(lever);
          const bar = mesh(new T.BoxGeometry(0.12, 0.1, 1.65), M.copper); bar.position.z = -0.82; lever.add(bar);
          const knob = mesh(new T.SphereGeometry(0.16, 16, 12), M.arrow); knob.position.set(0, 0.1, -1.6); lever.add(knob);
          const ton = P('ton'), toff = P('toff');
          up(f => { const on = f.t >= ton && f.t < toff; lever.rotation.x += ((on ? 0 : 0.6) - lever.rotation.x) * 0.3; });
          break;
        }
        case 'GND': {
          const p = mesh(new T.BoxGeometry(1.2, 0.08, 1.2), M.brass); p.position.set(0, 0.04, 0.4); g.add(p);
          lead(V(0, EH, 0), V(0, 0.05, 0.001), 0.05, M.brass);
          break;
        }
        case 'PID': {
          const b = mesh(new T.BoxGeometry(4.2, 0.12, 3.4), M.pcb); b.position.y = 0.12; g.add(b);
          const chip = mesh(new T.BoxGeometry(1.4, 0.18, 1.0), M.chip); chip.position.set(0, 0.27, 0); g.add(chip);
          for (let i = 0; i < 6; i++) { const s = mesh(new T.BoxGeometry(0.25, 0.14, 0.4), M.capBlue); s.position.set(-1.6 + i * 0.6, 0.25, 1.25); g.add(s); }
          const led = mesh(new T.SphereGeometry(0.16, 16, 12), M.led.clone()); led.position.set(1.5, 0.3, -1.2); g.add(led);
          lead(V(-3, EH, -1), V(-2, EH, -1), 0.045, M.wire); lead(V(-3, EH, 1), V(-2, EH, 1), 0.045, M.wire); lead(V(2, EH, 0), V(3, EH, 0), 0.045, M.wire);
          up(f => { const k = Math.min(1, f.qn(c.id, 'u')); led.material.emissive.setRGB(k * 0.2, k * 1.0, k * 0.5); });
          break;
        }

        /* ───── rotacionais ───── */
        case 'J': {
          const sh = rod(V(-2, AX, 0), V(2, AX, 0), 0.1, M.steel, true); g.add(sh.g);
          const spin = new T.Group(); spin.position.set(0, AX, 0); g.add(spin);
          const R = Math.min(1.3, AX - 0.08);
          spin.add(discX(R, 0.32, M.dark, 48));
          const rim = mesh(new T.TorusGeometry(R, 0.09, 10, 48), M.gear1); rim.rotation.y = Math.PI / 2; spin.add(rim);
          for (let i = 0; i < 5; i++) { const s = mesh(new T.BoxGeometry(0.36, R * 0.85, 0.12), M.steel); const a = i / 5 * Math.PI * 2; s.position.set(0, Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45); s.rotation.x = -a; spin.add(s); }
          const mk = mesh(new T.BoxGeometry(0.38, 0.25, 0.25), M.arrow); mk.position.set(0, R * 0.92, 0); spin.add(mk);
          up(f => { const a = sx * ang(f, 0); spin.rotation.x = a; sh.spin.rotation.x = a; });
          break;
        }
        case 'KR': {
          const s1 = rod(V(-2, AX, 0), V(-1.3, AX, 0), 0.1, M.steel, true), s2 = rod(V(1.3, AX, 0), V(2, AX, 0), 0.1, M.steel, true);
          g.add(s1.g, s2.g);
          const p1 = new T.Group(), p2 = new T.Group(); p1.position.set(-1.3, AX, 0); p2.position.set(1.3, AX, 0);
          p1.add(discX(0.55, 0.1, M.steel)); p2.add(discX(0.55, 0.1, M.steel));
          const m1 = mesh(new T.BoxGeometry(0.14, 0.18, 0.18), M.key); m1.position.y = 0.45; p1.add(m1);
          const m2 = m1.clone(); p2.add(m2);
          g.add(p1, p2);
          const cl = coil(M.springR, 0.48, 7, 0.06); cl.mesh.position.y = AX; g.add(cl.mesh);
          up(f => {
            const a1 = sx * ang(f, 0), a2 = sx * ang(f, 1);
            s1.spin.rotation.x = a1; s2.spin.rotation.x = a2; p1.rotation.x = a1; p2.rotation.x = a2;
            cl.set(-1.25, 1.25, a1, a2);
          });
          break;
        }
        case 'BR': {
          const s1 = rod(V(-2, AX, 0), V(-0.9, AX, 0), 0.1, M.steel, true), s2 = rod(V(0.1, AX, 0), V(2, AX, 0), 0.1, M.steel, true);
          g.add(s1.g, s2.g);
          const cup = new T.Group(); cup.position.set(-0.4, AX, 0); g.add(cup);
          const housing = mesh(new T.CylinderGeometry(0.7, 0.7, 1.1, 32, 1, true), M.glass); housing.rotation.z = Math.PI / 2; cup.add(housing);
          cup.add(discX(0.72, 0.08, M.dark)); cup.children[1].position.x = -0.55;
          const ribs = mesh(new T.BoxGeometry(1.1, 0.06, 0.06), M.key); ribs.position.y = 0.68; cup.add(ribs);
          const rotor = new T.Group(); rotor.position.set(-0.1, AX, 0); g.add(rotor);
          rotor.add(discX(0.55, 0.16, M.gear1));
          const vane = mesh(new T.BoxGeometry(0.17, 1.0, 0.12), M.dark); rotor.add(vane);
          up(f => { const a1 = sx * ang(f, 0), a2 = sx * ang(f, 1); s1.spin.rotation.x = a1; cup.rotation.x = a1; s2.spin.rotation.x = a2; rotor.rotation.x = a2; });
          break;
        }
        case 'TS': case 'WS': {
          // unidade de acionamento com eixo ao longo do símbolo (z local)
          const body = mesh(new T.CylinderGeometry(0.75, 0.75, 1.4, 32), M.src); body.rotation.x = Math.PI / 2; body.position.set(0, AX, 0.1); g.add(body);
          const ring = mesh(new T.TorusGeometry(0.95, 0.06, 8, 32, Math.PI * 1.5), M.arrow); ring.position.set(0, AX, -0.75); g.add(ring);
          const cone = mesh(new T.ConeGeometry(0.15, 0.32, 12), M.arrow); cone.position.set(0.95, AX - 0.1, -0.75); g.add(cone);
          const s1 = rod(V(0, AX, -2), V(0, AX, -0.6), 0.1, M.steel, true), s2 = rod(V(0, AX, 0.8), V(0, AX, 2), 0.1, M.steel, true);
          g.add(s1.g, s2.g);
          const ped = mesh(new T.BoxGeometry(1.0, AX - 0.6, 1.2), M.base); ped.position.set(0, (AX - 0.6) / 2, 0.1); g.add(ped);
          up(f => { s1.spin.rotation.x = sz * ang(f, 0); s2.spin.rotation.x = sz * ang(f, 1); const v = f.q(c.id, 'th'); ring.rotation.z = v >= 0 ? 0 : Math.PI; ring.scale.setScalar(0.6 + 0.4 * f.qn(c.id, 'th')); });
          break;
        }
        case 'RGND': {
          const ped = mesh(new T.BoxGeometry(0.9, AX, 1.1), M.wall); ped.position.set(0, AX / 2, 0.35); g.add(ped);
          const bearing = mesh(new T.CylinderGeometry(0.42, 0.42, 0.5, 24), M.wallEdge); bearing.position.set(0, AX, 0.35); bearing.rotation.x = Math.PI / 2; g.add(bearing);
          const foot = mesh(new T.BoxGeometry(1.6, 0.15, 1.6), M.wallEdge); foot.position.set(0, 0.075, 0.35); g.add(foot);
          break;
        }
        case 'GEAR': {
          const n = Math.max(0.05, P('n') || 1);
          let z1 = 12; if (n < 1) z1 = Math.max(12, Math.round(12 / n));
          const z2 = Math.max(6, Math.round(z1 * n));
          const rp1 = 2 * z1 / (z1 + z2), rp2 = 2 * z2 / (z1 + z2);
          const housing = mesh(new T.BoxGeometry(1.1, 0.25, 4.6), M.base); housing.position.set(0, 0.12, 0); g.add(housing);
          const g1 = gearMesh(z1, rp1 * 0.97, 0.45, M.gear1), g2 = gearMesh(z2, rp2 * 0.97, 0.45, M.gear2);
          g1.position.set(0, AX, -1); g2.position.set(0, AX, 1); g.add(g1, g2);
          const s1 = rod(V(-3, AX, -1), V(0.4, AX, -1), 0.1, M.steel, true), s2 = rod(V(-0.4, AX, 1), V(3, AX, 1), 0.1, M.steel, true);
          g.add(s1.g, s2.g);
          for (const zz of [-1, 1]) { const p = mesh(new T.BoxGeometry(0.3, AX, 0.5), M.wall); p.position.set(zz === -1 ? -0.7 : 0.7, AX / 2, zz); g.add(p); }
          const ph2 = Math.PI / z2;
          up(f => { const a1 = sx * ang(f, 0), a2 = sx * ang(f, 1); g1.rotation.x = a1; s1.spin.rotation.x = a1; g2.rotation.x = ph2 + a2; s2.spin.rotation.x = a2; });
          break;
        }

        /* ───── translacionais ───── */
        case 'M': {
          const grp = new T.Group(); g.add(grp);
          const b = mesh(new T.BoxGeometry(1.9, 1.9, 1.9), M.mass); b.position.y = AX; grp.add(b);
          const tag = mesh(new T.BoxGeometry(1.92, 0.3, 1.92), M.dark); tag.position.y = AX + 0.55; grp.add(tag);
          grp.add(rod(V(-2, AX, 0), V(-0.9, AX, 0), 0.075, M.chrome).g, rod(V(0.9, AX, 0), V(2, AX, 0), 0.075, M.chrome).g);
          const wl = mesh(new T.BoxGeometry(0.5, 0.25, 1.4), M.dark); wl.position.set(0, 0.125, 0);
          const rail = mesh(new T.BoxGeometry(4.4, 0.06, 0.25), M.wallEdge); rail.position.set(0, 0.03, 0); g.add(rail);
          for (const xx of [-0.6, 0.6]) { const w = mesh(new T.CylinderGeometry(0.17, 0.17, 1.6, 16), M.black); w.rotation.x = Math.PI / 2; w.position.set(xx, AX - 1.0, 0); grp.add(w); }
          up(f => { grp.position.x = sx * disp(f, 0); });
          break;
        }
        case 'K': {
          const a = new T.Group(), b = new T.Group(); g.add(a, b);
          a.add(rod(V(-2, AX, 0), V(-1.3, AX, 0), 0.075, M.chrome).g); a.add(Object.assign(discX(0.5, 0.08, M.steel), {})); a.children[1].position.set(-1.3, AX, 0);
          b.add(rod(V(1.3, AX, 0), V(2, AX, 0), 0.075, M.chrome).g); b.add(discX(0.5, 0.08, M.steel)); b.children[1].position.set(1.3, AX, 0);
          const cl = coil(M.spring, 0.42, 8, 0.06); cl.mesh.position.y = AX; g.add(cl.mesh);
          up(f => { const d1 = sx * disp(f, 0), d2 = sx * disp(f, 1); a.position.x = d1; b.position.x = d2; cl.set(-1.3 + d1, 1.3 + d2); });
          break;
        }
        case 'B': {
          const a = new T.Group(), b = new T.Group(); g.add(a, b);
          a.add(rod(V(-2, AX, 0), V(-1.0, AX, 0), 0.075, M.chrome).g);
          const hs = mesh(new T.CylinderGeometry(0.55, 0.55, 1.7, 28, 1, true), M.glass); hs.rotation.z = Math.PI / 2; hs.position.set(-0.15, AX, 0); a.add(hs);
          const bot = discX(0.56, 0.08, M.dark); bot.position.set(-1.0, AX, 0); a.add(bot);
          const oil = mesh(new T.CylinderGeometry(0.5, 0.5, 1.6, 20), new T.MeshStandardMaterial({ color: 0xffb04a, transparent: true, opacity: 0.18 })); oil.rotation.z = Math.PI / 2; oil.position.set(-0.15, AX, 0); a.add(oil);
          b.add(rod(V(0.1, AX, 0), V(2, AX, 0), 0.075, M.chrome).g);
          const pis = discX(0.48, 0.14, M.gear1); pis.position.set(0.1, AX, 0); b.add(pis);
          up(f => { a.position.x = sx * disp(f, 0); b.position.x = sx * disp(f, 1); });
          break;
        }
        case 'FS': case 'US': {
          const body = mesh(new T.CylinderGeometry(0.55, 0.55, 1.6, 24), M.src); body.rotation.x = Math.PI / 2; body.position.set(0, AX, 0.4); g.add(body);
          const ped = mesh(new T.BoxGeometry(0.9, AX - 0.5, 1.2), M.base); ped.position.set(0, (AX - 0.5) / 2, 0.4); g.add(ped);
          const arr = new T.Group(); arr.position.set(0, AX, -0.45); g.add(arr);
          const shaft = mesh(new T.CylinderGeometry(0.09, 0.09, 1, 12), M.arrow); shaft.position.y = 0.5; arr.add(shaft);
          const head = mesh(new T.ConeGeometry(0.25, 0.45, 16), M.arrow); head.position.y = 1.2; arr.add(head);
          arr.rotation.x = -Math.PI / 2;
          lead(V(0, AX, -2), V(0, AX, -0.4), 0.07, M.chrome); lead(V(0, AX, 1.2), V(0, AX, 2), 0.07, M.chrome);
          up(f => { const v = f.q(c.id, 'th'), k = f.qn(c.id, 'th'); arr.scale.set(1, Math.max(0.05, k) * 1.2, 1); arr.rotation.x = v >= 0 ? -Math.PI / 2 : Math.PI / 2; arr.visible = k > 0.01; });
          break;
        }
        case 'TGND': {
          // largura da parede cobre os fios que chegam ao pino pelo plano da parede
          let span = 0; const horiz = c.rot % 2 === 0;
          for (const w of doc.wires) for (const [ax, ay, bx, by] of [[w.x1, w.y1, w.x2, w.y2], [w.x2, w.y2, w.x1, w.y1]]) {
            if (ax !== c.x || ay !== c.y) continue;
            if (horiz && by === ay) span = Math.max(span, Math.abs(bx - ax));
            if (!horiz && bx === ax) span = Math.max(span, Math.abs(by - ay));
          }
          wall(g, Math.max(2.4, 2 * span + 1.4)); break;
        }

        /* ───── eletromecânicos ───── */
        case 'MOTOR': case 'VCOIL': {
          const isM = c.type === 'MOTOR';
          const R = Math.min(1.05, AX - 0.12);
          const body = mesh(new T.CylinderGeometry(R, R, 2.6, 36), M.motor.clone()); body.rotation.z = Math.PI / 2; body.position.set(-0.6, AX, 0); g.add(body);
          const cap1 = discX(R * 0.92, 0.25, M.motorCap); cap1.position.set(-2.0, AX, 0); g.add(cap1);
          const cap2 = discX(R * 0.92, 0.25, M.motorCap); cap2.position.set(0.8, AX, 0); g.add(cap2);
          for (let i = 0; i < 10; i++) { const fin = mesh(new T.BoxGeometry(2.0, 0.08, 0.18), M.steel); const a = i / 10 * Math.PI * 2; fin.position.set(-0.6, AX + Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02)); fin.rotation.x = -a; g.add(fin); }
          const foot = mesh(new T.BoxGeometry(2.4, AX - R + 0.15, 1.6), M.base); foot.position.set(-0.6, (AX - R + 0.15) / 2, 0); g.add(foot);
          lead(V(-3, EH, -1), V(-2.15, AX + 0.35, -0.45), 0.05, M.wire); lead(V(-3, EH, 1), V(-2.15, AX - 0.35, 0.45), 0.05, M.wire);
          const tp = mesh(new T.SphereGeometry(0.1, 12, 8), M.arrow); tp.position.set(-2.15, AX + 0.35, -0.45); g.add(tp);
          if (isM) {
            const sh = rod(V(0.9, AX, 0), V(3, AX, 0), 0.11, M.steel, true); g.add(sh.g);
            const hub = new T.Group(); hub.position.set(1.4, AX, 0); g.add(hub);
            hub.add(discX(0.32, 0.25, M.dark));
            for (let i = 0; i < 3; i++) { const bl = mesh(new T.BoxGeometry(0.06, 0.55, 0.16), M.key); const a = i / 3 * Math.PI * 2; bl.position.set(0, Math.cos(a) * 0.4, Math.sin(a) * 0.4); bl.rotation.x = -a; hub.add(bl); }
            up(f => { const a = sx * ang(f, 2); sh.spin.rotation.x = a; hub.rotation.x = a; const k = f.qn(c.id, 'I'); body.material.emissive.setRGB(k * 0.4, k * 0.08, 0); });
          } else {
            const mv = new T.Group(); g.add(mv);
            mv.add(rod(V(0.9, AX, 0), V(3, AX, 0), 0.09, M.chrome).g);
            const cc = discX(R * 0.6, 0.35, M.copper); cc.position.set(1.0, AX, 0); mv.add(cc);
            up(f => { mv.position.x = sx * disp(f, 2); const k = f.qn(c.id, 'I'); body.material.emissive.setRGB(k * 0.4, k * 0.08, 0); });
          }
          break;
        }
        case 'RACK': {
          const r = P('r') || 0.05;
          const rp = Math.max(0.3, Math.min(1.4, r * this.dispScale));
          const zp = Math.max(8, Math.round(rp * 14));
          const pin = gearMesh(zp, rp, 0.5, M.gear1); pin.position.set(1, AX, 0); g.add(pin);
          const sh = rod(V(-3, AX, 0), V(1.3, AX, 0), 0.1, M.steel, true); g.add(sh.g);
          const ped = mesh(new T.BoxGeometry(0.35, AX, 0.6), M.wall); ped.position.set(0.35, AX / 2, 0); g.add(ped);
          // cremalheira acima do pinhão, ao longo de z local
          const mod = 2 * rp / zp, pitch = Math.PI * mod;
          const rack = new T.Group(); g.add(rack);
          const yR = AX + rp + mod * 0.5;
          const bar = mesh(new T.BoxGeometry(0.5, 0.35, 6.4), M.gear2); bar.position.set(1, yR + 0.17 + mod * 0.5, 0.2); rack.add(bar);
          const nT = Math.floor(6.2 / pitch);
          for (let i = 0; i < nT; i++) { const tth = mesh(new T.BoxGeometry(0.5, mod * 1.6, pitch * 0.42), M.gear2); tth.position.set(1, yR - mod * 0.2 + 0.0, -2.9 + i * pitch + pitch * 0.5); rack.add(tth); }
          const post = mesh(new T.BoxGeometry(0.2, yR + 0.3 - AX, 0.2), M.chrome); post.position.set(1, (yR + 0.3 + AX) / 2, 3.25); rack.add(post);
          rack.add(rod(V(1, AX, 2.8), V(1, AX, 3), 0.075, M.chrome).g);
          const guide = mesh(new T.BoxGeometry(0.7, 0.1, 6.8), M.wallEdge); guide.position.set(1, yR + 0.55 + mod, 0.2); g.add(guide);
          up(f => { const a = sx * ang(f, 0); sh.spin.rotation.x = a; pin.rotation.x = a + Math.PI / zp; rack.position.z = sz * disp(f, 1); });
          break;
        }
        case 'TACHO': case 'VSENS': {
          const body = mesh(new T.BoxGeometry(1.6, 1.0, 1.1), c.type === 'TACHO' ? M.motorCap : M.dark); body.position.set(-0.1, AX, 0); g.add(body);
          const ped = mesh(new T.BoxGeometry(1.2, AX - 0.5, 0.9), M.base); ped.position.set(-0.1, (AX - 0.5) / 2, 0); g.add(ped);
          lead(V(0.7, AX, 0), V(2, EH, 0), 0.045, M.wire);
          if (c.type === 'TACHO') {
            const sh = rod(V(-2, AX, 0), V(-0.8, AX, 0), 0.08, M.steel, true); g.add(sh.g);
            const disc = discX(0.4, 0.06, M.key); disc.position.set(-1.2, AX, 0); g.add(disc);
            up(f => { sh.spin.rotation.x = sx * ang(f, 0); disc.rotation.x = sx * ang(f, 0); });
          } else {
            const mv = new T.Group(); g.add(mv);
            mv.add(rod(V(-2, AX, 0), V(-0.8, AX, 0), 0.06, M.chrome).g);
            up(f => { mv.position.x = sx * disp(f, 0); });
          }
          const led = mesh(new T.SphereGeometry(0.1, 10, 8), M.led.clone()); led.position.set(0.3, AX + 0.52, 0); g.add(led);
          up(f => { const k = Math.min(1, Math.abs(f.across(nodes[1])) / 5); led.material.emissive.setRGB(k * 0.2, k, k * 0.5); });
          break;
        }
        default:
          if (d.view3d) d.view3d({ T, g, M, mesh, rod, V, discX, coil, gearMesh, AX, EH, FH: MS.FH3D, TH: MS.TH3D, nodes, P, c, up, sx, sz, ang, disp, lead, elecLeads, view: this });
      }
      this.root.add(g);
    }
    this.bbox = isFinite(bx0) ? { x0: bx0, y0: by0, x1: bx1, y1: by1 } : null;
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
};
MS.AX3D = 1.3;   // altura dos eixos mecânicos
MS.FH3D = 0.75;  // altura das tubulações hidráulicas
MS.TH3D = 0.35;  // altura das barras térmicas
MS.EH3D = 0.25;  // altura dos componentes/fios elétricos
