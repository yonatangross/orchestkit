// MCP App views for the docs MCP: the skill card and the install picker.
// Same plumbing as lib/mcp-ui.ts (a ui:// resource of text/html;profile=mcp-app,
// bound to a tool through _meta.ui.resourceUri and openai/outputTemplate), with
// stricter rules because these two views need no data after they load:
//   - connect-src 'none': the frame makes no network call. The host hands the
//     view its data; picking a host and copying a command happen in the frame.
//   - no external script, no font, no image: one inline script, inline style.
//   - text is written with textContent, never innerHTML.
// The CSP travels inside the document (<meta http-equiv>) because the view ships
// as a JSON-RPC string, not an HTTP response (see lib/mcp-ui.ts).

export const UI_SKILL_CARD = "ui://orchestkit/skill-card";
export const UI_INSTALL_PICKER = "ui://orchestkit/install-picker";

export const CARD_CSP = [
	"default-src 'none'",
	"script-src 'unsafe-inline'",
	"style-src 'unsafe-inline'",
	"img-src data:",
	"connect-src 'none'",
	"frame-ancestors https://chatgpt.com https://claude.ai",
	"form-action 'none'",
	"base-uri 'none'",
].join("; ");

// Colors: every text pair is at least 4.5:1 (body and muted text, code, the
// button label on its fill, the checked chip), in both schemes. Focus is a 3 px
// ring in the accent color, shown for keyboard focus only.
const CARD_CSS = `
  :root{color-scheme:light dark;--bg:#ffffff;--fg:#111827;--muted:#4b5563;--accent:#4338ca;--on-accent:#ffffff;--surface:#f8fafc;--border:#cbd5e1;--code-bg:#f1f5f9;--warn:#92400e}
  @media (prefers-color-scheme:dark){:root{--bg:#0e1626;--fg:#e9eef7;--muted:#a3b3cc;--accent:#a5b4fc;--on-accent:#0e1626;--surface:#111a2e;--border:#2a3a5c;--code-bg:#0a101d;--warn:#fcd34d}}
  *{box-sizing:border-box}
  body{margin:0;padding:12px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg)}
  .card{max-width:640px;margin:0 auto;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px}
  h1{margin:4px 0 8px;font-size:1.35rem;line-height:1.25;overflow-wrap:anywhere}
  h2{margin:16px 0 6px;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  p{margin:0 0 8px}
  .muted{color:var(--muted)}
  .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0}
  .badge{display:inline-block;padding:2px 10px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);font-size:.82rem;font-weight:600}
  .cmd{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap}
  pre{flex:1 1 220px;min-width:0;margin:0;padding:10px 12px;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;color:var(--fg);font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;user-select:all}
  .ln[data-p]::before{content:"$ ";color:var(--muted);user-select:none}
  button{min-height:44px;padding:8px 16px;border:0;border-radius:8px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:600;cursor:pointer}
  button:hover{filter:brightness(1.08)}
  a{color:var(--accent);font-weight:600;overflow-wrap:anywhere}
  a:focus-visible,button:focus-visible,input:focus-visible+label{outline:3px solid var(--accent);outline-offset:2px}
  .status{min-height:1.5em;margin:6px 0 0;color:var(--muted);font-size:.9rem}
  ul.near{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px}
  ul.near li{padding:4px 10px;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  fieldset{margin:0 0 12px;padding:0;border:0;min-width:0}
  legend{padding:0;margin:0 0 8px;font-weight:600}
  .seg{display:flex;flex-wrap:wrap;gap:8px}
  .seg input{position:absolute;opacity:0;width:1px;height:1px}
  .seg label{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--fg);cursor:pointer;font-weight:600}
  .seg input:checked+label{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
  .then{margin-top:12px}
  @media (prefers-reduced-motion:no-preference){button{transition:filter .15s}}
`;

// Shared script prelude: DOM helpers, the copy action, and the three ways a host
// can hand the view its data (OpenAI Apps SDK toolOutput, the MCP-UI render
// message, and the MCP Apps ui/initialize handshake with ui/notifications/tool-result).
const CARD_RUNTIME = `
  var root=document.getElementById("root");
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=text;return n;}
  function safeUrl(u){return typeof u==="string"&&u.indexOf("https://orchestkit.dev/")===0?u:null;}
  function link(href,label){var u=safeUrl(href);if(!u)return null;var a=el("a","",label);a.href=u;a.target="_blank";a.rel="noopener noreferrer";return a;}
  function copyButton(getText,status,label){
    var b=el("button","",label);b.type="button";b.setAttribute("data-copy",getText());
    b.addEventListener("click",function(){
      var text=b.getAttribute("data-copy");
      function done(ok){status.textContent=ok?"Copied to the clipboard.":"Copy was blocked here. Select the command and press Ctrl+C.";}
      function fallback(){
        var ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");
        ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();
        var ok=false;try{ok=document.execCommand("copy");}catch(e){ok=false;}
        document.body.removeChild(ta);done(ok);
      }
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){done(true);},fallback);}else{fallback();}
    });
    return b;
  }
  function commandBlock(lines,prompt){
    var pre=el("pre","");pre.tabIndex=0;
    lines.forEach(function(l,i){var s=el("span","ln",l);if(prompt)s.setAttribute("data-p","1");pre.appendChild(s);if(i<lines.length-1)pre.appendChild(document.createTextNode("\\n"));});
    return pre;
  }
  function tell(parent,message){parent.postMessage(message,"*");}
  function reportSize(){try{tell(window.parent,{jsonrpc:"2.0",method:"ui/notifications/size-changed",params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}});}catch(e){}}
  function start(render){
    render(window.openai&&window.openai.toolOutput);
    window.addEventListener("message",function(e){
      var d=e.data;if(!d||typeof d!=="object")return;
      if(d.type==="ui-lifecycle-iframe-render-data"){render(d.payload&&d.payload.toolOutput);reportSize();}
      else if(d.method==="ui/notifications/tool-result"){render(d.params&&d.params.structuredContent);reportSize();}
      else if(d.id===1&&d.result){tell(window.parent,{jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}});reportSize();}
    });
    if(window.parent&&window.parent!==window){tell(window.parent,{jsonrpc:"2.0",id:1,method:"ui/initialize",params:{appInfo:{name:document.title,version:"1.0.0"},appCapabilities:{},protocolVersion:"2026-01-26"}});}
  }
`;

