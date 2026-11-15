"use client";

import { useEffect } from "react";
import { createRunPlayer } from "@/lib/library-player";
import {
  parseKindParam,
  parseStationParam,
  rowMatches,
  type LibraryFilter,
} from "@/lib/library-view";

/**
 * The client layer of the library section. It renders nothing: the 303 links
 * come from the server and stay in the DOM before, during and after a search.
 * This only hides and shows rows, reads and writes `?station=` / `?kind=`
 * (so `/` stays static: no searchParams prop), and turns the hash-link chips
 * into toggles. Without JS the CSS `:target` rules do the filtering instead.
 */
export function LibraryEnhancer() {
  useEffect(() => {
    const root = document.getElementById("library");
    if (!root) return;
    const list = root.querySelector<HTMLUListElement>("#library-list");
    if (!list) return;
    const rows = Array.from(list.querySelectorAll<HTMLLIElement>(".lib-row"));
    const index = rows.map((row) => ({
      row,
      kind: row.dataset.kind ?? "",
      station: row.dataset.station ?? "",
      text: row.dataset.text ?? "",
    }));
    const input = root.querySelector<HTMLInputElement>("[data-lib-search]");
    const count = root.querySelector<HTMLElement>("[data-lib-count]");
    const empty = root.querySelector<HTMLElement>("[data-lib-empty]");
    const search = root.querySelector<HTMLElement>(".lib-search");

    const params = new URLSearchParams(window.location.search);
    // The per-host line for ?host= (Claude Code and unknown values show none).
    const hostParam = params.get("host");
    for (const line of root.querySelectorAll<HTMLElement>("[data-host-line]")) {
      line.hidden = line.dataset.hostLine !== hostParam;
    }
    const filter: LibraryFilter = {
      kind: parseKindParam(params.get("kind")),
      station: parseStationParam(params.get("station")),
      query: "",
    };

    const apply = () => {
      let shown = 0;
      for (const entry of index) {
        const show = rowMatches(entry, filter);
        entry.row.hidden = !show;
        if (show) shown += 1;
      }
      if (count) count.textContent = `${shown} of ${index.length}`;
      if (empty) empty.hidden = shown !== 0;
      for (const el of root.querySelectorAll<HTMLElement>("[data-lib-station]")) {
        const on = el.dataset.libStation === filter.station;
        el.setAttribute("aria-pressed", String(on));
      }
      for (const el of root.querySelectorAll<HTMLElement>("[data-lib-kind]")) {
        const on = el.dataset.libKind === filter.kind;
        el.setAttribute("aria-pressed", String(on));
      }
    };

    const writeUrl = () => {
      const next = new URLSearchParams(window.location.search);
      if (filter.station) next.set("station", filter.station);
      else next.delete("station");
      if (filter.kind !== "all") next.set("kind", filter.kind);
      else next.delete("kind");
      const query = next.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    };

    // The drawer: native <dialog>, so Esc closes it and the browser returns
    // focus to the opener; we also restore it ourselves for engines that do not.
    const drawer = root.querySelector<HTMLDialogElement>("[data-lib-drawer]");
    let opener: HTMLElement | null = null;
    const fill = (selector: string, text: string) => {
      const el = drawer?.querySelector<HTMLElement>(selector);
      if (el) el.textContent = text;
    };
    const openDrawer = (link: HTMLAnchorElement) => {
      if (!drawer) return;
      const row = link.closest<HTMLElement>(".lib-row");
      const name = link.querySelector(".lib-name")?.textContent ?? "";
      const note = link.querySelector(".lib-note")?.textContent ?? "";
      const kind = row?.dataset.kind ?? link.dataset.libKindOf ?? "";
      const station =
        link.querySelector(".lib-st .lib-sr")?.textContent ??
        link.querySelector(".term-st")?.textContent ??
        "";
      fill("[data-lib-drawer-title]", name);
      fill("[data-lib-drawer-desc]", note);
      fill("[data-lib-drawer-kind]", kind ? kind : "item");
      fill("[data-lib-drawer-station]", station ? `Station: ${station}` : "");
      const call = drawer.querySelector<HTMLElement>("[data-lib-drawer-call]");
      const callText = link.dataset.libCall ?? "";
      if (call) call.hidden = callText === "";
      fill("[data-lib-drawer-call-text]", callText);
      drawer
        .querySelector<HTMLAnchorElement>("[data-lib-drawer-open]")
        ?.setAttribute("href", link.getAttribute("href") ?? "/docs");
      opener = link;
      root.dispatchEvent(new CustomEvent("lib-drawer", { detail: { open: true } }));
      drawer.showModal();
    };
    const onDrawerClose = () => {
      root.dispatchEvent(new CustomEvent("lib-drawer", { detail: { open: false } }));
      opener?.focus({ preventScroll: true });
      opener = null;
    };
    const onDrawerClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // The backdrop is the dialog element itself.
      if (target === drawer || target.closest("[data-lib-drawer-close]")) drawer?.close();
    };
    drawer?.addEventListener("close", onDrawerClose);
    drawer?.addEventListener("click", onDrawerClick);

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const itemLink = target.closest<HTMLAnchorElement>("a[data-lib-item]");
      if (itemLink && drawer) {
        event.preventDefault();
        openDrawer(itemLink);
        return;
      }
      const chip = target.closest<HTMLElement>("[data-lib-station]");
      const seg = target.closest<HTMLElement>("[data-lib-kind]");
      if (chip) {
        event.preventDefault();
        const key = parseStationParam(chip.dataset.libStation);
        filter.station = filter.station === key ? null : key;
      } else if (seg) {
        event.preventDefault();
        filter.kind = parseKindParam(seg.dataset.libKind);
      } else {
        return;
      }
      apply();
      writeUrl();
    };

    const onInput = () => {
      filter.query = input?.value ?? "";
      apply();
    };

    // The terminal replay. The 20 lines are server links; this only hides
    // and shows them, and announces the done line once per run.
    const termBox = root.querySelector<HTMLElement>(".term-box");
    const termLines = Array.from(
      root.querySelectorAll<HTMLElement>("[data-term-line]"),
    );
    const termDone = root.querySelector<HTMLElement>("[data-term-done]");
    const live = root.querySelector<HTMLElement>("[data-term-live]");
    const pauseBtn = root.querySelector<HTMLButtonElement>('[data-term="pause"]');
    const ctl = root.querySelector<HTMLElement>("[data-term-ctl]");
    // The lines the server marks data-late are the ones typed on the first run.
    const staticCount = termLines.filter((l) => !l.hasAttribute("data-late")).length;
    const doneText = termDone?.textContent?.replace("✓", "").trim() ?? "";
    const rail = Array.from(
      root.querySelectorAll<HTMLElement>(".lib-rail-btn[data-lib-station]"),
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let userPaused = false;
    let drawerOpen = false;
    let visible = false;

    const light = (station: string | null) => {
      for (const btn of rail) {
        if (station && btn.dataset.libStation === station) btn.setAttribute("data-active", "");
        else btn.removeAttribute("data-active");
      }
    };
    const player = createRunPlayer({
      total: termLines.length,
      lineDelayMs: 450,
      later: (fn, ms) => {
        const id = window.setTimeout(fn, ms);
        return () => window.clearTimeout(id);
      },
      show: (i, typed) => {
        const line = termLines[i];
        if (!line) return;
        line.removeAttribute("data-hide");
        line.setAttribute("data-shown", "");
        const text = line.querySelector<HTMLElement>(".term-text");
        text?.classList.remove("term-typing");
        if (typed && text) {
          void text.offsetWidth;
          text.classList.add("term-typing");
          light(line.dataset.station ?? null);
        }
      },
      reset: () => {
        for (const line of termLines) {
          line.setAttribute("data-hide", "");
          line.removeAttribute("data-shown");
        }
        termDone?.setAttribute("data-hide", "");
        termDone?.removeAttribute("data-shown");
        if (live) live.textContent = "";
        light(null);
      },
      onFinish: () => {
        termDone?.removeAttribute("data-hide");
        termDone?.setAttribute("data-shown", "");
        light(null);
        // One announcement per run, the done line itself.
        if (live) live.textContent = doneText;
      },
      onState: (state) => {
        if (pauseBtn) {
          pauseBtn.textContent = state === "paused" ? "Play" : "Pause";
          pauseBtn.setAttribute("aria-pressed", String(state === "paused"));
          pauseBtn.disabled = state === "finished";
        }
      },
    });
    const wantPlaying = () => visible && !drawerOpen && !userPaused;
    const sync = () => {
      if (reduced || !termBox) return;
      if (wantPlaying()) {
        // First run: lines 1 to 9 are already on screen, type only the rest.
        if (player.state === "idle") player.startFrom(staticCount);
        else player.start();
      } else if (player.state === "playing") {
        player.pause();
      }
    };
    const onTermClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>("[data-term]");
      if (!button) return;
      const action = button.dataset.term;
      if (action === "pause") {
        userPaused = player.state === "playing";
        if (userPaused) player.pause();
        else if (player.state === "paused") player.start();
      } else if (action === "replay") {
        userPaused = false;
        player.replay();
      } else if (action === "skip") {
        player.skip();
      }
    };
    const onDrawerEvent = (event: Event) => {
      drawerOpen = (event as CustomEvent<{ open: boolean }>).detail.open;
      sync();
    };
    let observer: IntersectionObserver | null = null;
    if (termBox && termLines.length > 0) {
      if (reduced) {
        // Reduced motion: the finished state at once, no typing, no caret.
        player.showFinished();
      } else {
        observer = new IntersectionObserver(
          (entries) => {
            visible = entries.some((e) => e.intersectionRatio >= 0.5);
            sync();
          },
          { threshold: [0, 0.5, 1] },
        );
        observer.observe(termBox);
      }
      ctl?.removeAttribute("hidden");
      root.addEventListener("click", onTermClick);
      root.addEventListener("lib-drawer", onDrawerEvent);
    }
    // Tells the no-flash fallback that the client started.
    document.documentElement.setAttribute("data-term-ready", "");

    root.classList.add("lib-js");
    if (search) search.hidden = false;
    // A hash left over from a no-JS chip tap must not hide rows twice.
    root.addEventListener("click", onClick);
    input?.addEventListener("input", onInput);
    apply();
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("click", onTermClick);
      root.removeEventListener("lib-drawer", onDrawerEvent);
      observer?.disconnect();
      document.documentElement.removeAttribute("data-term-ready");
      drawer?.removeEventListener("close", onDrawerClose);
      drawer?.removeEventListener("click", onDrawerClick);
      input?.removeEventListener("input", onInput);
      root.classList.remove("lib-js");
      if (search) search.hidden = true;
    };
  }, []);

  return null;
}
