/* Face caméra · moteur de présentation (direction « Viseur ») */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var PRES = params.has('presenter');
  var STILL = params.has('still');            // rendu statique (contrôle qualité)
  var stage = $('#stage');
  var slides = $$('.s', stage);
  var N = slides.length;
  var cur = -1, step = 0, busy = false;
  var bc = ('BroadcastChannel' in window) ? new BroadcastChannel('facecam') : null;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  if (RM || STILL) gsap.globalTimeline.timeScale(1000);
  var E = 'power4.out';

  var CHAPS = ['Ouverture', 'Scène 01 · Le pitch', 'Scène 02 · Voix et regard', 'Scène 03 · Jeu de rôle',
    'Scène 04 · Script IA', 'Scène 05 · Style', 'Scène 06 · Le studio', 'Clôture · À vous'];

  /* ---------- mise à l'échelle ---------- */
  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transformOrigin = '50% 50%';
    stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  addEventListener('resize', fit); fit();

  /* ---------- découpage des titres ---------- */
  function splitWords(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.innerHTML = '';
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
          w.appendChild(i); el.appendChild(w);
        });
      } else {
        var w2 = document.createElement('span'); w2.className = 'w';
        var i2 = document.createElement('span'); i2.className = 'wi'; i2.appendChild(n);
        w2.appendChild(i2); el.appendChild(w2);
      }
    });
  }
  $$('.split', stage).forEach(splitWords);
  $$('.split-c', stage).forEach(function (el) {
    var t = el.textContent; el.innerHTML = '';
    var w = document.createElement('span'); w.className = 'w';
    t.split('').forEach(function (ch) {
      var i = document.createElement('span'); i.className = 'wi'; i.textContent = ch === ' ' ? ' ' : ch; w.appendChild(i);
    });
    el.appendChild(w);
  });

  /* ---------- HUD ---------- */
  var prog = $('#h-prog');
  slides.forEach(function (s, i) {
    var t = document.createElement('i');
    if (i > 0 && s.dataset.chap !== slides[i - 1].dataset.chap) t.className = 'ch';
    prog.appendChild(t);
  });
  var meter = $('#h-meter');
  for (var m = 0; m < 14; m++) { var sp = document.createElement('span'); meter.appendChild(sp); }
  var lvl = 0.4;
  setInterval(function () {
    if (document.hidden) return;
    lvl += (Math.random() - 0.5) * 0.35; lvl = Math.max(0.15, Math.min(0.85, lvl));
    $$('span', meter).forEach(function (s, k) { var f = k / 14; s.className = f < lvl ? (k >= 12 ? 'hot' : 'on') : ''; });
  }, 140);

  var t0 = parseFloat(store.get('fc-t0')) || Date.now();
  store.set('fc-t0', t0);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    var ms = Date.now() - t0, s = Math.floor(ms / 1000);
    $('#h-tc').textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + ':' + pad(Math.floor((ms % 1000) / 1000 * 24));
  }
  setInterval(tick, 1000 / 12); tick();
  document.body.classList.add('is-live');

  function hud() {
    var s = slides[cur];
    $('#h-chap').innerHTML = '<b>' + CHAPS[+s.dataset.chap].split(' · ')[0] + '</b>' + (CHAPS[+s.dataset.chap].indexOf(' · ') > 0 ? ' · ' + CHAPS[+s.dataset.chap].split(' · ')[1] : '');
    $('#h-plan').innerHTML = 'Plan <b>' + pad(cur + 1) + '</b> / ' + N;
    $$('i', prog).forEach(function (t, k) { t.classList.toggle('done', k < cur); t.classList.toggle('cur', k === cur); });
  }

  /* ---------- étapes ---------- */
  function maxStep(s) { var m = 0; $$('[data-s]', s).forEach(function (e) { m = Math.max(m, +e.dataset.s); }); return m; }
  function fromVars(type) {
    switch (type) {
      case 'fade': return { autoAlpha: 0 };
      case 'wipe': return { clipPath: 'inset(0 100% 0 0)' };
      case 'rise': return { autoAlpha: 0, y: 90 };
      case 'phone': return { autoAlpha: 0, y: 260, rotation: 5 };
      case 'lens': return { autoAlpha: 0, scale: 0.6 };
      case 'msg': return { autoAlpha: 0, y: 24, scale: 0.96, transformOrigin: '100% 100%' };
      case 'ver': return { autoAlpha: 0, x: -24 };
      default: return { autoAlpha: 0, y: 40 };
    }
  }
  function toVars(type) {
    if (type === 'wipe') return { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power4.inOut' };
    return { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: type === 'phone' ? 1.2 : 0.8, ease: E };
  }
  function show(el, delay, instant) {
    var type = el.dataset.a || 'up';
    if (instant) { gsap.set(el, { clearProps: 'opacity,visibility,transform,clipPath' }); gsap.set(el, { autoAlpha: 1 }); return; }
    var v = toVars(type); v.delay = delay || 0;
    gsap.fromTo(el, fromVars(type), v);
  }
  function hide(el) { gsap.killTweensOf(el); gsap.set(el, { autoAlpha: 0 }); }

  /* ---------- crochets par page ---------- */
  var H = {};
  var timers = [];
  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }
  var loops = [];
  function clearLoops() { loops.forEach(function (l) { l.kill(); }); loops = []; }

  function stepHooks(s, n, instant, back) {
    // révélation de quiz
    $$('[data-s="' + n + '"][data-reveal]', s).forEach(function (r) {
      var box = $('[data-takes="' + r.dataset.reveal + '"]', s);
      if (box) box.classList.toggle('revealed', !back);
    });
    $$('[data-s="' + n + '"][data-stamp]', s).forEach(function (st) {
      if (back) { hide(st); return; }
      if (instant) gsap.set(st, { autoAlpha: 1, scale: 1, rotation: -8 });
      else gsap.fromTo(st, { autoAlpha: 0, scale: 2.4, rotation: -2 }, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.45, ease: 'back.out(2)' });
    });
    if (s.id === 'nadia') nadia(s, back ? n - 1 : n);
    if (s.id === 'fry') fry(s, back ? n - 1 : n, instant);
  }
  var FRY_SRC = 'https://www.youtube-nocookie.com/embed/MjWS8hQk188?start=350&end=421&autoplay=1&rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&hl=fr';
  function fry(s, st, instant) {
    var p = $('.player', s), f = $('.frame', s);
    if (st >= 1 && st < 2 && !instant && !STILL) {
      if (!f.firstChild) f.innerHTML = '<iframe referrerpolicy="strict-origin-when-cross-origin" src="' + FRY_SRC + (params.has('mute') ? '&mute=1' : '') + '" title="Extrait ABC News : la voix d\u2019Elizabeth Holmes" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
      p.classList.add('on'); gsap.set($('.poster', s), { autoAlpha: 0 });
    } else if (st < 1 || st >= 2) {
      f.innerHTML = ''; p.classList.remove('on'); gsap.set($('.poster', s), { autoAlpha: 1 });
    }
  }
  H.fry = { enter: function (s) { fry(s, 0, true); }, leave: function (s) { fry(s, 0, true); } };
  $('#fry .poster').addEventListener('click', function (e) { e.stopPropagation(); if (slides[cur].id === 'fry' && step === 0) next(); });
  function nadia(s, st) {
    $$('.ln', s).forEach(function (l) {
      var k = +l.dataset.line - 1;
      l.classList.toggle('cur', k === st); l.classList.toggle('seen', k < st);
    });
  }

  function countUp(s, instant) {
    $$('[data-count-to]', s).forEach(function (el) {
      var to = parseFloat(el.dataset.countTo), from = parseFloat(el.dataset.from || 0), fmt = el.dataset.fmt;
      var o = { v: from };
      function out(v) {
        if (fmt === 'M') return v.toFixed(1).replace('.', ',') + ' M';
        if (fmt === 'x') return '× ' + Math.round(v);
        return Math.round(v).toLocaleString('fr-FR').replace(/ | /g, ' ');
      }
      if (instant) { el.textContent = out(to); return; }
      el.textContent = out(from);
      gsap.to(o, { v: to, duration: 2.2, delay: 0.9, ease: 'power3.inOut', onUpdate: function () { el.textContent = out(o.v); } });
    });
  }

  function startTimer(el) {
    var total = +el.dataset.timer, left = total, paused = false;
    el.classList.remove('done', 'paused');
    function draw() { el.textContent = left > 0 ? Math.floor(left / 60) + ':' + pad(left % 60) : 'Top !'; }
    draw();
    var id = setInterval(function () {
      if (paused) return;
      left--; draw();
      if (left <= 0) { clearInterval(id); el.classList.add('done'); gsap.fromTo(el, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,.4)' }); }
    }, 1000);
    timers.push(id);
    el.onclick = function (e) { e.stopPropagation(); paused = !paused; el.classList.toggle('paused', paused); };
    el._reset = function () { clearInterval(id); startTimer(el); };
  }

  H.cover = {
    enter: function (s, instant) {
      var v = $('video', s); v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function () {});
      var f = $('[data-focus]', s);
      if (instant) { gsap.set(f, { autoAlpha: 1, scale: 1 }); }
      else {
        gsap.fromTo(f, { autoAlpha: 0, scale: 1.7 }, { autoAlpha: 1, scale: 1, duration: 1.3, delay: 0.5, ease: 'power3.out' });
        gsap.fromTo($('.fl', f), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, repeat: 5, yoyo: true, delay: 1.6 });
      }
      loops.push(gsap.to(f, { x: 8, y: -6, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2 }));
      var chars = $$('h1 .wi', s);
      if (instant) gsap.set(chars, { yPercent: 0 });
      else gsap.fromTo(chars, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.035, ease: 'power4.out', delay: 0.25 });
    },
    leave: function (s) { $('video', s).pause(); }
  };
  H.avi = {
    enter: function (s, instant) { var v = $('video', s); v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function () {}); countUp(s, instant); },
    leave: function (s) { $('video', s).pause(); }
  };
  H.res = { enter: function (s, instant) { countUp(s, instant); } };
  H.quiz1 = {
    enter: function (s, instant) {
      var r = $('[data-ring]', s), c = $('.rp', r), n = $('.rt span', r), total = +r.dataset.ring;
      if (instant || STILL) { gsap.set(c, { strokeDashoffset: 628.3 }); n.textContent = '0'; return; }
      gsap.set(c, { strokeDashoffset: 0 }); n.textContent = total;
      var o = { t: total };
      loops.push(gsap.to(o, { t: 0, duration: total, delay: 1, ease: 'none', onUpdate: function () {
        n.textContent = Math.ceil(o.t); c.style.strokeDashoffset = 628.3 * (1 - o.t / total);
      } }));
    }
  };
  H.methode = {
    enter: function (s, instant) {
      var h = $('[data-playhead]', s);
      if (instant || STILL) { gsap.set(h, { x: 1680 * 0.35 }); return; }
      loops.push(gsap.fromTo(h, { x: 0 }, { x: 1677, duration: 7, delay: 0.8, ease: 'none' }));
    }
  };
  H.nadia = { enter: function (s) { nadia(s, step); } };
  H.voix = {
    enter: function (s, instant) {
      $$('[data-fader]', s).forEach(function (k, i) {
        var y = 260 - parseFloat(k.dataset.fader) * 246;
        if (instant) gsap.set(k, { top: y });
        else gsap.fromTo(k, { top: 260 }, { top: y, duration: 1.4, delay: 0.6 + i * 0.12, ease: 'power3.inOut' });
        if (!STILL) loops.push(gsap.to(k, { y: (i % 2 ? 7 : -7), duration: 1.6 + i * 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2.2 }));
      });
    }
  };
  H.breath = {
    enter: function (s) {
      var c = $('[data-breath]', s), lab = $('[data-breath-lab]', s), num = $('[data-breath-n]', s);
      if (STILL) { gsap.set(c, { scale: 0.8 }); return; }
      function phase(tl, name, dur, scale) {
        var o = { t: dur };
        tl.call(function () { lab.textContent = name; });
        tl.to(c, { scale: scale, duration: dur, ease: 'sine.inOut' }, '<');
        tl.fromTo(o, { t: dur }, { t: 0, duration: dur, ease: 'none', onUpdate: function () { num.textContent = Math.max(1, Math.ceil(o.t)); } }, '<');
      }
      var tl = gsap.timeline({ repeat: -1, delay: 1 });
      phase(tl, 'Inspirez', 4, 1); phase(tl, 'Bloquez', 4, 1); phase(tl, 'Soufflez', 6, 0.45);
      loops.push(tl);
    }
  };
  H.cadre = {
    enter: function (s, instant) {
      var st = $('[data-strike]', s);
      if (instant || STILL) gsap.set(st, { width: '100%' });
      else gsap.fromTo(st, { width: '0%' }, { width: '100%', duration: 0.7, delay: 1.6, ease: 'power3.inOut' });
    }
  };
  H.cartes = {
    enter: function (s) { var d = $('.deck6', s); d.classList.remove('pick'); $$('.qc', s).forEach(function (q) { q.classList.remove('sel'); }); }
  };
  function drawCard() {
    var s = slides[cur]; if (s.id !== 'cartes') return;
    var d = $('.deck6', s), cs = $$('.qc', s), pick = Math.floor(Math.random() * cs.length), k = 0, rounds = 14 + pick;
    d.classList.add('pick');
    (function spin() {
      cs.forEach(function (c, i) { c.classList.toggle('sel', i === k % cs.length); });
      if (k < rounds) { k++; timers.push(setTimeout(spin, 50 + k * 9)); }
    })();
  }
  $$('#cartes .qc').forEach(function (q, i, all) {
    q.addEventListener('click', function (e) { e.stopPropagation(); var d = q.parentNode; d.classList.add('pick'); all.forEach(function (c) { c.classList.toggle('sel', c === q); }); });
  });
  $('#cartes [data-draw]').addEventListener('click', function (e) { e.stopPropagation(); drawCard(); });
  $$('#check .li').forEach(function (li) { li.addEventListener('click', function (e) { e.stopPropagation(); li.classList.toggle('on'); }); });

  H.final = {
    enter: function (s, instant) {
      var cd = $('[data-cd]', s), h2 = $('h2', s), rest = [h2, $('.sub', s), $('.addr', s)];
      if (instant || STILL) { gsap.set(cd, { autoAlpha: 0 }); gsap.set(rest, { autoAlpha: 1 }); return; }
      gsap.set(rest, { autoAlpha: 0 }); gsap.set(cd, { autoAlpha: 1 });
      var tl = gsap.timeline({ delay: 0.6 });
      ['3', '2', '1', 'Action'].forEach(function (t) {
        tl.call(function () { cd.textContent = t; cd.style.fontSize = t === 'Action' ? '300px' : ''; });
        tl.fromTo(cd, { scale: 1.25, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'power3.out' });
        tl.to(cd, { autoAlpha: t === 'Action' ? 1 : 0.15, duration: 0.5 }, '+=0.25');
      });
      tl.to(cd, { autoAlpha: 0, scale: 0.9, duration: 0.5 }, '+=0.4');
      tl.fromTo(rest, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, stagger: 0.12, duration: 0.9, ease: E });
      loops.push(tl);
    }
  };

  /* ---------- entrée / sortie de page ---------- */
  function prepare(s, st) {
    $$('[data-a]', s).forEach(function (el) {
      gsap.killTweensOf(el);
      var n = +(el.dataset.s || 0);
      if (n === 0 || n <= st) gsap.set(el, { clearProps: 'opacity,visibility,transform,clipPath' });
      else gsap.set(el, { autoAlpha: 0 });
    });
    $$('[data-s]:not([data-a])', s).forEach(function (el) { if (+el.dataset.s > st) hide(el); else gsap.set(el, { clearProps: 'opacity,visibility,transform,clipPath' }); });
    $$('[data-takes]', s).forEach(function (b) { b.classList.remove('revealed'); });
  }
  function enter(s, st, instant) {
    var tl = gsap.timeline();
    var words = $$('.split .wi', s);
    if (instant) gsap.set(words, { yPercent: 0 });
    else tl.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 0.95, stagger: 0.045, ease: E }, 0.12);
    var base = $$('[data-a]', s).filter(function (e) { return !e.dataset.s; });
    base.forEach(function (el, k) { show(el, 0.3 + Math.min(k, 12) * 0.07, instant); });
    if (H[s.id] && H[s.id].enter) H[s.id].enter(s, instant);
    for (var n = 1; n <= st; n++) stepHooks(s, n, true, false);
    $$('[data-timer]', s).forEach(startTimer);
  }
  function leave(s) {
    clearTimers(); clearLoops();
    if (H[s.id] && H[s.id].leave) H[s.id].leave(s);
  }

  function slate(next, cb) {
    var sl = $('#slate');
    $('#sl-scene').textContent = next.dataset.slate;
    $('#sl-title').textContent = next.dataset.slate.replace('SCÈNE ', '');
    var tl = gsap.timeline();
    tl.fromTo(sl, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power4.inOut' });
    tl.fromTo('#sl-title', { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: E }, 0.25);
    tl.call(cb);
    tl.to(sl, { clipPath: 'inset(0 0 0 100%)', duration: 0.55, ease: 'power4.inOut' }, '+=0.35');
    tl.set(sl, { clipPath: 'inset(0 100% 0 0)' });
  }

  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur && !opts.force) return;
    var prev = cur >= 0 ? slides[cur] : null, next = slides[i], dir = i > cur ? 1 : -1;
    if (prev) leave(prev);
    cur = i; step = opts.atEnd ? maxStep(next) : 0;
    history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1));
    function doEnter() {
      slides.forEach(function (s) { s.classList.toggle('on', s === next); if (s !== next) gsap.set(s, { clearProps: 'opacity,filter,transform' }); });
      prepare(next, step);
      enter(next, step, !!opts.atEnd || STILL);
      hud(); render(); broadcast();
    }
    if (!prev || STILL) { doEnter(); return; }
    busy = true;
    gsap.fromTo('.c', { scale: 1 }, { scale: 0.86, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut' });
    if (next.dataset.slate && dir > 0 && !RM) {
      slate(next, doEnter); setTimeout(function () { busy = false; }, 700); return;
    }
    gsap.to(prev, { opacity: 0, filter: 'blur(8px)', scale: 1.012, duration: 0.22, ease: 'power2.in', onComplete: function () {
      doEnter();
      gsap.fromTo(next, { opacity: 0, filter: 'blur(14px)', scale: 1.03 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.8, ease: 'power3.out', clearProps: 'opacity,filter,transform' });
      busy = false;
    } });
  }
  function next() {
    if (busy) return;
    var s = slides[cur];
    if (step < maxStep(s)) {
      step++;
      $$('[data-s="' + step + '"]', s).forEach(function (el) { if (el.dataset.a) show(el, 0); else gsap.set(el, { clearProps: 'opacity,visibility,transform,clipPath' }); });
      stepHooks(s, step, false, false);
      broadcast();
    } else go(cur + 1);
  }
  function prev() {
    if (busy) return;
    var s = slides[cur];
    if (step > 0) {
      $$('[data-s="' + step + '"]', s).forEach(hide);
      stepHooks(s, step, true, true);
      step--; broadcast();
    } else if (cur > 0) go(cur - 1, { atEnd: true });
  }

  /* ---------- votes en direct ---------- */
  var room = store.get('fc-room'), since = store.get('fc-since');
  function newRoom() {
    var a = 'abcdefghjkmnpqrstuvwxyz23456789', c = '';
    for (var k = 0; k < 5; k++) c += a[Math.floor(Math.random() * a.length)];
    room = c; since = String(Math.floor(Date.now() / 1000) - 5);
    store.set('fc-room', room); store.set('fc-since', since);
  }
  if (!room || !since || Date.now() / 1000 - since > 11 * 3600) newRoom();
  var votes = {};
  Object.keys(FC.polls).forEach(function (k) { votes[k] = {}; });
  var es = null;
  function connect() {
    if (es) es.close();
    if (PRES || STILL) return;
    try {
      es = new EventSource(FC.relay + FC.topic(room) + '/sse?since=' + since);
      es.onopen = function () { document.body.classList.add('relay-on'); };
      es.onerror = function () { document.body.classList.remove('relay-on'); };
      es.onmessage = function (e) {
        try {
          var d = JSON.parse(e.data); if (d.event && d.event !== 'message') return;
          var m = JSON.parse(d.message), p = FC.polls[m.q];
          if (!p || p.opts.indexOf(m.a) < 0 || !m.v) return;
          votes[m.q][String(m.v).slice(0, 20)] = m.a;
          render(); broadcast();
        } catch (x) {}
      };
    } catch (e) {}
  }
  function tally(q) {
    var t = {}, n = 0; FC.polls[q].opts.forEach(function (o) { t[o] = 0; });
    Object.keys(votes[q]).forEach(function (v) { t[votes[q][v]]++; n++; });
    return { t: t, n: n };
  }
  function render() {
    Object.keys(FC.polls).forEach(function (q) {
      var r = tally(q);
      $$('[data-total="' + q + '"]').forEach(function (e) { e.textContent = r.n; });
      FC.polls[q].opts.forEach(function (o) {
        var pc = r.n ? Math.round(r.t[o] * 100 / r.n) : 0;
        $$('[data-pc="' + q + ':' + o + '"]').forEach(function (e) { e.textContent = r.n ? pc + ' %' : ''; });
        $$('[data-takes="' + q + '"] [data-opt="' + o + '"] .fill').forEach(function (e) { e.style.height = pc + '%'; });
        $$('[data-fillv="' + q + ':' + o + '"]').forEach(function (e) { e.style.height = pc + '%'; });
      });
      var hist = $('[data-hist="' + q + '"]');
      if (hist) {
        if (!hist.children.length) FC.polls[q].opts.forEach(function (o) {
          var c = document.createElement('div'); c.className = 'col';
          c.innerHTML = '<span class="cnt"></span><div class="bar"></div><div class="num">' + o + '</div>'; hist.appendChild(c);
        });
        var mx = 0, sum = 0; FC.polls[q].opts.forEach(function (o) { mx = Math.max(mx, r.t[o]); sum += r.t[o] * +o; });
        $$('.col', hist).forEach(function (c, k) {
          var o = FC.polls[q].opts[k], v = r.t[o], h = mx ? Math.round(v / mx * 240) : 0;
          $('.bar', c).style.height = Math.max(4, h) + 'px'; c.style.setProperty('--h', h + 'px');
          $('.cnt', c).textContent = v ? v : '';
          c.classList.toggle('has', v > 0); c.classList.toggle('top', v > 0 && v === mx);
        });
        $$('[data-avg="' + q + '"]').forEach(function (e) { e.textContent = r.n ? (sum / r.n).toFixed(1).replace('.', ',') : '–'; });
      }
    });
  }
  function voteURL(key) { return new URL('v/', location.href.split('#')[0]).href + '#' + room + '.' + key; }
  function drawQR() {
    $$('[data-qr]').forEach(function (el) {
      var url = voteURL(el.dataset.qr), qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), size = 176, cell = size / n, d = '';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c * cell).toFixed(2) + ' ' + (r * cell).toFixed(2) + 'h' + cell.toFixed(2) + 'v' + cell.toFixed(2) + 'h-' + cell.toFixed(2) + 'z';
      var short = url.replace(/^https?:\/\//, '').split('#')[0];
      el.innerHTML = '<div class="qbox"><svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><path fill="#121014" d="' + d + '"/></svg></div>' +
        '<div class="qtxt">Scannez<br>code<b>' + room + '</b><small>' + short + '</small></div>';
    });
  }

  /* ---------- vue présentatrice ---------- */
  function notesOf(s) { var a = $('.notes', s); return a ? { t: a.dataset.time || '', n: a.textContent.trim() } : { t: '', n: '' }; }
  function broadcast() {
    if (!bc || PRES) return;
    var tallies = {}; Object.keys(FC.polls).forEach(function (q) { tallies[q] = tally(q); });
    bc.postMessage({ type: 'state', i: cur, step: step, max: maxStep(slides[cur]), tallies: tallies, room: room, t0: t0, black: document.body.classList.contains('black') });
  }
  if (bc) bc.onmessage = function (e) {
    var m = e.data || {};
    if (!PRES) {
      if (m.type === 'hello') broadcast();
      if (m.type === 'cmd') {
        if (m.cmd === 'next') next(); else if (m.cmd === 'prev') prev();
        else if (m.cmd === 'black') { document.body.classList.toggle('black'); broadcast(); }
        else if (m.cmd === 'goto') go(m.i);
      }
    } else if (m.type === 'state') presRender(m);
  };
  function presRender(m) {
    var s = slides[m.i], nx = slides[m.i + 1], no = notesOf(s);
    $('#p-plan').textContent = 'Plan ' + pad(m.i + 1) + ' / ' + N + ' · ' + CHAPS[+s.dataset.chap];
    $('#p-title').textContent = s.dataset.title;
    $('#p-time').textContent = no.t ? 'Repère : ' + no.t : '';
    $('#p-notes').textContent = no.n;
    $('#p-steps').textContent = m.max ? 'Clics restants sur cette page : ' + (m.max - m.step) : '';
    $('#p-nexttitle').textContent = nx ? nx.dataset.title : 'Fin';
    $('#p-room').textContent = m.room;
    $('#p-black').textContent = m.black ? 'Rallumer l’écran' : 'Écran noir';
    t0 = m.t0;
    var html = '';
    Object.keys(FC.polls).forEach(function (q) {
      var r = m.tallies[q], p = FC.polls[q];
      html += '<tr><td>' + p.tab + '</td><td>' + r.n + ' votes · ' + p.opts.map(function (o) { return o + ' ' + r.t[o]; }).join(' · ') + '</td></tr>';
    });
    $('#p-votes').innerHTML = html;
  }
  if (PRES) {
    document.body.classList.add('presenter');
    document.title = 'Vue présentatrice · Face caméra';
    $('#p-next').onclick = function () { bc.postMessage({ type: 'cmd', cmd: 'next' }); };
    $('#p-prev').onclick = function () { bc.postMessage({ type: 'cmd', cmd: 'prev' }); };
    $('#p-black').onclick = function () { bc.postMessage({ type: 'cmd', cmd: 'black' }); };
    addEventListener('keydown', function (e) {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].indexOf(e.key) >= 0) { e.preventDefault(); bc.postMessage({ type: 'cmd', cmd: 'next' }); }
      if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) { e.preventDefault(); bc.postMessage({ type: 'cmd', cmd: 'prev' }); }
      if (e.key === 'b' || e.key === 'B' || e.key === '.') bc.postMessage({ type: 'cmd', cmd: 'black' });
    });
    setInterval(function () {
      var s = Math.floor((Date.now() - t0) / 1000);
      $('#p-el').textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
      var d = new Date(); $('#p-now').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    }, 500);
    if (bc) bc.postMessage({ type: 'hello' });
    return;
  }

  /* ---------- plan général ---------- */
  var ov = $('#ov');
  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.innerHTML = '<small>Plan ' + pad(i + 1) + ' · ' + CHAPS[+s.dataset.chap].split(' · ')[0] + '</small>' + s.dataset.title;
    b.onclick = function () { document.body.classList.remove('ov'); go(i); };
    ov.appendChild(b);
  });
  function toggleOv() {
    document.body.classList.toggle('ov');
    $$('button', ov).forEach(function (b, i) { b.classList.toggle('cur', i === cur); });
  }

  /* ---------- clavier, clic, curseur ---------- */
  var nPress = 0;
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(k) >= 0) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(k) >= 0) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(N - 1);
    else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {}); else document.exitFullscreen(); }
    else if (k === 'p' || k === 'P') window.open(location.pathname + '?presenter', 'fc-presenter', 'width=1280,height=800');
    else if (k === 'g' || k === 'G' || k === 'Escape') { if (k !== 'Escape' || document.body.classList.contains('ov')) toggleOv(); }
    else if (k === 'b' || k === 'B' || k === '.') { document.body.classList.toggle('black'); broadcast(); }
    else if (k === 'h' || k === 'H') document.body.classList.toggle('hud-off');
    else if (k === 't' || k === 'T') { t0 = Date.now(); store.set('fc-t0', t0); broadcast(); }
    else if (k === '0') $$('[data-timer]', slides[cur]).forEach(function (t) { if (t._reset) t._reset(); });
    else if (k === 'd' || k === 'D') drawCard();
    else if (k === '?') document.body.classList.toggle('help');
    else if (k === 'n' || k === 'N') {
      nPress++; setTimeout(function () { nPress = 0; }, 1200);
      if (nPress >= 2) { newRoom(); Object.keys(votes).forEach(function (q) { votes[q] = {}; }); drawQR(); connect(); render(); broadcast(); nPress = 0; }
    }
  });
  stage.addEventListener('click', function (e) {
    if (e.target.closest('button,a,.timer,.qc,.li')) return;
    if (e.clientX < innerWidth * 0.18) prev(); else next();
  });
  var idleT;
  addEventListener('mousemove', function () { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(function () { document.body.classList.add('idle'); }, 2500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && es && es.readyState === 2) connect(); });

  /* ---------- démarrage ---------- */
  drawQR(); connect();
  var h = parseInt(location.hash.replace('#', ''), 10);
  var startStep = parseInt(params.get('step') || '0', 10);
  function start() {
    go(isNaN(h) ? 0 : h - 1);
    for (var k = 0; k < startStep; k++) next();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  window.__deck = { go: go, next: next, prev: prev, votes: votes, render: render, get cur() { return cur; }, get step() { return step; } };
})();
