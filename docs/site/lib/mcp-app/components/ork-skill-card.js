// ui://orchestkit/skill-card. Data: the orchestkit_skill_get result, a found
// skill or the nearest names to a miss.
(function (ui) {
  "use strict";
  var h = ui.h;
  function eyebrow() { return h("p", { "class": "eyebrow", text: "Skill" }); }
  ui.define("ork-skill-card", class extends ui.View {
    summary(d) {
      if (!d || typeof d !== "object") return "";
      return d.found === false ? "No skill with that name" : "Skill " + String(d.name);
    }
    render(d) {
      if (!d || typeof d !== "object") return this.waiting("skill data");
      if (d.found === false) return this.miss(d);
      var self = this, name = String(d.name), said = ui.status();
      var lines = ui.text(d.installCommand).split(" && ").filter(Boolean);
      return [eyebrow(),
        h("div", { "class": "head" }, h("h1", { "class": "mono", text: name }), h("span", { "class": "tag", text: String(d.plugin) + " plugin" })),
        h("p", { "class": "stat" },
          d.version ? h("span", { text: "v" + String(d.version) }) : null,
          d.invoke ? h("span", null, "run ", h("b", { text: String(d.invoke) })) : null),
        h("p", { text: ui.text(d.summary) || ui.text(d.description) }),
        d.useWhen ? h("p", { "class": "muted small gap", text: String(d.useWhen) }) : null,
        lines.length ? h("div", { "class": "gap" }, this.installCard("Claude Code", "Paste in a terminal.", lines, true, lines.length > 1 ? "Copy both commands" : "Copy command")) : null,
        h("div", { "class": "foot" },
          this.link(d.docsUrl, name + " docs →"),
          h("button", { "class": "link other", type: "button", text: "Other hosts →", onclick: function () {
            self.ask("Show me how to install OrchestKit in Cursor or Codex", said, "Ask how to install OrchestKit in Cursor or Codex.");
          } })),
        said];
    }
    miss(d) {
      var self = this, near = Array.isArray(d.suggestions) ? d.suggestions.map(String) : [], said = ui.status();
      return [eyebrow(),
        h("h1", { text: near.length ? "Did you mean " + near[0] + "?" : "No such skill" }),
        h("p", { "class": "sub" }, "OrchestKit has no skill named ", h("span", { "class": "code", text: String(d.query) }), "."),
        near.length
          ? [h("div", { "class": "chips near" }, near.map(function (n) {
              return h("button", { "class": "chip", type: "button", text: "Show " + n, onclick: function () {
                self.ask("Show me the OrchestKit skill card for " + n, said, "Ask for “" + n + "” by name.");
              } });
            })), said]
          : h("p", { "class": "muted", text: "Nothing close. Search the docs with orchestkit_docs_search." }),
        h("div", { "class": "foot" }, this.link(d.browseUrl, "Browse all skills →"))];
    }
  });
})(window.OrkMcp);
