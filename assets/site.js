/* XQUIZITE Salon Juffair, V3: page behaviour.
   The page reads fine without this file. It adds the motion, the live opening status,
   the "your visit" list builder on the price menu, and the phone conveniences. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var fine = matchMedia("(hover: hover) and (pointer: fine)");
  var phone = matchMedia("(max-width: 760px)");
  var hasIO = "IntersectionObserver" in window;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var motion = function () { return !reduce.matches; };
  var WA = "https://wa.me/97317811363";
  var vh = innerHeight, vw = innerWidth;

  /* ---------- Headings: wrap each word so it can rise from a mask ---------- */
  function splitWords(el) {
    var i = 0;
    function wrap(text, tag) {
      var frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        var outer = document.createElement("span"), inner = document.createElement("span");
        outer.className = "sw"; inner.style.setProperty("--i", i++);
        if (tag) { var t = document.createElement(tag); t.textContent = part; inner.appendChild(t); } else inner.textContent = part;
        outer.appendChild(inner); frag.appendChild(outer);
      });
      return frag;
    }
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) el.replaceChild(wrap(node.textContent, null), node);
      else if (node.nodeType === 1 && node.tagName === "EM") el.replaceChild(wrap(node.textContent, "em"), node);
    });
  }
  if (motion()) $$("[data-split]").forEach(splitWords);

  /* ---------- Opening sequence ---------- */
  var heroTitle = $(".hero [data-split]");
  var fontsReady = new Promise(function (res) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(res);
    setTimeout(res, 900);
  });
  var started = false;
  function start() {
    if (started) return; started = true;
    root.classList.remove("loading");
    if (heroTitle) heroTitle.classList.add("in");
  }
  fontsReady.then(function () {
    requestAnimationFrame(function () { requestAnimationFrame(start); });
    setTimeout(start, 400); /* frames do not run in a background tab, so never wait on them alone */
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = $$("[data-rv], [data-split], .label, .close-mark").filter(function (el) { return el !== heroTitle; });
  if (hasIO && motion()) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -9% 0px", threshold: .08 });
    reveals.forEach(function (el) { rio.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add("in"); });

  /* ---------- One scroll loop: header state, parallax, the image strip ---------- */
  var hdr = $("#hdr"), hero = $(".hero"), heroImg = $(".hero-img");
  var darkZones = $$('[data-tone="dark"]');
  var pars = $$("[data-par]").map(function (el) { return { el: el, frame: el.parentElement, f: parseFloat(el.getAttribute("data-par")) || 0 }; });
  var strip = $("[data-strip]"), track = strip && $(".strip-track", strip), shots = $$(".shot-img");
  var deck = $$(".panel"), leans = $$("[data-lean]"), route = $("[data-route]"), stops = route ? $$("li", route) : [];
  if (!motion()) stops.forEach(function (li) { li.classList.add("on"); });
  var ticking = false;

  function frame() {
    ticking = false;
    var y = scrollY, heroH = hero ? hero.offsetHeight : vh;
    root.classList.toggle("scrolled", y > 24);
    root.classList.toggle("past-hero", y > heroH * .55);

    var line = (hdr ? hdr.getBoundingClientRect().top : 14) + 34, dark = false;
    for (var i = 0; i < darkZones.length; i++) {
      var r = darkZones[i].getBoundingClientRect();
      if (r.top <= line && r.bottom >= line) { dark = true; break; }
    }
    if (hdr) hdr.classList.toggle("dark", dark && !root.classList.contains("menu-open"));

    if (!motion()) return;
    if (heroImg && y < heroH) heroImg.style.setProperty("--hy", (y * .2).toFixed(1) + "px");
    pars.forEach(function (p) {
      var r = p.frame.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) return;
      var off = r.top + r.height / 2 - vh / 2, max = r.height * .085;
      p.el.style.setProperty("--py", clamp(off * p.f, -max, max).toFixed(1) + "px");
    });
    /* the image strip drifts sideways as the page moves, and each frame turns slightly as it passes */
    if (track) {
      var s = strip.getBoundingClientRect();
      if (s.bottom > -80 && s.top < vh + 80) {
        var range = track.scrollWidth - vw, prog = clamp((vh - s.top) / (vh + s.height), 0, 1);
        track.style.setProperty("--sx", (range > 40 ? -range * prog : -range / 2).toFixed(1) + "px");
        shots.forEach(function (el) {
          var b = el.getBoundingClientRect(), k = clamp((b.left + b.width / 2 - vw / 2) / vw, -1, 1);
          el.style.setProperty("--k", k.toFixed(3)); el.style.setProperty("--ka", Math.abs(k).toFixed(3));
          el.style.setProperty("--ix", (-k * b.width * .05).toFixed(1) + "px");
        });
      }
    }

    /* the route draws itself as it comes into view */
    if (route) {
      var rr = route.getBoundingClientRect();
      if (rr.bottom > -40 && rr.top < vh + 40) {
        var rp = clamp((vh * .82 - rr.top) / (rr.height + vh * .3), 0, 1);
        route.style.setProperty("--rp", rp.toFixed(3));
        stops.forEach(function (li, i) { li.classList.toggle("on", rp >= i / stops.length + .04); });
      }
    }

    /* phones have no cursor, so depth comes from the scroll instead */
    if (phone.matches) {
      var dock = (hdr ? hdr.getBoundingClientRect().bottom : 72) + 14;
      deck.forEach(function (p, i) {
        var card = p.firstElementChild, r = p.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var next = deck[i + 1], cover = 0;
        if (next) cover = clamp(1 - (next.getBoundingClientRect().top - r.top) / r.height, 0, 1);
        var enter = clamp((r.top - dock - i * 12) / (vh * .7), 0, 1);
        card.style.setProperty("--s", (1 - cover * .07).toFixed(4));
        card.style.setProperty("--b", (1 - cover * .5).toFixed(3));
        card.style.setProperty("--tx", (enter * 11).toFixed(2) + "deg");
        card.style.setProperty("--gy", (100 - enter * 130).toFixed(1) + "%");
        p.style.setProperty("--b", (1 - cover * .5).toFixed(3));
      });
      leans.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -60 || r.top > vh + 60) return;
        var k = clamp((r.top + r.height / 2 - vh / 2) / (vh * .75), -1, 1);
        el.style.setProperty("--lean", (k * 9).toFixed(2) + "deg");
      });
    }
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", function () { vh = innerHeight; vw = innerWidth; request(); });
  addEventListener("load", request);
  request();

  /* ---------- Phone menu ---------- */
  var menuBtn = $(".menu-btn");
  function setMenu(open, refocus) {
    root.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) setTimeout(function () { var a = $(".mnav a"); if (a) a.focus({ preventScroll: true }); }, 250);
    else if (refocus) menuBtn.focus({ preventScroll: true });
    request();
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () { setMenu(!root.classList.contains("menu-open")); });
    $$(".mnav a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("menu-open")) setMenu(false, true); });
    matchMedia("(min-width: 901px)").addEventListener("change", function (e) { if (e.matches) setMenu(false); });
  }

  /* ---------- Service panels lean toward the cursor ---------- */
  if (fine.matches) $$("[data-tilt]").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      if (!motion()) return;
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add("tilting");
      card.style.setProperty("--ry", ((x - .5) * 11).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((.5 - y) * 8).toFixed(2) + "deg");
      card.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", function () {
      card.classList.remove("tilting");
      card.style.setProperty("--ry", "0deg"); card.style.setProperty("--rx", "0deg");
    });
  });

  /* ---------- Live opening status (salon time, Bahrain) ---------- */
  var OPEN = 10, CLOSE = 20, CLOSED_DAY = 1; /* Tuesday to Sunday, 10 AM to 8 PM. Monday closed. */
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function salonNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", weekday: "long", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      return { day: DAYS.indexOf(o.weekday), h: parseInt(o.hour, 10) % 24, m: parseInt(o.minute, 10) };
    } catch (e) { var d = new Date(); return { day: d.getDay(), h: d.getHours(), m: d.getMinutes() }; }
  }
  function hour(h) { return (h % 12 || 12) + (h < 12 ? " AM" : " PM"); }
  function updateStatus() {
    var n = salonNow(), t = n.h + n.m / 60, openToday = n.day !== CLOSED_DAY, isOpen = openToday && t >= OPEN && t < CLOSE, html;
    if (isOpen) html = "<b>Open now</b> · until " + hour(CLOSE);
    else if (openToday && t < OPEN) html = "<b>Closed now</b> · opens today at " + hour(OPEN);
    else {
      var next = (n.day + 1) % 7, tomorrow = true;
      if (next === CLOSED_DAY) { next = (next + 1) % 7; tomorrow = false; }
      html = "<b>Closed now</b> · opens " + (tomorrow ? "tomorrow" : DAYS[next]) + " at " + hour(OPEN);
    }
    $$("[data-status]").forEach(function (el) {
      el.hidden = false; el.classList.toggle("is-open", isOpen);
      $("[data-status-text]", el).innerHTML = html;
    });
  }
  updateStatus(); setInterval(updateStatus, 60000);

  /* ---------- Price menu: tap services to build a list, then send it on WhatsApp ---------- */
  var tray = $("#tray"), picked = [];
  var rows = $$("[data-menu] .rows li").map(function (li) {
    var pEl = $(".p", li), noteEl = $("i", pEl), note = noteEl ? noteEl.textContent.trim() : "";
    var price = parseFloat(pEl.textContent.replace(note, "").replace(/[^\d.]/g, "")) || 0;
    var row = { li: li, name: $(".n", li).textContent.trim(), price: price, note: note };
    var tick = document.createElement("span");
    tick.className = "tick"; tick.setAttribute("aria-hidden", "true");
    tick.innerHTML = '<svg class="i"><use href="#check"/></svg>';
    li.insertBefore(tick, li.firstChild);
    li.setAttribute("role", "checkbox"); li.setAttribute("aria-checked", "false"); li.tabIndex = 0;
    function toggle() {
      var k = picked.indexOf(row);
      if (k > -1) picked.splice(k, 1); else picked.push(row);
      li.setAttribute("aria-checked", String(k === -1));
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
      renderTray();
    }
    li.addEventListener("click", toggle);
    li.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
    return row;
  });
  function money(v) { return "BHD " + (Math.round(v * 100) / 100); }
  function renderTray() {
    if (!tray) return;
    var n = picked.length, total = 0, open = false;
    picked.forEach(function (r) { total += r.price; if (r.note) open = true; });
    if (n) {
      tray.hidden = false;
      $("[data-tray-count]", tray).textContent = n + (n === 1 ? " service" : " services");
      $("[data-tray-total]", tray).textContent = (open ? "from " : "") + money(total);
      var lines = picked.map(function (r) { return "• " + r.name + " (" + (r.note ? r.note + " " : "") + money(r.price) + ")"; });
      var msg = "Hello XQUIZITE, I'd like to book:\n" + lines.join("\n") + "\nTotal: " + (open ? "from " : "") + money(total) + "\nPreferred day and time: ";
      $("[data-tray-send]", tray).href = WA + "?text=" + encodeURIComponent(msg);
      requestAnimationFrame(function () { tray.classList.add("on"); });
    } else {
      tray.classList.remove("on");
      setTimeout(function () { if (!picked.length) tray.hidden = true; }, 600);
    }
    root.classList.toggle("has-tray", n > 0);
  }
  var clearBtn = $(".tray-clear");
  if (clearBtn) clearBtn.addEventListener("click", function () {
    picked.forEach(function (r) { r.li.setAttribute("aria-checked", "false"); });
    picked = []; renderTray();
  });

  /* ---------- Price menu on phones: categories fold ---------- */
  var cats = $$(".cat");
  function setCat(cat, open) {
    cat.classList.toggle("is-closed", !open);
    var b = $(".cat-toggle", cat); if (b) b.setAttribute("aria-expanded", String(open));
  }
  function layoutCats() {
    cats.forEach(function (c, i) { setCat(c, !phone.matches || i === 0); });
    if (!phone.matches) leans.forEach(function (el) { el.style.removeProperty("--lean"); });
    request();
  }
  layoutCats(); phone.addEventListener("change", layoutCats);
  cats.forEach(function (cat) {
    var b = $(".cat-toggle", cat);
    if (b) b.addEventListener("click", function () { if (phone.matches) setCat(cat, cat.classList.contains("is-closed")); });
  });
  $$('a[href^="#menu-"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var target = $(a.getAttribute("href"));
      if (target && phone.matches) setCat(target, true);
    });
  });

  /* the index beside the menu follows along */
  var indexLinks = $$(".menu-index a");
  if (hasIO && indexLinks.length) {
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        indexLinks.forEach(function (l) { l.classList.toggle("on", l.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-28% 0px -62% 0px" });
    cats.forEach(function (c) { spy.observe(c); });
  }

  /* ---------- Questions open and close smoothly ---------- */
  $$(".faq-list details").forEach(function (d) {
    var s = $("summary", d), a = $(".ans", d), busy = false;
    s.addEventListener("click", function (e) {
      if (!motion() || !a.animate) return;
      e.preventDefault();
      if (busy) return; busy = true;
      var opening = !d.open;
      if (opening) d.open = true;
      var h = a.scrollHeight;
      var anim = a.animate([{ height: (opening ? 0 : h) + "px", opacity: opening ? 0 : 1 }, { height: (opening ? h : 0) + "px", opacity: opening ? 1 : 0 }], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" });
      anim.onfinish = anim.oncancel = function () { if (!opening) d.open = false; busy = false; };
    });
  });

  /* ---------- Map: one tap to take control, so it never hijacks a scroll ---------- */
  $$("[data-map]").forEach(function (map) {
    var shield = $(".map-shield", map);
    if (shield) shield.addEventListener("click", function () { map.classList.add("live"); });
  });

  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  window.siteReady = true;
})();
