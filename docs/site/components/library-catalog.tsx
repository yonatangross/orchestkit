import type { ReactNode } from "react";
import {
  Bot,
  Brain,
  ClipboardList,
  FileText,
  Hammer,
  MessageCircle,
  Rocket,
  Shield,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LibraryEnhancer } from "@/components/library-enhancer";
import {
  LIBRARY_COUNTS,
  LIBRARY_ITEMS,
  LIBRARY_STATIONS,
  type LibraryStationKey,
} from "@/lib/generated/library-data";
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_LABEL,
  LIBRARY_STATION_ORDER,
  libraryItemHref,
  libraryItemNote,
  libraryItemSearchText,
  type LibraryKind,
} from "@/lib/library-view";
import "./library-section.css";

const STATION_ICON: Record<LibraryStationKey, LucideIcon> = {
  ask: MessageCircle,
  plan: ClipboardList,
  build: Hammer,
  guard: Shield,
  check: ShieldCheck,
  ship: Rocket,
  remember: Brain,
};

const KIND_ICON = { skill: FileText, agent: Bot, hook: Zap } as const;

const STATION_BY_KEY = Object.fromEntries(
  LIBRARY_STATIONS.map((s) => [s.key, s]),
) as Record<LibraryStationKey, (typeof LIBRARY_STATIONS)[number]>;

const KIND_COUNT: Record<LibraryKind, number> = {
  all: LIBRARY_COUNTS.items,
  skill: LIBRARY_COUNTS.skills,
  agent: LIBRARY_COUNTS.agents,
  hook: LIBRARY_COUNTS.hooks,
};

/**
 * Without JS a chip is a hash link and CSS `:target` picks the rows (ruling
 * 2105, option 1). The `:target` elements sit at the section top with a
 * scroll-margin, and `:has()` is scoped to this section, never to body. With
 * JS the section gets `lib-js` and the client reads `?station=` / `?kind=`.
 */
const NO_JS_RULES = [
  ...LIBRARY_STATION_ORDER.map(
    (key) =>
      `#library:not(.lib-js):has(#station-${key}:target) .lib-row:not([data-station="${key}"]){display:none}` +
      `#library:not(.lib-js) a[href="#station-${key}"]:target,#library:not(.lib-js):has(#station-${key}:target) a[href="#station-${key}"]{border-color:var(--lib-gold);box-shadow:var(--lib-glow)}`,
  ),
  ...LIBRARY_KINDS.filter((k) => k !== "all").map(
    (kind) =>
      `#library:not(.lib-js):has(#kind-${kind}:target) .lib-row:not([data-kind="${kind}"]){display:none}` +
      `#library:not(.lib-js):has(#kind-${kind}:target) a[href="#kind-${kind}"]{border-color:var(--lib-gold);box-shadow:var(--lib-glow)}`,
  ),
].join("\n");

function StationChip({
  station,
  className,
}: {
  station: LibraryStationKey;
  className: string;
}) {
  const Icon = STATION_ICON[station];
  const label = STATION_BY_KEY[station].label;
  return (
    <a
      href={`#station-${station}`}
      data-lib-station={station}
      className={className}
    >
      <Icon aria-hidden="true" className="lib-ico" />
      <span>{label}</span>
    </a>
  );
}

/**
 * The library section. A server component: every one of the 303 items is a
 * plain `<a href>` in one flat list. `LibraryEnhancer` (client) only hides
 * rows; it never renders them. `scene` is the one slot above the list.
 */
