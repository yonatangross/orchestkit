import { Bot, FileText, Zap, type LucideIcon } from "lucide-react";
import { HOST_INSTALLS } from "@/lib/host-installs";
import { LIBRARY_STATIONS, type LibraryStationKey } from "@/lib/generated/library-data";
import { libraryItemHref } from "@/lib/library-view";
import { RUN, RUN_DONE, RUN_PROMPT, resolveRunLine } from "@/lib/library-run";
import { HOST_LINES } from "@/lib/library-hosts-view";

const KIND_ICON: Record<"skill" | "agent" | "hook", LucideIcon> = {
  skill: FileText,
  agent: Bot,
  hook: Zap,
};
const KIND_WORD = { skill: "Skill", agent: "Agent", hook: "Hook" } as const;
const STATION_LABEL = Object.fromEntries(
  LIBRARY_STATIONS.map((s) => [s.key, s.label]),
) as Record<LibraryStationKey, string>;

/**
 * Runs before the terminal paints: motion allowed means `html.term-anim`, and
 * CSS then keeps lines 10 to 20 and the done line invisible but in place (no
 * layout jump). If the client has not marked itself ready after 3 s the class
 * is removed, so a failed bundle never hides content.
 */
const NO_FLASH = `(function(){try{var d=document.documentElement;if(window.matchMedia("(prefers-reduced-motion: no-preference)").matches){d.classList.add("term-anim");setTimeout(function(){if(!d.hasAttribute("data-term-ready"))d.classList.remove("term-anim")},3000)}}catch(e){}})();`;

/** How many lines show before the replay starts typing the rest (frame 07). */
export const TERM_STATIC_LINES = 9;

/**
 * The live terminal, as server HTML: all 20 lines are links and the done line
 * is present. `LibraryEnhancer` replays it by typing; it never removes a line.
 */
export function LibraryTerminal() {
  return (
    <div className="term" data-lib-terminal>
      <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      <div className="term-box">
        <div className="term-bar">
          <span className="term-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="term-title">orchestkit run · Claude Code</span>
          <span className="term-ctl" data-term-ctl hidden>
            <button type="button" data-term="pause" aria-pressed="false">
              Pause
            </button>
            <button type="button" data-term="replay">
              Replay
            </button>
            <button type="button" data-term="skip">
              Skip to end
            </button>
          </span>
        </div>
        <p className="term-prompt" data-term-prompt data-text={RUN_PROMPT}>
          <span aria-hidden="true">❯ </span>
          <span data-term-prompt-text>{RUN_PROMPT}</span>
          <span className="term-caret" aria-hidden="true" />
        </p>
        <ol className="term-lines" role="list">
          {RUN.map((line, index) => {
            const item = resolveRunLine(line);
            if (!item) return null;
            const Icon = KIND_ICON[line.kind];
            return (
              <li
                key={item.id}
                className="term-line"
                data-term-line={index}
                data-late={index >= TERM_STATIC_LINES ? "" : undefined}
                data-station={line.station}
              >
                <a
                  href={libraryItemHref(item)}
                  data-lib-item={item.id}
                  data-lib-kind-of={line.kind}
                  data-lib-call={
                    item.kind === "skill" && item.command ? `/ork:${item.name}` : undefined
                  }
                >
                  <span className="term-label">
                    <Icon aria-hidden="true" className="lib-ico" />
                    <span>{line.label ?? KIND_WORD[line.kind]}</span>
                  </span>
                  <span className="term-text" data-text={`${line.name} → ${line.note}`}>
                    <span className="lib-name">{line.name}</span>
                    <span aria-hidden="true"> → </span>
                    <span className="lib-note">{line.note}</span>
                  </span>
                  <span className="term-st">{STATION_LABEL[line.station]}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <p className="term-done" data-term-done data-late="">
          <span aria-hidden="true">✓ </span>
          {RUN_DONE}
        </p>
        <p className="lib-sr" role="status" aria-live="polite" data-term-live />
      </div>
      <p className="term-works">
        <span>Works in</span>{" "}
        {HOST_INSTALLS.map((host) => host.name).join(" · ")}
      </p>
      <p className="term-note">
        This run is Claude Code&apos;s. Hooks run in Claude Code today.
      </p>
      <p className="term-note">
        A replay drawn from the library data: every line is a real skill, agent
        or hook, placed where it acts in a run.
      </p>
      {/* One line per host, every number generated from the pack manifests.
          The client shows the one for ?host=; Claude Code has none. */}
      <div className="term-hosts" data-term-hosts>
        {HOST_LINES.map((host) => (
          <p key={host.id} className="term-note" data-host-line={host.id} hidden>
            {host.line}
          </p>
        ))}
      </div>
    </div>
  );
}
