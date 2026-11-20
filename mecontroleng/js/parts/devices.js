/* ============================================================
   MeControlEng — Modelos de dispositivos não lineares
   Cada modelo devolve, para um vetor de tensões de terminal v,
   { v0, i, G }: ponto de linearização, correntes que ENTRAM no
   dispositivo por cada terminal e a matriz jacobiana ∂i/∂v.
   O solver aplica Newton-Raphson com esses dados.
   ============================================================ */
'use strict';
(function () {
  const VT = 0.025852, GMIN = 1e-12;
  const dev = MS.dev = { VT };

  /* limitação de junção pn (SPICE pnjlim) — evita estouro exponencial */
  dev.pnjlim = (vnew, vold, vt, vcrit) => {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      if (vold > 0) { const arg = 1 + (vnew - vold) / vt; vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit; }
      else vnew = vt * Math.log(Math.max(vnew / vt, 1e-30));
    }
    return vnew;
  };
  dev.vcrit = (Is, vt) => vt * Math.log(vt / (Math.SQRT2 * Is));
  /* exponencial com continuação linear (derivada contínua) */
  const LIM = 40;
  dev.expl = x => (x < LIM ? Math.exp(x) : Math.exp(LIM) * (1 + x - LIM));
  dev.dexpl = x => (x < LIM ? Math.exp(x) : Math.exp(LIM));
  const junc = (v, Is, vt) => ({ i: Is * (dev.expl(v / vt) - 1), g: Is / vt * dev.dexpl(v / vt) });

  /* ── diodo / LED / Zener: terminais [ânodo, cátodo] ── */
  dev.diode = (p) => {
    const st = { vd: 0 };
    const vcr = dev.vcrit(p.Is, p.vt);
    const fn = (v, lim) => {
      let vd = v[0] - v[1];
      if (lim) {
        if (p.Vz && vd < -p.Vz * 0.5) {
          const u = dev.pnjlim(-vd - p.Vz, -st.vd - p.Vz, p.vtz, dev.vcrit(p.Isz, p.vtz));
          vd = -u - p.Vz;
        } else vd = dev.pnjlim(vd, st.vd, p.vt, vcr);
        st.vd = vd;
      }
      const f = junc(vd, p.Is, p.vt);
      let i = f.i, g = f.g + GMIN;
      if (p.Vz) {
        const x = (-vd - p.Vz) / p.vtz;
        i -= p.Isz * dev.expl(x); g += p.Isz / p.vtz * dev.dexpl(x);
      }
      return { v0: [v[1] + vd, v[1]], i: [i, -i], G: [[g, -g], [-g, g]] };
    };
    fn.st = st;
    return fn;
  };

  /* ── BJT (Ebers-Moll, transporte): terminais [C, B, E]; pol = +1 NPN, −1 PNP ── */
  dev.bjt = (p, pol) => {
    const st = { vbe: 0, vbc: 0 };
    const vt = VT, vcr = dev.vcrit(p.Is, vt);
    const fn = (v, lim) => {
      const s = pol;
      let vbe = s * (v[1] - v[2]), vbc = s * (v[1] - v[0]);
      if (lim) { vbe = dev.pnjlim(vbe, st.vbe, vt, vcr); vbc = dev.pnjlim(vbc, st.vbc, vt, vcr); st.vbe = vbe; st.vbc = vbc; }
      const F = junc(vbe, p.Is, vt), Rr = junc(vbc, p.Is, vt);
      const gf = F.g + GMIN, gr = Rr.g + GMIN;
      const Ic = F.i - Rr.i - Rr.i / p.br, Ib = F.i / p.bf + Rr.i / p.br;
      // derivadas em relação a vbe, vbc
      const dIc = [gf, -gr - gr / p.br], dIb = [gf / p.bf, gr / p.br];
      // tensões de terminal → (vbe, vbc): dvbe/d[vC,vB,vE] = s[0,1,−1], dvbc = s[−1,1,0]
      const row = d => [-d[1], d[0] + d[1], -d[0]];
      const gC = row(dIc), gB = row(dIb), gE = gC.map((x, k) => -(x + gB[k]));
      const vB = v[1];
      const v0 = [vB - s * vbc, vB, vB - s * vbe];
      return { v0, i: [s * Ic, s * Ib, -s * (Ic + Ib)], G: [gC, gB, gE] };
    };
    fn.st = st;
    return fn;
  };

  /* ── MOSFET (nível 1, lei quadrática): terminais [D, G, S]; pol = +1 canal N, −1 canal P ── */
  dev.mos = (p, pol) => {
    const st = { vgs: 0 };
    const core = (vgs, vds) => {   // vds ≥ 0
      const vov = vgs - p.Vth;
      if (vov <= 0) return { id: 0, gm: 0, gds: 0 };
      const cl = 1 + p.lam * vds;
      if (vds < vov) return { id: p.K * (vov * vds - vds * vds / 2) * cl, gm: p.K * vds * cl, gds: p.K * (vov - vds) * cl + p.K * (vov * vds - vds * vds / 2) * p.lam };
      return { id: p.K / 2 * vov * vov * cl, gm: p.K * vov * cl, gds: p.K / 2 * vov * vov * p.lam };
    };
    const fn = (v, lim) => {
      const s = pol;
      let vd = s * v[0], vg = s * v[1], vs = s * v[2];
      const rev = vd < vs;
      const vsrc = rev ? vd : vs;
      let vgs = vg - vsrc;
      if (lim) { if (Math.abs(vgs - st.vgs) > 1) vgs = st.vgs + Math.sign(vgs - st.vgs); st.vgs = vgs; vg = vsrc + vgs; }
      const gds0 = 1e-9;
      let r;
      if (!rev) {
        r = core(vg - vs, vd - vs);
        const dD = [r.gds + gds0, r.gm, -r.gm - r.gds - gds0];
        const i = r.id + gds0 * (vd - vs);
        return { v0: [s * vd, s * vg, s * vs], i: [s * i, 0, -s * i], G: [dD, [0, 0, 0], dD.map(x => -x)] };
      }
      r = core(vg - vd, vs - vd);
      const dS = [-r.gm - r.gds - gds0, r.gm, r.gds + gds0];   // d(Id')/d[vD,vG,vS]
      const i = r.id + gds0 * (vs - vd);
      return { v0: [s * vd, s * vg, s * vs], i: [-s * i, 0, s * i], G: [dS.map(x => -x), [0, 0, 0], dS] };
    };
    fn.st = st;
    return fn;
  };

  /* ── regulador linear (78xx): terminais [IN, GND, OUT] ── */
  dev.regulator = (p) => (v) => {
    const vin = v[0] - v[1], vo = v[2] - v[1];
    const a = p.Vreg, b = vin - p.Vdo, d = 0.05;
    const sq = Math.sqrt((a - b) * (a - b) + d * d);
    let E = (a + b - sq) / 2, dEdb = (1 + (a - b) / sq) / 2;
    if (E < 0) { E = 0; dEdb = 0; }
    const io = (E - vo) / p.Ro;
    // io depende de vIN, vGND, vOUT
    const dio = [dEdb / p.Ro, (-dEdb + 1) / p.Ro, -1 / p.Ro];
    const iq = p.Iq * Math.min(1, Math.max(0, vin / 2));
    const diq = vin > 0 && vin < 2 ? p.Iq / 2 : 0;
    return {
      v0: v.slice(),
      i: [io + iq, -iq, -io],
      G: [[dio[0] + diq, dio[1] - diq, dio[2]], [-diq, diq, 0], dio.map(x => -x)],
    };
  };

  /* ── amplificador operacional (saturação suave): terminais [+, −, OUT] (saída referida ao terra) ── */
  dev.opamp = (p) => (v) => {
    const mid = (p.Vp + p.Vn) / 2, half = (p.Vp - p.Vn) / 2 - 0.2;
    const x = p.A * (v[0] - v[1]) / half;
    const th = Math.tanh(Math.max(-30, Math.min(30, x)));
    const E = mid + half * th, dE = p.A * (1 - th * th);
    const io = (E - v[2]) / p.Ro;
    return { v0: v.slice(), i: [0, 0, -io], G: [[0, 0, 0], [0, 0, 0], [-dE / p.Ro, dE / p.Ro, 1 / p.Ro]] };
  };
})();
