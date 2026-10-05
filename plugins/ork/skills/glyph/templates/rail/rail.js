(function () {
  "use strict";
  var rail = document.getElementById("pk-rail");
  if (!rail) { return; }
  var links = Array.prototype.slice.call(rail.querySelectorAll(".pk-rail-sec"));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var bar = document.getElementById("pk-rail-bar");
  var now = document.getElementById("pk-rail-now");
  var say = document.getElementById("pk-rail-say");
  var toggle = document.getElementById("pk-rail-toggle");
  // current: the row marked now. asked: the section the reader last jumped to by a click or a key.
  // The last sections can be shorter than the window, so the page can end before their tops reach
  // the reading line; asked keeps them reachable and markable. A wheel, touch or any other key
  // means the reader is scrolling by hand again, which clears it.
  var current = -1, asked = -1;

  function label(a) { return a.querySelector("b").textContent + " " + a.querySelector("span").textContent; }

  function atPageEnd() {
    return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  }

  function pick() {
    var line = window.innerHeight * 0.28, idx = 0, i;
    for (i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top <= line) { idx = i; }
    }
    if (atPageEnd()) { idx = asked >= 0 ? asked : links.length - 1; }
    return idx;
  }

  function mark(idx) {
    if (idx === current) { return; }
    current = idx;
    links.forEach(function (a, n) {
      if (n === idx) { a.setAttribute("aria-current", "true"); } else { a.removeAttribute("aria-current"); }
    });
    now.textContent = label(links[idx]);
    say.textContent = "Current section: " + label(links[idx]);
    if (window.innerWidth >= 1000 && links[idx].scrollIntoView) { links[idx].scrollIntoView({ block: "nearest" }); }
  }

  function update() {
    mark(pick());
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? Math.min(100, Math.max(0, window.scrollY / max * 100)) : 0).toFixed(1) + "%";
  }

  // direct, not rAF-throttled: nine rect reads, and a paused frame loop must never leave the mark stale
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("wheel", function () { asked = -1; }, { passive: true });
  window.addEventListener("touchstart", function () { asked = -1; }, { passive: true });

  function go(i) {
    asked = i;
    if (targets[i]) { targets[i].scrollIntoView({ block: "start" }); }
    update();
  }

  toggle.addEventListener("click", function () {
    var open = !rail.classList.contains("open");
    rail.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  rail.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.pk-rail-sec");
    // the jump is applied after this handler returns; a 0 ms timer reads the page where it landed
    if (a) { asked = links.indexOf(a); setTimeout(update, 0); }
    if (e.target.closest && e.target.closest("a")) {
      rail.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  // [ and ] work only while focus is inside the rail (WCAG 2.1.4: no page-wide single-key shortcut).
  rail.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    if (e.key !== "[" && e.key !== "]") { return; }
    var from = asked >= 0 ? asked : current;
    go(Math.min(links.length - 1, Math.max(0, from + (e.key === "]" ? 1 : -1))));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "[" && e.key !== "]") { asked = -1; }
  });
  update();
}());
