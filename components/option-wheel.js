/* OptionWheel — vanilla JS port (no React).
 * Original: open-source React component (curved option wheel with rAF
 * exponential smoothing). Converted to a dependency-free IIFE. Usage:
 *
 *   const wheel = OptionWheel.create(el, ['Ambient', 'House', ...], {
 *     defaultSelected: 3,
 *     onChange: (idx, label) => console.log(idx, label)
 *   });
 *
 *   wheel.select(i); wheel.getSelected(); wheel.destroy();
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    defaultSelected: 3,
    onChange: null,
    textColor: '#a6a6a6',
    activeColor: '#ffffff',
    side: 'left',
    fontSize: 3,
    spacing: 1.4,
    curve: 1,
    tilt: 6,
    blur: 2,
    fade: 0.25,
    minOpacity: 0.05,
    smoothing: 200,
    inset: 80,
    loop: false,
    draggable: true,
    // 'y' = 竖向拖拽（默认）；'x' = 横向拖拽，轮子被 rotate(±90deg) 挂着时用
    dragAxis: 'y',
    // 页面本身要纵向滚动时设 false：轮子不再吞掉滚轮事件（点击/拖拽照旧）
    captureWheel: true,
    soundUrl: '',
    soundVolume: 0.5
  };

  function create(root, items, opts) {
    if (!root || !items || !items.length) return null;

    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) o[k2] = opts[k2];

    var remPx =
      typeof window !== 'undefined'
        ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        : 16;

    var cfg = {
      count: items.length,
      items: items,
      rowH: Math.max(o.fontSize * o.spacing * remPx, 1),
      curve: o.curve,
      tilt: o.tilt,
      blur: o.blur,
      fade: o.fade,
      minOpacity: o.minOpacity,
      side: o.side,
      loop: o.loop,
      smoothing: o.smoothing,
      draggable: o.draggable,
      dragAxis: o.dragAxis,
      captureWheel: o.captureWheel,
      soundUrl: o.soundUrl,
      soundVolume: o.soundVolume
    };

    var selected = o.defaultSelected;
    var pos = o.defaultSelected;
    var target = o.defaultSelected;
    var raf = null;
    var last = 0;
    var lastTick = 0;
    var wheelTimer = null;
    var drag = null;
    var dragMoved = false;
    var audio = null;
    var audioUrl = '';

    root.classList.add('option-wheel');
    if (o.side === 'right') root.classList.add('option-wheel--right');
    root.setAttribute('role', 'listbox');
    root.tabIndex = 0;
    root.setAttribute('aria-label', 'Option wheel');
    root.style.setProperty('--ow-text-color', o.textColor);
    root.style.setProperty('--ow-active-color', o.activeColor);
    root.style.setProperty('--ow-font-size', o.fontSize + 'rem');
    root.style.setProperty('--ow-inset', o.inset + 'px');

    var els = items.map(function (label, i) {
      var el = document.createElement('div');
      el.className = 'option-wheel__item';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'false');
      el.textContent = label;
      el.addEventListener('click', function () {
        handleItemClick(i);
      });
      root.appendChild(el);
      return el;
    });

    // Single rAF loop that eases the wheel position toward its target with
    // frame-rate independent exponential smoothing, then lays every option out
    // along the curve based on its distance from the current position.
    function runFrame(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      var tau = Math.max(cfg.smoothing, 1) / 1000;
      var k = 1 - Math.exp(-dt / tau);

      var next = pos + (target - pos) * k;
      var settled = Math.abs(target - next) < 0.001;
      if (settled) next = target;
      pos = next;

      var mirror = cfg.side === 'right' ? -1 : 1;
      // Options sit on a circle whose radius keeps the arc length between two
      // neighbors equal to one row height, so tilt controls how tightly it curls.
      var tiltRad = (cfg.tilt * Math.PI) / 180;
      var R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;

      for (var i = 0; i < cfg.count; i++) {
        var el = els[i];
        if (!el) continue;
        var d = i - next;
        if (cfg.loop && cfg.count > 1) {
          d = ((d % cfg.count) + cfg.count) % cfg.count;
          if (d > cfg.count / 2) d -= cfg.count;
        }
        var dist = Math.abs(d);
        var x = 0;
        var y = d * cfg.rowH;
        var rot = 0;
        if (R > 0) {
          var ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
          y = R * Math.sin(ang);
          x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
          rot = (mirror * ang * 180) / Math.PI;
        }
        el.style.transform =
          'translate(' + x.toFixed(2) + 'px, calc(' + y.toFixed(2) + 'px - 50%)) rotate(' + rot.toFixed(3) + 'deg)';
        el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
        el.style.filter = cfg.blur > 0 ? 'blur(' + (dist * cfg.blur).toFixed(2) + 'px)' : 'none';
        el.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
        el.classList.toggle('option-wheel__item--selected', i === selected);
        el.setAttribute('aria-selected', i === selected ? 'true' : 'false');
      }

      raf = settled ? null : requestAnimationFrame(runFrame);
    }

    function startLoop() {
      if (raf != null) cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(runFrame);
    }

    // Optional tick on selection change, throttled so fast scrolling can't spam
    // it, and with playback failures (e.g. autoplay policies) silently ignored.
    function playTick() {
      if (!cfg.soundUrl) return;
      var now = performance.now();
      if (now - lastTick < 70) return;
      lastTick = now;
      if (!audio || audioUrl !== cfg.soundUrl) {
        audio = new Audio(cfg.soundUrl);
        audio.preload = 'auto';
        audioUrl = cfg.soundUrl;
      }
      audio.volume = Math.min(Math.max(cfg.soundVolume, 0), 1);
      audio.currentTime = 0;
      audio.play().catch(function () {});
    }

    function applyTarget(value, snap) {
      var v = value;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(cfg.count - 1, 0));
      if (snap) v = Math.round(v);
      target = v;
      var idx = ((Math.round(v) % cfg.count) + cfg.count) % cfg.count;
      if (idx !== selected) {
        selected = idx;
        if (typeof o.onChange === 'function') o.onChange(idx, cfg.items[idx]);
        playTick();
      }
      startLoop();
    }

    function handleItemClick(index) {
      if (dragMoved) return;
      var cur = target;
      var d = index - (((cur % cfg.count) + cfg.count) % cfg.count);
      if (cfg.loop && cfg.count > 1) {
        if (d > cfg.count / 2) d -= cfg.count;
        else if (d < -cfg.count / 2) d += cfg.count;
      }
      applyTarget(cur + d, true);
    }

    // Wheel / touchpad scrolling, registered manually so it can be non-passive.
    root.addEventListener(
      'wheel',
      function (e) {
        // captureWheel:false → 滚轮事件穿过去，交给页面自己滚动
        if (!cfg.captureWheel) return;
        e.preventDefault();
        var delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
        // Cap each event at one step so notchy mouse wheels move exactly one
        // option per click, while touchpads still scroll continuously.
        var step = Math.max(-1, Math.min(1, delta / cfg.rowH));
        applyTarget(target + step, false);
        if (wheelTimer) clearTimeout(wheelTimer);
        wheelTimer = setTimeout(function () {
          applyTarget(target, true);
        }, 140);
      },
      { passive: false }
    );

    root.addEventListener('pointerdown', function (e) {
      if (!cfg.draggable) return;
      drag = { x: e.clientX, y: e.clientY, start: target, id: e.pointerId };
      dragMoved = false;
      root.classList.add('option-wheel--dragging');
    });

    root.addEventListener('pointermove', function (e) {
      if (!drag) return;
      // 轮子被 CSS 旋转 90° 时拖拽轴要跟着换，否则手感是反的。
      var d = cfg.dragAxis === 'x' ? e.clientX - drag.x : e.clientY - drag.y;
      if (!dragMoved && Math.abs(d) > 4) {
        dragMoved = true;
        // Capture only once a real drag starts, so plain clicks still reach
        // the items and navigate to them.
        if (root.setPointerCapture) root.setPointerCapture(drag.id);
      }
      if (dragMoved) applyTarget(drag.start - d / cfg.rowH, false);
    });

    function endDrag() {
      if (!drag) return;
      drag = null;
      root.classList.remove('option-wheel--dragging');
      if (dragMoved) applyTarget(target, true);
    }
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);

    root.addEventListener('keydown', function (e) {
      var delta = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
      if (delta === null) return;
      e.preventDefault();
      applyTarget(Math.round(target) + delta, true);
    });

    applyTarget(target, false);

    return {
      select: function (i) {
        applyTarget(i, true);
      },
      getSelected: function () {
        return selected;
      },
      destroy: function () {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
        if (wheelTimer) clearTimeout(wheelTimer);
        if (audio) audio.pause();
        root.innerHTML = '';
        root.classList.remove('option-wheel', 'option-wheel--right', 'option-wheel--dragging');
      }
    };
  }

  global.OptionWheel = { create: create };
})(typeof window !== 'undefined' ? window : this);