function page(title: string, script: string): string {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="${CARD_CSP}" />
<meta name="color-scheme" content="light dark" />
<title>${title}</title>
<style>${CARD_CSS}</style></head>
<body><main class="card" id="root" aria-live="polite"><p class="muted">Waiting for data from the host…</p></main>
<script>(function(){${CARD_RUNTIME}${script}})();</script></body></html>`;
}

export const SKILL_CARD_HTML = page(
	"OrchestKit skill card",
	`
  function render(d){
    root.textContent="";
    if(!d||typeof d!=="object"){root.appendChild(el("p","muted","Waiting for skill data from the host…"));return;}
    if(d.found===false){
      root.appendChild(el("h1","","No such skill"));
      root.appendChild(el("p","muted","OrchestKit has no skill named \\u201c"+String(d.query)+"\\u201d."));
      var near=Array.isArray(d.suggestions)?d.suggestions:[];
      if(near.length){
        root.appendChild(el("h2","","Nearest names"));
        var ul=el("ul","near");near.forEach(function(n){ul.appendChild(el("li","",String(n)));});root.appendChild(ul);
        root.appendChild(el("p","muted","Ask for one of these by name to see its card."));
      }else{
        root.appendChild(el("p","muted","Nothing close. Search the docs with orchestkit_docs_search."));
      }
      return;
    }
    var meta=el("p","meta");
    meta.appendChild(el("span","badge","plugin: "+String(d.plugin)));
    meta.appendChild(el("span","muted","v"+String(d.version)));
    root.appendChild(meta);
    root.appendChild(el("h1","",String(d.name)));
    root.appendChild(el("p","",String(d.description)));
    if(d.invoke){root.appendChild(el("h2","","Run it"));var run=commandBlock([String(d.invoke)],false);root.appendChild(run);}
    root.appendChild(el("h2","","Install in Claude Code"));
    var row=el("div","cmd");
    row.appendChild(commandBlock([String(d.installCommand)],true));
    var status=el("p","status");status.setAttribute("role","status");
    row.appendChild(copyButton(function(){return String(d.installCommand);},status,"Copy install command"));
    root.appendChild(row);root.appendChild(status);
    var docs=link(d.docsUrl,"Read the docs page");if(docs)root.appendChild(docs);
  }
  start(render);
`,
);

export const INSTALL_PICKER_HTML = page(
	"OrchestKit install picker",
	`
  var data=null;
  function hostById(id){for(var i=0;i<data.hosts.length;i++){if(data.hosts[i].id===id)return data.hosts[i];}return data.hosts[0];}
  function paint(id){
    var h=hostById(id);var out=document.getElementById("out");out.textContent="";
    out.appendChild(el("p","",h.what));
    out.appendChild(el("p","muted",h.where));
    var row=el("div","cmd");row.appendChild(commandBlock(h.commands,h.prompt));
    var status=el("p","status");status.setAttribute("role","status");
    row.appendChild(copyButton(function(){return h.copy;},status,"Copy command"));
    out.appendChild(row);out.appendChild(status);
    if(h.then){var t=el("div","then");t.appendChild(el("h2","",h.then.label));t.appendChild(commandBlock(h.then.commands,h.then.prompt));out.appendChild(t);}
    var docs=link(h.docsUrl,"Read the "+h.name+" install page");if(docs){var p=el("p","");p.style.marginTop="12px";p.appendChild(docs);out.appendChild(p);}
  }
  function render(d){
    root.textContent="";
    if(!d||typeof d!=="object"||!Array.isArray(d.hosts)||!d.hosts.length){root.appendChild(el("p","muted","Waiting for install data from the host…"));return;}
    data=d;
    var fs=el("fieldset","");fs.appendChild(el("legend","","Install OrchestKit in"));
    var seg=el("div","seg");
    d.hosts.forEach(function(h){
      var input=document.createElement("input");input.type="radio";input.name="host";input.id="host-"+h.id;input.value=h.id;input.checked=(h.id===d.selected);
      input.addEventListener("change",function(){if(input.checked)paint(h.id);});
      var label=el("label","",h.name);label.htmlFor=input.id;
      seg.appendChild(input);seg.appendChild(label);
    });
    fs.appendChild(seg);root.appendChild(fs);
    var out=el("div","");out.id="out";root.appendChild(out);
    paint(d.selected);
  }
  start(render);
`,
);
