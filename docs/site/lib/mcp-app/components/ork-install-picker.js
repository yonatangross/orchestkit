// ui://orchestkit/install-picker. Data: the orchestkit_install result.
(function (ui) {
  "use strict";
  var h = ui.h;
  function strings(list) { return Array.isArray(list) ? list.filter(function (c) { return typeof c === "string"; }) : []; }
  // Only the fields the view uses, and only when their types match: a wire
  // payload's copy field, extra keys and wrong types are dropped.
  function cleanHost(x) {
    if (!x || typeof x !== "object" || typeof x.id !== "string" || typeof x.name !== "string") return null;
    var commands = strings(x.commands);
    if (!commands.length) return null;
    var next = x.then && typeof x.then === "object" ? strings(x.then.commands) : [];
    return {
      id: x.id, name: x.name, what: ui.text(x.what), where: ui.text(x.where), commands: commands, prompt: x.prompt === true,
      copyLabel: ui.text(x.copyLabel) || "Copy command",
      then: next.length ? { label: ui.text(x.then.label), commands: next } : null,
      docsUrl: x.docsUrl
    };
  }
  function clean(d) {
    var hosts = d && Array.isArray(d.hosts) ? d.hosts.map(cleanHost).filter(Boolean) : [];
    if (!hosts.length) return null;
    var asked = hosts.filter(function (x) { return x.id === d.selected; })[0];
    return { hosts: hosts, selected: asked || hosts[0] };
  }
  ui.define("ork-install-picker", class extends ui.View {
    summary(d) { return clean(d) ? "Install OrchestKit" : ""; }
    render(d) {
      var self = this, data = clean(d);
      if (!data) return this.waiting("install data");
      var out = h("div");
      // Only the part under the radios is redrawn, so the focused radio stays.
      function show(x) {
        out.replaceChildren();
        var parts = [
          self.installCard(x.name, x.where, x.commands, x.prompt, x.copyLabel),
          x.then ? h("p", { "class": "stat then" }, h("span", { text: x.then.label }), x.then.commands.map(function (c) { return h("b", { text: c }); })) : null,
          h("div", { "class": "foot" }, h("span", { text: x.what }), self.link(x.docsUrl, x.name + " install page →"))
        ];
        parts.flat().forEach(function (node) { if (node) out.append(node); });
      }
      var set = h("fieldset", null, h("legend", { "class": "label", text: "Pick where you work" }), h("div", { "class": "chips" }, data.hosts.map(function (x) {
        var input = h("input", { type: "radio", name: "host", id: "host-" + x.id, value: x.id, onchange: function () { if (input.checked) { show(x); self.resized(); } } });
        input.checked = x === data.selected;
        return [input, h("label", { "class": "chip", "for": "host-" + x.id, text: x.name })];
      })));
      show(data.selected);
      return [h("p", { "class": "eyebrow", text: "Install" }), h("h1", { text: "Install OrchestKit" }), set, out];
    }
  });
})(window.OrkMcp);
