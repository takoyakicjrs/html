/* StaggeredMenu — vanilla JS port of the React+GSAP component.
 * Requires gsap (window.gsap) loaded first. Usage:
 *
 *   StaggeredMenu.create(document.getElementById('menu'), {
 *     position: 'right',
 *     colors: ['#B497CF', '#5227FF'],
 *     items: [{ label: 'Home', link: '#home' }],
 *     socialItems: [{ label: 'X', link: 'https://x.com' }],
 *     displaySocials: true,
 *     displayItemNumbering: true,
 *     logoUrl: '',
 *     menuButtonColor: '#fff',
 *     openMenuButtonColor: '#fff',
 *     accentColor: '#5227FF',
 *     changeMenuColorOnOpen: true,
 *     isFixed: false,
 *     closeOnClickAway: true,
 *     onMenuOpen: null,
 *     onMenuClose: null
 *   });
 */
(function (global) {
  'use strict';

  if (typeof global.gsap === 'undefined') {
    throw new Error('StaggeredMenu: gsap is required. Load libs/gsap.min.js first.');
  }
  var gsap = global.gsap;

  var DEFAULTS = {
    position: 'right',
    colors: ['#B497CF', '#5227FF'],
    items: [],
    socialItems: [],
    displaySocials: true,
    displayItemNumbering: true,
    className: '',
    logoUrl: '',
    menuButtonColor: '#fff',
    openMenuButtonColor: '#fff',
    accentColor: '#5227FF',
    changeMenuColorOnOpen: true,
    isFixed: false,
    closeOnClickAway: true,
    onMenuOpen: null,
    onMenuClose: null
  };

  function create(root, opts) {
    if (!root) return null;

    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) o[k2] = opts[k2];

    var open = false;
    var busy = false;
    var openTl = null;
    var closeTween = null;
    var spinTween = null;
    var textCycleAnim = null;
    var colorTween = null;
    var textLines = ['Menu', 'Close'];
    var offscreen = o.position === 'left' ? -100 : 100;
    var panel, preContainer, preLayers = [], plusH, plusV, icon, textInner, toggleBtn;

    // ---------- DOM ----------
    root.className =
      (o.className ? o.className + ' ' : '') +
      'staggered-menu-wrapper' +
      (o.isFixed ? ' fixed-wrapper' : '');
    if (o.accentColor) root.style.setProperty('--sm-accent', o.accentColor);
    root.setAttribute('data-position', o.position);

    preContainer = document.createElement('div');
    preContainer.className = 'sm-prelayers';
    preContainer.setAttribute('aria-hidden', 'true');
    var raw = o.colors && o.colors.length ? o.colors.slice(0, 4) : ['#1e1e22', '#35353c'];
    var arr = raw.slice();
    if (arr.length >= 3) arr.splice(Math.floor(arr.length / 2), 1);
    arr.forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'sm-prelayer';
      d.style.background = c;
      preContainer.appendChild(d);
      preLayers.push(d);
    });
    root.appendChild(preContainer);

    var header = document.createElement('header');
    header.className = 'staggered-menu-header';
    header.setAttribute('aria-label', 'Main navigation header');
    var logo = document.createElement('div');
    logo.className = 'sm-logo';
    logo.setAttribute('aria-label', 'Logo');
    if (o.logoUrl) {
      var img = document.createElement('img');
      img.src = o.logoUrl;
      img.alt = 'Logo';
      img.className = 'sm-logo-img';
      img.draggable = false;
      img.width = 110;
      img.height = 24;
      logo.appendChild(img);
    } else {
      var logoText = document.createElement('span');
      logoText.className = 'sm-logo-img';
      logoText.textContent = 'LOGO';
      logo.appendChild(logoText);
    }
    header.appendChild(logo);

    toggleBtn = document.createElement('button');
    toggleBtn.className = 'sm-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', 'Open menu');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', 'staggered-menu-panel');
    var textWrap = document.createElement('span');
    textWrap.className = 'sm-toggle-textWrap';
    textWrap.setAttribute('aria-hidden', 'true');
    textInner = document.createElement('span');
    textInner.className = 'sm-toggle-textInner';
    textWrap.appendChild(textInner);
    icon = document.createElement('span');
    icon.className = 'sm-icon';
    icon.setAttribute('aria-hidden', 'true');
    plusH = document.createElement('span');
    plusH.className = 'sm-icon-line';
    plusV = document.createElement('span');
    plusV.className = 'sm-icon-line sm-icon-line-v';
    icon.appendChild(plusH);
    icon.appendChild(plusV);
    toggleBtn.appendChild(textWrap);
    toggleBtn.appendChild(icon);
    header.appendChild(toggleBtn);
    root.appendChild(header);

    panel = document.createElement('aside');
    panel.id = 'staggered-menu-panel';
    panel.className = 'staggered-menu-panel';
    panel.setAttribute('aria-hidden', 'true');
    var inner = document.createElement('div');
    inner.className = 'sm-panel-inner';
    var ul = document.createElement('ul');
    ul.className = 'sm-panel-list';
    ul.setAttribute('role', 'list');
    if (o.displayItemNumbering) ul.setAttribute('data-numbering', '');
    if (o.items && o.items.length) {
      o.items.forEach(function (it, idx) {
        var li = document.createElement('li');
        li.className = 'sm-panel-itemWrap';
        var a = document.createElement('a');
        a.className = 'sm-panel-item';
        a.href = it.link || '#';
        if (it.ariaLabel) a.setAttribute('aria-label', it.ariaLabel);
        a.setAttribute('data-index', idx + 1);
        var lbl = document.createElement('span');
        lbl.className = 'sm-panel-itemLabel';
        lbl.textContent = it.label;
        a.appendChild(lbl);
        li.appendChild(a);
        ul.appendChild(li);
      });
    } else {
      var noItems = document.createElement('li');
      noItems.className = 'sm-panel-itemWrap';
      noItems.setAttribute('aria-hidden', 'true');
      noItems.innerHTML =
        '<span class="sm-panel-item"><span class="sm-panel-itemLabel">No items</span></span>';
      ul.appendChild(noItems);
    }
    inner.appendChild(ul);

    if (o.displaySocials && o.socialItems && o.socialItems.length) {
      var soc = document.createElement('div');
      soc.className = 'sm-socials';
      soc.setAttribute('aria-label', 'Social links');
      var h3 = document.createElement('h3');
      h3.className = 'sm-socials-title';
      h3.textContent = 'Socials';
      var sul = document.createElement('ul');
      sul.className = 'sm-socials-list';
      sul.setAttribute('role', 'list');
      o.socialItems.forEach(function (s) {
        var li = document.createElement('li');
        li.className = 'sm-socials-item';
        var a = document.createElement('a');
        a.href = s.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'sm-socials-link';
        a.textContent = s.label;
        li.appendChild(a);
        sul.appendChild(li);
      });
      soc.appendChild(h3);
      soc.appendChild(sul);
      inner.appendChild(soc);
    }
    panel.appendChild(inner);
    root.appendChild(panel);

    function renderTextLines() {
      textInner.innerHTML = '';
      textLines.forEach(function (l) {
        var s = document.createElement('span');
        s.className = 'sm-toggle-line';
        s.textContent = l;
        textInner.appendChild(s);
      });
    }
    renderTextLines();

    // ---------- GSAP initial state ----------
    gsap.set([panel].concat(preLayers), { xPercent: offscreen, opacity: 1 });
    gsap.set(preContainer, { xPercent: 0, opacity: 1 });
    gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
    gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
    gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
    gsap.set(textInner, { yPercent: 0 });
    gsap.set(toggleBtn, { color: o.menuButtonColor });

    // ---------- animation logic ----------
    function buildOpenTimeline() {
      if (openTl) openTl.kill();
      if (closeTween) {
        closeTween.kill();
        closeTween = null;
      }
      var itemEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-itemLabel'));
      var numberEls = Array.prototype.slice.call(
        panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
      );
      var socialTitle = panel.querySelector('.sm-socials-title');
      var socialLinks = Array.prototype.slice.call(panel.querySelectorAll('.sm-socials-link'));

      if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
      if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
      if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
      if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

      var tl = gsap.timeline({ paused: true });

      preLayers.forEach(function (el, i) {
        tl.fromTo(el, { xPercent: offscreen }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
      });
      var lastTime = preLayers.length ? (preLayers.length - 1) * 0.07 : 0;
      var panelInsertTime = lastTime + (preLayers.length ? 0.08 : 0);
      var panelDuration = 0.65;
      tl.fromTo(
        panel,
        { xPercent: offscreen },
        { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
        panelInsertTime
      );

      if (itemEls.length) {
        var itemsStart = panelInsertTime + panelDuration * 0.15;
        tl.to(
          itemEls,
          { yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out', stagger: { each: 0.1, from: 'start' } },
          itemsStart
        );
        if (numberEls.length) {
          tl.to(
            numberEls,
            { duration: 0.6, ease: 'power2.out', '--sm-num-opacity': 1, stagger: { each: 0.08, from: 'start' } },
            itemsStart + 0.1
          );
        }
      }

      if (socialTitle || socialLinks.length) {
        var socialsStart = panelInsertTime + panelDuration * 0.4;
        if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: 'power2.out' }, socialsStart);
        if (socialLinks.length) {
          tl.to(
            socialLinks,
            {
              y: 0,
              opacity: 1,
              duration: 0.55,
              ease: 'power3.out',
              stagger: { each: 0.08, from: 'start' },
              onComplete: function () {
                gsap.set(socialLinks, { clearProps: 'opacity' });
              }
            },
            socialsStart + 0.04
          );
        }
      }

      openTl = tl;
      return tl;
    }

    function playOpen() {
      if (busy) return;
      busy = true;
      var tl = buildOpenTimeline();
      if (tl) {
        tl.eventCallback('onComplete', function () {
          busy = false;
        });
        tl.play(0);
      } else {
        busy = false;
      }
    }

    function playClose() {
      if (openTl) {
        openTl.kill();
        openTl = null;
      }
      if (closeTween) closeTween.kill();
      var all = preLayers.concat(panel);
      closeTween = gsap.to(all, {
        xPercent: offscreen,
        duration: 0.32,
        ease: 'power3.in',
        overwrite: 'auto',
        onComplete: function () {
          var itemEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-itemLabel'));
          if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
          var numberEls = Array.prototype.slice.call(
            panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item')
          );
          if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
          var socialTitle = panel.querySelector('.sm-socials-title');
          var socialLinks = Array.prototype.slice.call(panel.querySelectorAll('.sm-socials-link'));
          if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
          if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
          busy = false;
        }
      });
    }

    function animateIcon(opening) {
      if (spinTween) spinTween.kill();
      spinTween = opening
        ? gsap.to(icon, { rotate: 225, duration: 0.8, ease: 'power4.out', overwrite: 'auto' })
        : gsap.to(icon, { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' });
    }

    function animateColor(opening) {
      if (colorTween) colorTween.kill();
      if (o.changeMenuColorOnOpen) {
        var targetColor = opening ? o.openMenuButtonColor : o.menuButtonColor;
        colorTween = gsap.to(toggleBtn, { color: targetColor, delay: 0.18, duration: 0.3, ease: 'power2.out' });
      } else {
        gsap.set(toggleBtn, { color: o.menuButtonColor });
      }
    }

    function animateText(opening) {
      if (textCycleAnim) textCycleAnim.kill();
      var currentLabel = opening ? 'Menu' : 'Close';
      var targetLabel = opening ? 'Close' : 'Menu';
      var cycles = 3;
      var seq = [currentLabel];
      var last = currentLabel;
      for (var i = 0; i < cycles; i++) {
        last = last === 'Menu' ? 'Close' : 'Menu';
        seq.push(last);
      }
      if (last !== targetLabel) seq.push(targetLabel);
      seq.push(targetLabel);
      textLines = seq;
      renderTextLines();
      gsap.set(textInner, { yPercent: 0 });
      var lineCount = seq.length;
      var finalShift = ((lineCount - 1) / lineCount) * 100;
      textCycleAnim = gsap.to(textInner, {
        yPercent: -finalShift,
        duration: 0.5 + lineCount * 0.07,
        ease: 'power4.out'
      });
    }

    function setOpenState(target) {
      open = target;
      if (target) root.setAttribute('data-open', '');
      else root.removeAttribute('data-open');
      panel.setAttribute('aria-hidden', target ? 'false' : 'true');
      toggleBtn.setAttribute('aria-expanded', target ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', target ? 'Close menu' : 'Open menu');
    }

    function toggleMenu() {
      var target = !open;
      setOpenState(target);
      if (target) {
        if (o.onMenuOpen) o.onMenuOpen();
        playOpen();
      } else {
        if (o.onMenuClose) o.onMenuClose();
        playClose();
      }
      animateIcon(target);
      animateColor(target);
      animateText(target);
    }

    function closeMenu() {
      if (!open) return;
      setOpenState(false);
      if (o.onMenuClose) o.onMenuClose();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }

    toggleBtn.addEventListener('click', toggleMenu);

    if (o.closeOnClickAway) {
      document.addEventListener('mousedown', function (e) {
        if (!open) return;
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) closeMenu();
      });
    }

    return {
      open: toggleMenu,
      close: closeMenu,
      isOpen: function () {
        return open;
      },
      destroy: function () {
        if (openTl) openTl.kill();
        if (closeTween) closeTween.kill();
        if (spinTween) spinTween.kill();
        if (textCycleAnim) textCycleAnim.kill();
        if (colorTween) colorTween.kill();
        root.innerHTML = '';
        root.className = '';
        root.removeAttribute('data-position');
        root.removeAttribute('data-open');
      }
    };
  }

  global.StaggeredMenu = { create: create };
})(typeof window !== 'undefined' ? window : this);
