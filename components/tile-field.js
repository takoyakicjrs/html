/* tile-field — 点阵字 + 颜色波 + 光标光斑（vanilla 移植，免构建）
   来源：fancy 组件集 tile-field/engine.ts，转成无依赖 vanilla JS。
   用法：var tf = new TileField(hostElement); tf.start();
   【DEBUG 版：所有 oklch 换成纯 hex，验证颜色格式是否导致字不可见】
*/
(function () {
  "use strict";
  var TAU = Math.PI * 2;
  var ROWS = [
    { word: "エレウシスの秘儀",
      font: function (px) { return "600 " + px + "px ui-sans-serif, system-ui, Arial, sans-serif"; },
      letterTrack: -0.02, fillFrac: 0.92, bright: false }
  ];
  var REST = "#8a8c90";     // 灰蓝（oklch 0.64 0.006 263 的 hex 近似；预览 webview 不支持 oklch）
  var BRAND_HUE = 263;
  var GLOW_HSL = "hsl(263,42%,46%)";   // 光标光斑（原 oklch 0.42 0.07 263）
  var SPARK = "70,100,180";
  var MAXSZ = 0.9, SPEED = 0.02;
  var HUE_STEPS = 24, ALPHA_STEPS = 6;
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function smoothstep(x, e0, e1) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function hash(x, y) { var r = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return r - Math.floor(r); }

  function TileField(host, _opts) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pointer-events-none absolute inset-0 block h-full w-full";
    this.ctx = this.canvas.getContext("2d");
    this.host.appendChild(this.canvas);
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = 0; this.viewH = 0; this.cell = 10; this.time = 0;
    this.n = 0;
    this.px = new Float32Array(0); this.py = new Float32Array(0);
    this.rowOf = new Uint8Array(0); this.hueSeed = new Float32Array(0);
    this.spark = new Uint8Array(0); this.lit = new Float32Array(0);
    this.seed = new Float32Array(0);
    this.hasPointer = false; this.rawX = 0; this.rawY = 0;
    this.lightX = 0; this.lightY = 0; this.lightSpeed = 0;
    this.raf = 0;
    this.stepL = new Float32Array(HUE_STEPS); this.stepC = new Float32Array(HUE_STEPS);
    this.stepS = new Float32Array(HUE_STEPS); this.stepH = new Float32Array(HUE_STEPS);
    this.resize();
    this.onMove = this.onMoveMethod.bind(this);
    this.onLeave = this.onLeaveMethod.bind(this);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerleave", this.onLeave);
  }

  TileField.prototype.resize = function () {
    var stage = this.host, canvas = this.canvas, ctx = this.ctx;
    var rect = stage.getBoundingClientRect();
    this.viewW = rect.width; this.viewH = rect.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cell = Math.max(2, Math.round(this.viewW / 460));
    var cell = this.cell, viewW = this.viewW, viewH = this.viewH;
    canvas.style.width = Math.round(viewW) + "px";
    canvas.style.height = Math.round(viewH) + "px";
    canvas.width = Math.ceil(viewW * this.dpr);
    canvas.height = Math.ceil(viewH * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var splits = ROWS.length === 1 ? [1] : [0.62, 0.38];
    var xs = [], ys = [], rw = [], sp = [], sd = [], hs = [];
    ROWS.forEach(function (row, ri) {
      var bandTop = 0, bandH = viewH;
      var sc = document.createElement("canvas");
      sc.width = Math.max(1, Math.floor(viewW));
      sc.height = Math.max(1, Math.floor(bandH));
      var s = sc.getContext("2d"); var sls = s;
      s.fillStyle = "#000"; s.textAlign = "center"; s.textBaseline = "middle";
      var fs = bandH * 0.9;
      sls.letterSpacing = (row.letterTrack * fs) + "px";
      s.font = row.font(fs);
      var measured = s.measureText(row.word).width || 1;
      fs *= (viewW * row.fillFrac) / measured;
      sls.letterSpacing = (row.letterTrack * fs) + "px";
      s.font = row.font(fs);
      s.fillText(row.word, viewW / 2, bandH / 2);
      var data = s.getImageData(0, 0, sc.width, sc.height).data;
      var cols = Math.ceil(viewW / cell), rows = Math.ceil(bandH / cell);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var lx = Math.floor(c * cell + cell / 2), ly = Math.floor(r * cell + cell / 2);
        if (lx >= sc.width || ly >= sc.height) continue;
        var a = (data[(ly * sc.width + lx) * 4 + 3] || 0) / 255;
        if (a <= 0.5) continue;
        var gx = lx, gy = ly + bandTop;
        xs.push(gx); ys.push(gy); rw.push(ri);
        sp.push(hash(gx + 7, gy - 3) > 0.82 ? 1 : 0);
        sd.push(hash(gx * 1.3, gy * 0.7));
        hs.push(hash(gx * 0.7 + 11, gy * 1.9 - 5));
      }
    });
    this.n = xs.length;
    this.px = new Float32Array(xs); this.py = new Float32Array(ys);
    this.rowOf = new Uint8Array(rw); this.spark = new Uint8Array(sp);
    this.seed = new Float32Array(sd); this.hueSeed = new Float32Array(hs);
    this.lit = new Float32Array(this.n);
    if (this.reduced && !this.raf) this.renderStatic();
  };

  TileField.prototype.distSegSq = function (qx, qy, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) { var ex0 = qx - ax, ey0 = qy - ay; return ex0 * ex0 + ey0 * ey0; }
    var t = clamp(((qx - ax) * dx + (qy - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    var ex = qx - (ax + dx * t), ey = qy - (ay + dy * t);
    return ex * ex + ey * ey;
  };

  TileField.prototype.frame = function (t) {
    var ctx = this.ctx;
    var viewW = this.viewW, viewH = this.viewH, cell = this.cell, n = this.n;
    var px = this.px, py = this.py, rowOf = this.rowOf, hueSeed = this.hueSeed;
    var spark = this.spark, lit = this.lit, seed = this.seed;
    ctx.clearRect(0, 0, viewW, viewH);
    this.time += SPEED; var time = this.time;
    var prevX = this.lightX, prevY = this.lightY;
    if (this.hasPointer) { this.lightX += (this.rawX - this.lightX) * 0.5; this.lightY += (this.rawY - this.lightY) * 0.5; }
    var lightX = this.lightX, lightY = this.lightY;
    var stepDist = Math.hypot(lightX - prevX, lightY - prevY);
    this.lightSpeed = 0.9 * this.lightSpeed + 0.1 * stepDist;
    var lightSpeed = this.lightSpeed, moving = this.hasPointer;
    var reach = clamp(viewH * 0.22 + lightSpeed * 0.9, viewH * 0.18, viewH * 0.42);
    var influence = 1.5 * reach, influenceSq = influence * influence;
    var minX = Math.min(prevX, lightX) - influence, maxX = Math.max(prevX, lightX) + influence;
    var minY = Math.min(prevY, lightY) - influence, maxY = Math.max(prevY, lightY) + influence;
    var T = time;
    var grayP = new Path2D(), litList = [], buckets = [];
    for (var b0 = 0; b0 < HUE_STEPS; b0++) { var rb = []; for (var b1 = 0; b1 < ALPHA_STEPS; b1++) rb.push(new Path2D()); buckets.push(rb); }
    var hueOfStep = new Float32Array(HUE_STEPS);
    for (var i = 0; i < n; i++) {
      var x = px[i], y = py[i], target = 0;
      if (moving && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        var dSq = this.distSegSq(x, y, prevX, prevY, lightX, lightY);
        if (dSq <= influenceSq) {
          var ang = Math.atan2(y - lightY, x - lightX);
          var wobble = 1 + 0.30 * Math.sin(3 * ang + time * 1.6) + 0.16 * Math.sin(5 * ang - time * 1.1 + 1.3);
          var f = clamp(1 - Math.sqrt(dSq) / (reach * wobble), 0, 1);
          target = f * f * (3 - 2 * f);
        }
      }
      var rate = target > lit[i] ? 0.24 : 0.02;
      lit[i] += (target - lit[i]) * rate;
      var u = x / Math.max(viewW, 1), v = y / Math.max(viewH, 1);
      var flow =
        Math.sin((u * 1.6 + 0.4 * Math.sin(T * 0.3)) * TAU + T * 0.8) +
        0.7 * Math.sin((v * 2.1 - u * 0.9) * TAU - T * 0.6 + 1.7) +
        0.5 * Math.sin((u * 3.3 + v * 2.7) * TAU + T * 0.4 + 4.2) +
        0.4 * Math.cos((v * 1.3 - 1.1 * Math.sin(T * 0.2)) * TAU - T * 0.5);
      var colorAmt = smoothstep(flow, 0.1, 1.6);
      colorAmt = Math.max(colorAmt, lit[i]);
      var breathe = 0.5 + 0.5 * Math.sin(seed[i] * TAU + time * 1.3);
      var base = 0.22 + 0.1 * breathe;
      var sz = cell * (base + (MAXSZ - base) * colorAmt);
      var h = sz / 2;
      grayP.rect(x - h, y - h, sz, sz);
      if (colorAmt > 0.04) {
        var hue, chroma;
        if (ROWS[rowOf[i]].bright) { hue = (hueSeed[i] * 360 + time * 26) % 360; chroma = 0.19; }
        else { var drift = (flow - 0.8) * 16; hue = BRAND_HUE + drift + (hueSeed[i] - 0.5) * 8; chroma = 0.085; }
        // 亮/暗格子的渐变色（原用 oklch，预览 webview 不支持 → 换成 hsl）
        var lightness;
        if (ROWS[rowOf[i]].bright) { lightness = 62; } else { lightness = 50; }
        var sat = ROWS[rowOf[i]].bright ? 40 : 14;
        var hStep = ((Math.round((hue / 360) * HUE_STEPS) % HUE_STEPS) + HUE_STEPS) % HUE_STEPS;
        hueOfStep[hStep] = hue;
        var as = Math.min(ALPHA_STEPS - 1, Math.floor(colorAmt * ALPHA_STEPS));
        buckets[hStep][as].rect(x - h, y - h, sz, sz);
        this.stepL[hStep] = lightness;
        this.stepS[hStep] = sat;
        this.stepH[hStep] = hue;
      }
      if (lit[i] > 0.02) litList.push(i);
    }
    ctx.fillStyle = REST; ctx.fill(grayP);
    for (var hsI = 0; hsI < HUE_STEPS; hsI++) {
      var hue2 = hueOfStep[hsI];
      for (var a2 = 0; a2 < ALPHA_STEPS; a2++) {
        var pp = buckets[hsI][a2];
        // 已渐亮/渐暗的格子用 hsl 上色（预览 webview 不认 oklch）
        if (this.stepS[hsI] === 0) continue;
        ctx.globalAlpha = (a2 + 1) / ALPHA_STEPS;
        ctx.fillStyle = "hsl(" + this.stepH[hsI] + "," + this.stepS[hsI] + "%," + this.stepL[hsI] + "%)";
        ctx.fill(pp);
      }
    }
    ctx.globalAlpha = 1;
    for (var li = 0; li < litList.length; li++) {
      var idx = litList[li], L = lit[idx], lx2 = px[idx], ly2 = py[idx];
      var gsz = cell * (0.7 + (MAXSZ - 0.7) * L); var gh = gsz / 2;
      if (spark[idx]) {
        var ph = seed[idx], tt = 0.00025 * t, amp = (0.45 + ph) * cell * 0.28;
        var jx = lx2 + Math.sin(0.05 * lx2 + 1.3 * tt + ph * TAU) * amp;
        var jy = ly2 + Math.cos(0.04 * ly2 - 0.9 * tt + ph * TAU) * amp;
        ctx.fillStyle = "rgba(" + SPARK + "," + (0.1 * L).toFixed(3) + ")";
        ctx.fillRect(jx - gh * 1.5, jy - gh * 1.5, gsz * 1.5, gsz * 1.5);
        ctx.fillStyle = "rgba(" + SPARK + "," + (0.55 * L).toFixed(3) + ")";
        ctx.fillRect(jx - gh, jy - gh, gsz, gsz);
      } else {
        // 光斑用 hsla（预览 webview 不认 oklch 的透明度分式）
        ctx.fillStyle = "hsla(263,42%,46%," + (0.85 * L).toFixed(3) + ")";
        ctx.fillRect(lx2 - gh, ly2 - gh, gsz, gsz);
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  TileField.prototype.renderStatic = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    var grayP = new Path2D();
    for (var i = 0; i < this.n; i++) {
      var sz = this.cell * 0.5, h = sz / 2;
      grayP.rect(this.px[i] - h, this.py[i] - h, sz, sz);
    }
    ctx.fillStyle = REST; ctx.fill(grayP);
  };
  TileField.prototype.onMoveMethod = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x >= -40 && y >= -40 && x <= rect.width + 40 && y <= rect.height + 40) {
      if (!this.hasPointer) { this.hasPointer = true; this.lightX = x; this.lightY = y; this.lightSpeed = 0; }
      this.rawX = x; this.rawY = y;
    } else { this.hasPointer = false; }
  };
  TileField.prototype.onLeaveMethod = function () { this.hasPointer = false; };
  TileField.prototype.start = function () { if (this.reduced) return; if (!this.raf) this.raf = requestAnimationFrame(this.frame); };
  TileField.prototype.stop = function () { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; };
  TileField.prototype.destroy = function () { this.stop(); window.removeEventListener("pointermove", this.onMove); window.removeEventListener("pointerleave", this.onLeave); this.canvas.remove(); };
  window.TileField = TileField;
})();
