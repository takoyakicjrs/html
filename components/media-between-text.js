/* MediaBetweenText — vanilla JS port of the motion/React component.
 * Requires gsap (window.gsap) loaded first. Usage:
 *
 *   MediaBetweenText.create(el, {
 *     firstText: "that's a nice (",
 *     secondText: ") chair!",
 *     mediaUrl: 'img.jpg',
 *     mediaType: 'image',          // 'image' | 'video'
 *     triggerType: 'hover',        // 'hover' | 'inView' | 'ref'
 *     root: scrollContainer,       // for triggerType 'inView'
 *     inViewOptions: { once: false, amount: 1, root: scrollContainer, margin: '0px' },
 *     animationVariants: {
 *       initial: { width: 0, opacity: 1 },
 *       animate: {
 *         width: function () { return window.innerWidth >= 640 ? 100 : 30; },
 *         opacity: 1,
 *         transition: { duration: 0.4 }
 *       }
 *     },
 *     className: 'mbt-demo-a',
 *     leftTextClassName: '',
 *     rightTextClassName: ''
 *   });
 *
 * Width/height/opacity values may be numbers, CSS strings, or functions of
 * the current window width (re-evaluated on resize). Returns:
 * { animate(), reset(), isAnimated(), setVariants(v), destroy() }
 */
(function (global) {
  'use strict';

  if (typeof global.gsap === 'undefined') {
    throw new Error('MediaBetweenText: gsap is required. Load libs/gsap.min.js first.');
  }
  var gsap = global.gsap;

  var DEFAULTS = {
    firstText: '',
    secondText: '',
    mediaUrl: '',
    mediaType: 'image',
    mediaContainerClassName: '',
    fallbackUrl: '',
    as: 'p',
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
    alt: '',
    triggerType: 'hover',
    root: null,
    inViewOptions: { once: true, amount: 0.5, root: null, margin: '0px' },
    animationVariants: {
      initial: { width: 0, opacity: 1 },
      animate: { width: 'auto', opacity: 1, transition: { duration: 0.4 } }
    },
    className: '',
    leftTextClassName: '',
    rightTextClassName: ''
  };

  function evalVal(v, w) {
    return typeof v === 'function' ? v(w) : v;
  }

  function create(root, opts) {
    if (!root) return null;

    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) o[k2] = opts[k2];

    var state = 'initial';
    var tween = null;
    var io = null;

    root.className = ('mbt ' + (o.className || '')).trim();

    var Tag = o.as || 'p';
    var left = document.createElement(Tag);
    left.className = o.leftTextClassName || '';
    left.textContent = o.firstText;
    var right = document.createElement(Tag);
    right.className = o.rightTextClassName || '';
    right.textContent = o.secondText;

    var media = document.createElement('div');
    media.className = 'mbt-media ' + (o.mediaContainerClassName || '');

    if (o.mediaType === 'video') {
      var video = document.createElement('video');
      video.className = 'mbt-media-el';
      if (o.fallbackUrl) video.poster = o.fallbackUrl;
      video.autoplay = !!o.autoPlay;
      video.loop = !!o.loop;
      video.muted = !!o.muted;
      video.playsInline = !!o.playsInline;
      var src = document.createElement('source');
      src.src = o.mediaUrl;
      src.type = 'video/mp4';
      video.appendChild(src);
      media.appendChild(video);
    } else {
      var img = document.createElement('img');
      img.className = 'mbt-media-el';
      img.src = o.mediaUrl;
      img.alt = o.alt || o.firstText + ' ' + o.secondText;
      media.appendChild(img);
    }

    root.appendChild(left);
    root.appendChild(media);
    root.appendChild(right);

    function transitionOf(variants) {
      var t = (variants && variants.transition) || {};
      return {
        duration: t.duration != null ? t.duration : 0.4,
        ease: Array.isArray(t.ease) ? 'expo.out' : t.ease || 'power2.out'
      };
    }

    function targetFor(variants) {
      var w = window.innerWidth;
      var out = {};
      ['width', 'height', 'opacity', 'x', 'y'].forEach(function (k) {
        if (variants && variants[k] !== undefined) out[k] = evalVal(variants[k], w);
      });
      return out;
    }

    function animateTo(variants) {
      if (tween) tween.kill();
      var cfg = transitionOf(variants);
      var vars = targetFor(variants);
      vars.duration = cfg.duration;
      vars.ease = cfg.ease;
      tween = gsap.to(media, vars);
    }

    function setState(next) {
      state = next;
      animateTo(next === 'animate' ? o.animationVariants.animate : o.animationVariants.initial);
    }

    if (o.triggerType === 'hover') {
      root.addEventListener('mouseenter', function () {
        setState('animate');
      });
      root.addEventListener('mouseleave', function () {
        setState('initial');
      });
    } else if (o.triggerType === 'inView') {
      var iopts = o.inViewOptions || {};
      var ioOpts = {
        threshold: iopts.amount != null ? iopts.amount : 0.5,
        rootMargin: iopts.margin || '0px'
      };
      if (o.root) ioOpts.root = o.root;
      else if (iopts.root) ioOpts.root = iopts.root;
      io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            var active = en.isIntersecting;
            setState(active ? 'animate' : 'initial');
            if (active && iopts.once && io) {
              io.disconnect();
              io = null;
            }
          });
        },
        ioOpts
      );
      io.observe(root);
    }
    // triggerType 'ref': no listeners; driven by the returned API only.

    gsap.set(media, targetFor(o.animationVariants.initial));

    function onResize() {
      var cur = state === 'animate' ? o.animationVariants.animate : o.animationVariants.initial;
      animateTo(cur);
    }
    window.addEventListener('resize', onResize);

    return {
      animate: function () {
        setState('animate');
      },
      reset: function () {
        setState('initial');
      },
      isAnimated: function () {
        return state === 'animate';
      },
      setVariants: function (v) {
        o.animationVariants = v;
        if (state === 'animate') animateTo(v.animate);
      },
      destroy: function () {
        if (tween) tween.kill();
        if (io) io.disconnect();
        window.removeEventListener('resize', onResize);
        root.innerHTML = '';
        root.className = '';
      }
    };
  }

  global.MediaBetweenText = { create: create };
})(typeof window !== 'undefined' ? window : this);
