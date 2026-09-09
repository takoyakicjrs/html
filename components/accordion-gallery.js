/* AccordionGallery — vanilla JS port (no React, no GSAP).
 * Original: open-source React component (GSAP-based accordion gallery).
 * Converted to a dependency-free IIFE. Usage:
 *
 *   const gallery = AccordionGallery.create(el, [
 *     { image: 'a.jpg', label: 'Canyon', link: '#' },
 *     { image: 'b.jpg', label: 'Falls' }
 *   ], { defaultIndex: 2, trigger: 'hover', orientation: 'horizontal' });
 *
 *   gallery.setActive(i); gallery.getActive(); gallery.destroy();
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    defaultIndex: 2,
    accentColor: '#ffffff',
    overlayColor: '#060010',
    textColor: '#ffffff',
    height: 460,
    gap: 10,
    radius: 16,
    expandRatio: 0.52,
    orientation: 'horizontal',
    duration: 0.6,
    parallax: 0.5,
    tilt: 8,
    stagger: 0.06,
    trigger: 'hover',
    showLabels: true,
    grayscale: true
  };

  function clamp(v, a, b) {
    return Math.min(Math.max(v, a), b);
  }

  function create(root, items, opts) {
    if (!root) return null;
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) o[k2] = opts[k2];

    var vertical = o.orientation === 'vertical';
    var count = items.length;
    if (count === 0) return null;
    var active = clamp(o.defaultIndex | 0, 0, count - 1);
    var mediaSize = { v: 320 };
    var panels = [];
    var mediaEls = [];
    var ro = null;
    var reduced =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    root.classList.add('ag');
    if (vertical) root.classList.add('ag--vertical');
    if (reduced) root.classList.add('ag--no-motion');
    root.style.setProperty('--ag-accent', o.accentColor);
    root.style.setProperty('--ag-overlay', o.overlayColor);
    root.style.setProperty('--ag-text', o.textColor);
    root.style.setProperty('--ag-gap', o.gap + 'px');
    root.style.setProperty('--ag-radius', o.radius + 'px');
    root.style.setProperty('--ag-duration', Math.round(o.duration * 1000) + 'ms');
    root.style.height = (vertical ? Math.round(o.height * 1.6) : o.height) + 'px';
    root.setAttribute('role', 'list');
    root.setAttribute('aria-label', 'Image accordion gallery');

    items.forEach(function (item, i) {
      var Tag = item.link ? 'a' : 'div';
      var el = document.createElement(Tag);
      el.className = 'ag-panel';
      el.style.borderRadius = o.radius + 'px';
      el.setAttribute('role', 'listitem');
      el.tabIndex = 0;
      el.setAttribute('aria-label', item.label || '');
      if (item.link) el.href = item.link;

      var mediaHtml =
        '<span class="ag-panel__media"><img src="' +
        (item.image || '') +
        '" alt="' +
        (item.alt || item.label || '') +
        '" draggable="false"></span>';
      var labelHtml = o.showLabels
        ? '<span class="ag-panel__label" aria-hidden="true"><span class="ag-panel__bar"></span><span class="ag-panel__text"></span></span>'
        : '';
      el.innerHTML =
        '<span class="ag-panel__frame">' +
        mediaHtml +
        '<span class="ag-panel__overlay" aria-hidden="true"></span>' +
        '</span>' +
        labelHtml;

      if (o.showLabels) {
        el.querySelector('.ag-panel__text').textContent = item.label || '';
      }

      el.addEventListener('click', function (e) {
        if (i !== active) {
          e.preventDefault();
          setActive(i);
        }
      });
      el.addEventListener('mouseenter', function () {
        if (o.trigger === 'hover') setActive(i);
      });
      el.addEventListener('focus', function () {
        setActive(i);
      });
      el.addEventListener('keydown', function (e) {
        var d = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') d = 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') d = -1;
        if (d === null) return;
        e.preventDefault();
        setActive((active + d + count) % count);
      });

      root.appendChild(el);
      panels.push(el);
      mediaEls.push(el.querySelector('.ag-panel__media'));
    });

    function measure() {
      var rect = root.getBoundingClientRect();
      var total = vertical ? rect.height : rect.width;
      var usable = Math.max(total - o.gap * (count - 1), 120);
      mediaSize.v = Math.max(140, usable * clamp(o.expandRatio, 0.2, 0.9) * 1.22);
      root.style.setProperty('--ag-media-size', mediaSize.v + 'px');
      layout(false);
    }

    function layout() {
      var r = clamp(o.expandRatio, 0.2, 0.9);
      var grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
      panels.forEach(function (p, i) {
        var isActive = i === active;
        p.classList.toggle('ag-panel--active', isActive);
        p.style.flexGrow = isActive ? grow : 1;
        var rot = isActive ? 0 : i < active ? o.tilt : -o.tilt;
        p.style.transform = vertical ? 'rotateX(' + -rot + 'deg)' : 'rotateY(' + rot + 'deg)';

        var media = mediaEls[i];
        if (media) {
          var drift = clamp(active - i, -1.5, 1.5);
          var shift = drift * o.parallax * mediaSize.v * 0.06;
          media.style.transform = vertical
            ? 'translate(-50%, -50%) translateY(' + shift.toFixed(2) + 'px)'
            : 'translate(-50%, -50%) translateX(' + shift.toFixed(2) + 'px)';
          media.style.filter = o.grayscale ? 'grayscale(' + (isActive ? 0 : 1) + ')' : 'none';
        }

        var overlay = p.querySelector('.ag-panel__overlay');
        if (overlay) overlay.style.setProperty('--ag-dim', isActive ? 0 : 0.35);
      });
    }

    function setActive(i) {
      var next = clamp(i, 0, count - 1);
      if (next === active) return;
      active = next;
      layout();
    }

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(root);
    }

    return {
      setActive: setActive,
      getActive: function () {
        return active;
      },
      destroy: function () {
        if (ro) ro.disconnect();
        root.innerHTML = '';
        root.classList.remove('ag', 'ag--vertical', 'ag--no-motion');
      }
    };
  }

  global.AccordionGallery = { create: create };
})(typeof window !== 'undefined' ? window : this);
