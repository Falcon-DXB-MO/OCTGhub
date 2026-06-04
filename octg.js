/* ============================================================
   OCTG Hub — interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- NAV scroll state ---------- */
  const nav = document.getElementById("nav");
  const hero = document.querySelector(".hero");
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("nav--scrolled", y > 24);
    // nav sits over dark hero until we scroll past most of it
    const overDark = hero ? y < hero.offsetHeight - 120 : false;
    nav.classList.toggle("nav--on-dark", overDark);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- roadmap phase fill on view ---------- */
  const phaseIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.style.setProperty("--p", e.target.dataset.p || "1");
          phaseIO.unobserve(e.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  document.querySelectorAll(".phase").forEach((el) => phaseIO.observe(el));

  /* ============================================================
     Triaxial design-limit plot
     X = axial force (klbf) · Y = differential pressure (psi)
     Safe envelope = tilted von Mises ellipse (illustrative).
     SF = load multiplier from the unloaded origin to the boundary.
     ============================================================ */
  const svg = document.getElementById("limitPlot");
  if (!svg) return;

  const W = 560, H = 444;
  const PADL = 56, PADR = 20, PADT = 22, PADB = 46;
  const PW = W - PADL - PADR;
  const PH = H - PADT - PADB;

  // data ranges
  const XMIN = -500, XMAX = 900;     // klbf  (compression .. tension)
  const YMIN = -9000, YMAX = 12000;  // psi   (collapse .. burst)

  // context limit lines (data units)
  const BURST = 9800, COLLAPSE = -6400, TENSION = 760, COMPRESSION = -360;

  // ellipse (fraction-of-plot space), tilted
  const Cf = { x: 0.47, y: 0.5 };
  const TH = (27 * Math.PI) / 180;
  const e1 = { x: Math.cos(TH), y: Math.sin(TH) };
  const e2 = { x: -Math.sin(TH), y: Math.cos(TH) };
  const s1 = 0.43, s2 = 0.305;

  // operating point (data units) — live state
  let op = { x: 320, y: 6200 };

  // ---------- coordinate helpers ----------
  const xToFx = (x) => (x - XMIN) / (XMAX - XMIN);
  const yToFy = (y) => (y - YMIN) / (YMAX - YMIN);
  const fxToX = (fx) => XMIN + fx * (XMAX - XMIN);
  const fyToY = (fy) => YMIN + fy * (YMAX - YMIN);
  const fxToPx = (fx) => PADL + fx * PW;
  const fyToPy = (fy) => PADT + (1 - fy) * PH;
  const pxToFx = (px) => (px - PADL) / PW;
  const pyToFy = (py) => 1 - (py - PADT) / PH;

  const O = { x: xToFx(0), y: yToFy(0) }; // unloaded origin in frac space

  // ---------- SF math ----------
  function proj(frac, e) {
    return (frac.x - Cf.x) * e.x + (frac.y - Cf.y) * e.y;
  }
  // scale factor from origin O through point P (frac) to ellipse boundary
  function safetyFactor(pf) {
    const v = { x: pf.x - O.x, y: pf.y - O.y };
    const w = { x: O.x - Cf.x, y: O.y - Cf.y };
    const a1 = w.x * e1.x + w.y * e1.y, a2 = w.x * e2.x + w.y * e2.y;
    const b1 = v.x * e1.x + v.y * e1.y, b2 = v.x * e2.x + v.y * e2.y;
    const A = (b1 * b1) / (s1 * s1) + (b2 * b2) / (s2 * s2);
    const B = (2 * a1 * b1) / (s1 * s1) + (2 * a2 * b2) / (s2 * s2);
    const C = (a1 * a1) / (s1 * s1) + (a2 * a2) / (s2 * s2) - 1;
    if (Math.abs(A) < 1e-9) return 99;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return 99;
    const sq = Math.sqrt(disc);
    const k1 = (-B + sq) / (2 * A), k2 = (-B - sq) / (2 * A);
    const k = Math.max(k1, k2); // boundary in +v direction
    return k > 0 ? k : 0.01;
  }
  function insideEllipse(pf) {
    const p1 = proj(pf, e1), p2 = proj(pf, e2);
    return (p1 * p1) / (s1 * s1) + (p2 * p2) / (s2 * s2) <= 1;
  }

  // ---------- SVG build ----------
  const NS = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  function el(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // static layers
  const gGrid = el("g", {});
  const gZone = el("g", {});
  const gLimits = el("g", {});
  const gAxes = el("g", {});
  const gDyn = el("g", {});
  svg.append(gGrid, gZone, gLimits, gAxes, gDyn);

  // grid + ticks
  const xticks = [-500, 0, 500, 900];
  const yticks = [-9000, -6000, -3000, 0, 3000, 6000, 9000, 12000];
  xticks.forEach((xv) => {
    const px = fxToPx(xToFx(xv));
    gGrid.append(el("line", { x1: px, y1: PADT, x2: px, y2: PADT + PH,
      stroke: "rgba(255,255,255,.06)", "stroke-width": 1 }));
    const t = el("text", { x: px, y: H - 26, fill: "var(--d-fg-3)", "font-size": 10,
      "text-anchor": "middle", "font-family": "var(--ff-mono)" });
    t.textContent = xv;
    gAxes.append(t);
  });
  yticks.forEach((yv) => {
    const py = fyToPy(yToFy(yv));
    gGrid.append(el("line", { x1: PADL, y1: py, x2: PADL + PW, y2: py,
      stroke: "rgba(255,255,255,.06)", "stroke-width": 1 }));
    const t = el("text", { x: PADL - 8, y: py + 3, fill: "var(--d-fg-3)", "font-size": 10,
      "text-anchor": "end", "font-family": "var(--ff-mono)" });
    t.textContent = (yv / 1000) + "k";
    gAxes.append(t);
  });

  // axis titles
  const xt = el("text", { x: PADL + PW / 2, y: H - 8, fill: "var(--d-fg-2)", "font-size": 10.5,
    "text-anchor": "middle", "font-family": "var(--ff-mono)", "letter-spacing": ".08em" });
  xt.textContent = "AXIAL FORCE · klbf";
  gAxes.append(xt);
  const yt = el("text", { x: 14, y: PADT + PH / 2, fill: "var(--d-fg-2)", "font-size": 10.5,
    "text-anchor": "middle", "font-family": "var(--ff-mono)", "letter-spacing": ".08em",
    transform: `rotate(-90 14 ${PADT + PH / 2})` });
  yt.textContent = "DIFFERENTIAL PRESSURE · psi";
  gAxes.append(yt);

  // zero axes
  gAxes.append(el("line", { x1: fxToPx(O.x), y1: PADT, x2: fxToPx(O.x), y2: PADT + PH,
    stroke: "rgba(255,255,255,.22)", "stroke-width": 1 }));
  gAxes.append(el("line", { x1: PADL, y1: fyToPy(O.y), x2: PADL + PW, y2: fyToPy(O.y),
    stroke: "rgba(255,255,255,.22)", "stroke-width": 1 }));

  // safe envelope (ellipse path)
  function ellipsePath() {
    let d = "";
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const lx = s1 * Math.cos(a), ly = s2 * Math.sin(a);
      const fx = Cf.x + lx * e1.x + ly * e2.x;
      const fy = Cf.y + lx * e1.y + ly * e2.y;
      d += (i === 0 ? "M" : "L") + fxToPx(fx).toFixed(1) + " " + fyToPy(fy).toFixed(1);
    }
    return d + "Z";
  }
  const zone = el("path", { d: ellipsePath(), fill: "rgba(95,160,216,.13)",
    stroke: "var(--d-steel)", "stroke-width": 1.5 });
  gZone.append(zone);
  // zone label
  const zlab = el("text", { x: fxToPx(Cf.x), y: fyToPy(Cf.y) - 2, fill: "var(--d-steel)",
    "font-size": 10, "text-anchor": "middle", "font-family": "var(--ff-mono)",
    "letter-spacing": ".1em", opacity: .9 });
  zlab.textContent = "VME ENVELOPE";
  gZone.append(zlab);

  // context limit lines
  function limitLine(coord, axis, label, color) {
    let x1, y1, x2, y2, tx, ty, anchor;
    if (axis === "y") {
      const py = fyToPy(yToFy(coord));
      x1 = PADL; x2 = PADL + PW; y1 = y2 = py;
      tx = PADL + PW - 6; ty = py - 5; anchor = "end";
    } else {
      const px = fxToPx(xToFx(coord));
      y1 = PADT; y2 = PADT + PH; x1 = x2 = px;
      tx = px + 5; ty = PADT + 12; anchor = "start";
    }
    gLimits.append(el("line", { x1, y1, x2, y2, stroke: color, "stroke-width": 1,
      "stroke-dasharray": "3 4", opacity: .55 }));
    const t = el("text", { x: tx, y: ty, fill: color, "font-size": 9,
      "text-anchor": anchor, "font-family": "var(--ff-mono)", "letter-spacing": ".06em", opacity: .85 });
    t.textContent = label;
    gLimits.append(t);
  }
  limitLine(BURST, "y", "BURST · API 5C3", "var(--d-amber)");
  limitLine(COLLAPSE, "y", "COLLAPSE", "var(--d-amber)");
  limitLine(TENSION, "x", "TENSION", "rgba(169,180,192,.8)");

  // ---------- dynamic layer (load line, rating, handle) ----------
  const loadLine = el("line", { stroke: "rgba(224,171,77,.55)", "stroke-width": 1.2,
    "stroke-dasharray": "2 3" });
  const ratingDot = el("circle", { r: 4, fill: "none", stroke: "var(--d-amber)", "stroke-width": 1.4 });
  const opOuter = el("circle", { r: 11, fill: "rgba(224,171,77,.18)", stroke: "var(--d-amber)",
    "stroke-width": 1.4 });
  const opInner = el("circle", { r: 4.5, fill: "var(--d-amber)" });
  gDyn.append(loadLine, ratingDot, opOuter, opInner);

  // readout DOM
  const sfNum = document.getElementById("sfNum");
  const rdAx = document.getElementById("rdAxial");
  const rdPr = document.getElementById("rdPress");
  const rdStat = document.getElementById("rdStatus");

  function render() {
    const pf = { x: xToFx(op.x), y: yToFy(op.y) };
    const px = fxToPx(pf.x), py = fyToPy(pf.y);
    const sf = safetyFactor(pf);

    // rating point on boundary along load line from origin
    const rfx = O.x + (pf.x - O.x) * sf;
    const rfy = O.y + (pf.y - O.y) * sf;
    const rpx = fxToPx(rfx), rpy = fyToPy(rfy);

    loadLine.setAttribute("x1", fxToPx(O.x));
    loadLine.setAttribute("y1", fyToPy(O.y));
    loadLine.setAttribute("x2", rpx);
    loadLine.setAttribute("y2", rpy);
    ratingDot.setAttribute("cx", rpx);
    ratingDot.setAttribute("cy", rpy);
    [opOuter, opInner].forEach((c) => { c.setAttribute("cx", px); c.setAttribute("cy", py); });

    // readouts
    const sfClamped = Math.min(sf, 9.9);
    if (sfNum) {
      sfNum.textContent = sfClamped.toFixed(2);
      sfNum.classList.toggle("fail", sf < 1.0);
    }
    if (rdAx) rdAx.textContent = Math.round(op.x) + " klbf";
    if (rdPr) rdPr.textContent = Math.round(op.y).toLocaleString() + " psi";
    if (rdStat) {
      let label, color;
      if (sf >= 1.25) { label = "PASS · DF≥1.25"; color = "var(--ok)"; }
      else if (sf >= 1.0) { label = "MARGINAL"; color = "var(--d-amber)"; }
      else { label = "EXCEEDS LIMIT"; color = "var(--danger)"; }
      rdStat.textContent = label;
      rdStat.style.color = color;
    }
    const inside = insideEllipse(pf);
    opInner.setAttribute("fill", inside ? "var(--d-amber)" : "var(--danger)");
    opOuter.setAttribute("stroke", inside ? "var(--d-amber)" : "var(--danger)");
  }

  // ---------- drag ----------
  let dragging = false;
  function clientToData(evt) {
    const rect = svg.getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (W / rect.width);
    const sy = (evt.clientY - rect.top) * (H / rect.height);
    let fx = pxToFx(sx), fy = pyToFy(sy);
    fx = Math.max(0.01, Math.min(0.99, fx));
    fy = Math.max(0.01, Math.min(0.99, fy));
    return { x: fxToX(fx), y: fyToY(fy) };
  }
  function startDrag(evt) {
    dragging = true;
    svg.classList.add("grabbing");
    op = clientToData(evt);
    render();
    evt.preventDefault();
  }
  function moveDrag(evt) {
    if (!dragging) return;
    op = clientToData(evt);
    render();
  }
  function endDrag() { dragging = false; svg.classList.remove("grabbing"); }

  svg.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);

  render();

  // gentle auto-demo nudge until first interaction (draws the eye)
  let demoed = false;
  svg.addEventListener("pointerdown", () => { demoed = true; });
  let t0 = null;
  function demo(ts) {
    if (demoed) return;
    if (t0 === null) t0 = ts;
    const k = (ts - t0) / 1000;
    op = { x: 320 + Math.sin(k * 0.9) * 230, y: 6200 + Math.cos(k * 0.9) * 2600 };
    render();
    if (k < 9) requestAnimationFrame(demo);
    else if (!demoed) { op = { x: 320, y: 6200 }; render(); }
  }
  // only auto-demo if motion is allowed
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTimeout(() => { if (!demoed) requestAnimationFrame(demo); }, 1400);
  }
})();
