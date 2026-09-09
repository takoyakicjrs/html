/* FlowingMenu — vanilla JS port of the React+GSAP component.
 * Requires gsap (window.gsap) loaded first. Usage:
 *
 *   FlowingMenu.create(document.getElementById('menu'), {
 *     items: [
 *       { link: '#world', text: 'World', image: 'img.jpg' },
 *       { link: '#rules', text: 'Rules' }
 *     ],
 *     speed: 15,
 *     textColor: '#fff',
 *     bgColor: '#120F17',
 *     marqueeBgColor: '#fff',
 *     marqueeTextColor: '#120F17',
 *     borderColor: '#fff'
 *   });
 */
(function (global) {
  'use strict';

  if (typeof global.gsap === 'undefined') {
    throw new Error('FlowingMenu: gsap is required. Load libs/gsap.min.js first.');
  }
  var gsap = global.gsap;

  var DEFAULTS = {
    items: [],
    speed: 15,
    textColor: '#fff',
    bgColor: '#120F17',
    marqueeBgColor: '#fff',
    marqueeTextColor: '#120F17',
    borderColor: '#fff'
  };

  function distMetric(x, y, x2, y2) {
    var dx = x - x2;
    var dy = y - y2;
    return dx * dx + dy * dy;
  }

  function findClosestEdge(mx, my, w, h) {
    return distMetric(mx, my, w / 2, 0) < distMetric(mx, my, w / 2, h) ? 'top' : 'bottom';
  }

  function create(root, opts) {
    if (!root) return null;

    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) o[k2] = opts[k2];

    root.className = 'menu-wrap';
    root.style.backgroundColor = o.bgColor;

    var nav = document.createElement('nav');
    nav.className = 'menu';

    var instances = [];
    (o.items || []).forEach(function (item) {
      var inst = buildItem(item, o);
      nav.appendChild(inst.el);
      instances.push(inst);
    });
    root.appendChild(nav);

    return {
      destroy: function () {
        instances.forEach(function (i) {
          i.destroy();
        });
        root.innerHTML = '';
        root.className = '';
      }
    };
  }

  function buildItem(item, o) {
    var el = document.createElement('div');
    el.className = 'menu__item';
    el.style.borderColor = o.borderColor;

    var a = document.createElement('a');
    a.className = 'menu__item-link';
    a.href = item.link || '#';
    a.style.color = o.textColor;
    a.textContent = item.text;

    var marquee = document.createElement('div');
    marquee.className = 'marquee';
    marquee.style.backgroundColor = o.marqueeBgColor;
    var wrap = document.createElement('div');
    wrap.className = 'marquee__inner-wrap';
    var inner = document.createElement('div');
    inner.className = 'marquee__inner';
    inner.setAttribute('aria-hidden', 'true');
    wrap.appendChild(inner);
    marquee.appendChild(wrap);

    el.appendChild(a);
    el.appendChild(marquee);

    var repetitions = 4;
    var anim = null;
    var timer = null;
    var resizeHandler = null;

    function render() {
      inner.innerHTML = '';
      for (var i = 0; i < repetitions; i++) {
        var part = document.createElement('div');
        part.className = 'marquee__part';
        part.style.color = o.marqueeTextColor;
        var span = document.createElement('span');
        span.textContent = item.text;
        part.appendChild(span);
        if (item.image) {
          var im = document.createElement('div');
          im.className = 'marquee__img';
          im.style.backgroundImage = 'url(' + item.image + ')';
          part.appendChild(im);
        }
        inner.appendChild(part);
      }
    }

    function setupMarquee() {
      var first = inner.querySelector('.marquee__part');
      if (!first) return;
      var cw = first.offsetWidth;
      if (cw === 0) return;
      if (anim) {
        anim.kill();
        anim = null;
      }
      // Animate exactly one content width for a seamless loop
      anim = gsap.to(inner, { x: -cw, duration: o.speed, ease: 'none', repeat: -1 });
    }

    function measure() {
      var first = inner.querySelector('.marquee__part');
      if (!first) return;
      var cw = first.offsetWidth;
      if (cw === 0) return;
      var needed = Math.ceil(window.innerWidth / cw) + 2;
      var rep = Math.max(4, needed);
      if (rep !== repetitions) {
        repetitions = rep;
        render();
      }
      setupMarquee();
    }

    function handleEnter(ev) {
      var rect = el.getBoundingClientRect();
      var x = ev.clientX - rect.left;
      var y = ev.clientY - rect.top;
      var edge = findClosestEdge(x, y, rect.width, rect.height);
      gsap
        .timeline({ defaults: { duration: 0.6, ease: 'expo' } })
        .set(marquee, { y: edge === 'top' ? '-101%' : '101%' }, 0)
        .set(inner, { y: edge === 'top' ? '101%' : '-101%' }, 0)
        .to([marquee, inner], { y: '0%' }, 0);
    }

    function handleLeave(ev) {
      var rect = el.getBoundingClientRect();
      var x = ev.clientX - rect.left;
      var y = ev.clientY - rect.top;
      var edge = findClosestEdge(x, y, rect.width, rect.height);
      gsap
        .timeline({ defaults: { duration: 0.6, ease: 'expo' } })
        .to(marquee, { y: edge === 'top' ? '-101%' : '101%' }, 0)
        .to(inner, { y: edge === 'top' ? '101%' : '-101%' }, 0);
    }

    a.addEventListener('mouseenter', handleEnter);
    a.addEventListener('mouseleave', handleLeave);

    render();
    // Small delay to ensure DOM is ready after repetitions update
    timer = setTimeout(measure, 50);
    resizeHandler = measure;
    window.addEventListener('resize', resizeHandler);

    return {
      el: el,
      destroy: function () {
        clearTimeout(timer);
        window.removeEventListener('resize', resizeHandler);
        if (anim) anim.kill();
        a.removeEventListener('mouseenter', handleEnter);
        a.removeEventListener('mouseleave', handleLeave);
      }
    };
  }

  global.FlowingMenu = { create: create };
})(typeof window !== 'undefined' ? window : this);