export function LibraryCatalog({ scene }: { scene?: ReactNode }) {
  return (
    <section id="library" aria-labelledby="library-heading" className="lib">
      <style dangerouslySetInnerHTML={{ __html: NO_JS_RULES }} />
      {LIBRARY_STATION_ORDER.map((key) => (
        <span key={key} id={`station-${key}`} className="lib-target" />
      ))}
      {LIBRARY_KINDS.filter((k) => k !== "all").map((kind) => (
        <span key={kind} id={`kind-${kind}`} className="lib-target" />
      ))}
      <div className="lib-inner">
        <p className="lib-eyebrow">Library</p>
        <h2 id="library-heading" className="lib-h2">
          One request, <code>/ork:implement</code>, through all seven stations.
        </h2>
        <p className="lib-sub">
          Watch which skills load, which agents start and which hooks fire. Click
          a line to open that item, or a station to list it.
        </p>
        <p className="lib-skips">
          <a href="#library-list">Skip to all {LIBRARY_COUNTS.items} &rarr;</a>
          <a href="#after-library">Skip past the library &rarr;</a>
        </p>

        <nav aria-label="Stations" className="lib-rail">
          {LIBRARY_STATION_ORDER.map((key) => (
            <StationChip key={key} station={key} className="lib-rail-btn" />
          ))}
        </nav>

        <div className="lib-grid">
          {scene ? <div className="lib-scene">{scene}</div> : null}
          <div className="lib-panel">
            <div className="lib-panel-head">
              <span>All {LIBRARY_COUNTS.items}</span>
              <span data-lib-count>
                {LIBRARY_COUNTS.items} of {LIBRARY_COUNTS.items}
              </span>
            </div>
            <search className="lib-search" hidden>
              <label className="lib-sr" htmlFor="lib-search-input">
                Search {LIBRARY_COUNTS.items} items
              </label>
              <input
                id="lib-search-input"
                type="search"
                autoComplete="off"
                placeholder={`Search ${LIBRARY_COUNTS.items} items`}
                data-lib-search
              />
            </search>
            <div className="lib-kinds" role="group" aria-label="Kind">
              {LIBRARY_KINDS.map((kind) => (
                <a
                  key={kind}
                  href={kind === "all" ? "#library-list" : `#kind-${kind}`}
                  data-lib-kind={kind}
                  className="lib-seg"
                >
                  {LIBRARY_KIND_LABEL[kind]}
                  <small>{KIND_COUNT[kind]}</small>
                </a>
              ))}
            </div>
            <div className="lib-chips" role="group" aria-label="Station">
              <span className="lib-chip-all">All stations</span>
              {LIBRARY_STATION_ORDER.map((key) => (
                <StationChip key={key} station={key} className="lib-chip" />
              ))}
            </div>
            <p className="lib-empty" data-lib-empty hidden>
              Nothing matches. Clear the search or pick another station.
            </p>
            <ul id="library-list" className="lib-list" role="list">
              {LIBRARY_ITEMS.map((item) => {
                const KindIcon = KIND_ICON[item.kind];
                const StationIcon = STATION_ICON[item.station];
                return (
                  <li
                    key={item.id}
                    className="lib-row"
                    data-kind={item.kind}
                    data-station={item.station}
                    data-text={libraryItemSearchText(item)}
                  >
                    <a
                      href={libraryItemHref(item)}
                      data-lib-item={item.id}
                      data-lib-call={
                        item.kind === "skill" && item.command
                          ? `/ork:${item.name}`
                          : undefined
                      }
                    >
                      <KindIcon aria-hidden="true" className="lib-ico" />
                      <span className="lib-main">
                        <span className="lib-name">{item.name}</span>
                        <span className="lib-note">{libraryItemNote(item)}</span>
                      </span>
                      <span className="lib-st" title={STATION_BY_KEY[item.station].label}>
                        <StationIcon aria-hidden="true" className="lib-ico" />
                        <span className="lib-sr">
                          {STATION_BY_KEY[item.station].label}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
      {/* The drawer: filled from the clicked row, so it needs no data bundle.
          Without JS the row link simply navigates to the page. */}
      <dialog
        className="lib-drawer"
        aria-labelledby="lib-drawer-title"
        data-lib-drawer
      >
        <div className="lib-drawer-head">
          <p className="lib-eyebrow" data-lib-drawer-kind />
          <button type="button" className="lib-drawer-close" data-lib-drawer-close>
            Close
          </button>
        </div>
        <h3 id="lib-drawer-title" className="lib-drawer-title" data-lib-drawer-title />
        <p className="lib-drawer-desc" data-lib-drawer-desc />
        <p className="lib-drawer-station" data-lib-drawer-station />
        <div className="lib-drawer-call" data-lib-drawer-call hidden>
          <span>Call it</span>
          <code data-lib-drawer-call-text />
        </div>
        <a className="lib-drawer-open" href="/docs" data-lib-drawer-open>
          Open the page &rarr;
        </a>
      </dialog>
      <LibraryEnhancer />
      <span id="after-library" />
    </section>
  );
}
