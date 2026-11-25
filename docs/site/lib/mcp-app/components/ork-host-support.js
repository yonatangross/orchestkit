// ui://orchestkit/host-support. Data: the orchestkit_host_support result.
(function (ui) {
  "use strict";
  var h = ui.h;
  function strings(list) { return Array.isArray(list) ? list.filter(function (c) { return typeof c === "string"; }) : []; }
  function cleanHost(x) {
    if (!x || typeof x !== "object" || typeof x.id !== "string" || typeof x.name !== "string") return null;
    var commands = strings(x.commands);
    if (!commands.length) return null;
    return {
      id: x.id, name: x.name, gets: ui.text(x.gets), hooks: x.hooks === true, where: ui.text(x.where), commands: commands,
      prompt: x.prompt === true, copyLabel: ui.text(x.copyLabel) || "Copy command", docsUrl: x.docsUrl
    };
  }
  function clean(d) {
    var hosts = d && Array.isArray(d.hosts) ? d.hosts.map(cleanHost).filter(Boolean) : [];
    if (!hosts.length) return null;
    var asked = hosts.filter(function (x) { return x.id === d.selected; })[0];
    var counts = d.counts && typeof d.counts === "object" ? d.counts : {};
    return { hosts: hosts, selected: asked || hosts[0], counts: counts, hooksLimit: ui.text(d.hooksLimit) };
  }
  function count(n, label) { return typeof n === "number" ? h("span", null, h("b", { text: String(n) }), " " + label) : null; }
  ui.define("ork-host-support", class extends ui.View {
    summary(d) { var data = clean(d); return data ? "What you get on " + data.hosts.length + " hosts" : ""; }
    render(d) {
      var self = this, data = clean(d);
      if (!data) return this.waiting("host data");
      var title = h("h1"), out = h("div");
      // Only the title and the part under the radios are redrawn, so the
      // focused radio stays.
      function show(x) {
        title.textContent = "OrchestKit on " + x.name;
        out.replaceChildren();
        [
          h("p", { "class": "gap", text: "You get " + x.gets + "." }),
          h("div", { "class": "gap" }, self.installCard(x.name, x.where, x.commands, x.prompt, x.copyLabel)),
          h("div", { "class": "foot" }, h("span", { text: data.hooksLimit }), self.link(x.docsUrl, x.name + " install page →"))
        ].forEach(function (node) { out.append(node); });
      }
      var set = h("fieldset", null, h("legend", { "class": "label", text: "Pick a host" }), h("div", { "class": "hosts" }, data.hosts.map(function (x) {
        var input = h("input", { type: "radio", name: "host", id: "host-" + x.id, value: x.id, onchange: function () { if (input.checked) { show(x); self.resized(); } } });
        input.checked = x === data.selected;
        return h("div", null, input, h("label", { "class": "host", "for": "host-" + x.id },
          h("b", { text: x.name }),
          h("span", { "class": x.hooks ? "tag" : "tag quiet" }, ui.icon(x.hooks ? "check" : "minus"), x.hooks ? "hooks run" : "skills, no hooks")));
      })));
      show(data.selected);
      return [h("p", { "class": "eyebrow", text: "What you get per host" }), title,
        h("p", { "class": "stat" }, count(data.counts.skills, "skills"), count(data.counts.agents, "agents"), count(data.counts.hooks, "hooks"), count(data.hosts.length, "hosts")),
        set, out];
    }
  });
})(window.OrkMcp);
