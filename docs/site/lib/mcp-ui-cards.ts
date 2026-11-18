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
// button label on its fill, the selected host), in both schemes. Focus is a 3 px
// ring in the accent color, shown for keyboard focus only. Spacing sits on the
// 4, 8, 12, 16, 24 scale. One solid element per card: the copy button.
const CARD_CSS = `
  :root{color-scheme:light dark;--bg:#ffffff;--fg:#111827;--muted:#4b5563;--accent:#4338ca;--on-accent:#ffffff;--surface:#f8fafc;--border:#cbd5e1;--code-bg:#f1f5f9}
  @media (prefers-color-scheme:dark){:root{--bg:#0e1626;--fg:#e9eef7;--muted:#a3b3cc;--accent:#a5b4fc;--on-accent:#0e1626;--surface:#111a2e;--border:#2a3a5c;--code-bg:#0a101d}}
  *{box-sizing:border-box}
  body{margin:0;padding:12px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg)}
  .card{max-width:560px;margin:0 auto;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px}
  h1{margin:0 0 4px;font-size:1.25rem;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
  h2{margin:24px 0 8px;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  p{margin:0 0 8px}
  .muted{color:var(--muted)}
  .sub{margin:0 0 12px;color:var(--muted);font-size:.9rem}
  .lead{margin:0 0 8px}
  .note{margin:12px 0 0;color:var(--muted);font-size:.9rem}
  .code{font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:1px 6px;background:var(--code-bg);border:1px solid var(--border);border-radius:4px}
  pre{margin:0 0 12px;padding:12px;min-width:0;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;color:var(--fg);font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-x:auto;user-select:all}
  .t{white-space:nowrap}
  .ln{display:block;padding-left:2ch;text-indent:-2ch}
  .ln+.ln{margin-top:4px}
  .ln[data-p]::before{content:"$ ";color:var(--muted);user-select:none}
  button{display:inline-block;min-height:44px;padding:12px 24px;border:2px solid var(--accent);border-radius:6px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:600;cursor:pointer}
  button:active{transform:translateY(1px)}
  @media (hover:hover){button:hover{filter:brightness(1.08)}}
  a{color:var(--accent);font-weight:600;overflow-wrap:anywhere}
  .links{display:flex;flex-wrap:wrap;column-gap:16px}
  .links a{display:inline-flex;align-items:center;min-height:44px}
  p{text-wrap:pretty}
  a:focus-visible,button:focus-visible,input:focus-visible+label,pre:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
  .status{margin:8px 0 0;color:var(--muted);font-size:.9rem}
  .status:empty{margin:0}
  .links{margin:8px 0 0}
  .near{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}
  fieldset{margin:0 0 16px;padding:0;border:0;min-width:0}
  legend{padding:0;margin:0 0 8px;color:var(--muted);font-size:.9rem}
  .seg{display:flex;flex-wrap:wrap;gap:8px}
  .seg input{position:absolute;opacity:0;width:1px;height:1px}
  .seg label{display:inline-flex;align-items:center;min-height:48px;padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--fg);cursor:pointer;font-weight:500}
  .seg input:checked+label{border:2px solid var(--accent);padding:7px 15px;color:var(--accent);font-weight:700}
  .seg input:checked+label::before{content:"\\2713\\00a0"}
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
  function copyButton(text,status,label,quiet){
    var b=el("button",quiet?"quiet":"",label);b.type="button";b.setAttribute("data-copy",text);
    b.addEventListener("click",function(){
      function done(ok){status.textContent=ok?"\\u2713 Copied to the clipboard.":"Copy was blocked here. Select the command and press Ctrl+C.";}
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
  // One command per block. Each space-separated word is a no-wrap unit, so a long
  // command wraps between words and never inside one (no break at a hyphen), and
  // a wrapped line is indented so it reads as the same command.
  function commandBlock(lines,prompt){
    var pre=el("pre","");pre.tabIndex=0;
    lines.forEach(function(l){
      var s=el("span","ln");if(prompt)s.setAttribute("data-p","1");
      l.split(" ").forEach(function(w,j){if(j)s.appendChild(document.createTextNode(" "));s.appendChild(el("span","t",w));});
      pre.appendChild(s);
    });
    return pre;
  }
  // Ask the host to send a follow-up message (OpenAI Apps SDK, or MCP Apps ui/message).
  // The frame itself makes no request; the host decides what to do with the message.
  function askHost(text){
    if(window.openai&&typeof window.openai.sendFollowUpMessage==="function"){window.openai.sendFollowUpMessage({prompt:text});return true;}
    if(window.parent&&window.parent!==window){tell(window.parent,{jsonrpc:"2.0",id:2,method:"ui/message",params:{role:"user",content:{type:"text",text:text}}});return true;}
    return false;
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
      var near=Array.isArray(d.suggestions)?d.suggestions:[];
      root.appendChild(el("h1","",near.length?"Did you mean "+String(near[0])+"?":"No such skill"));
      var miss=el("p","sub");
      miss.appendChild(document.createTextNode("OrchestKit has no skill named "));
      miss.appendChild(el("span","code",String(d.query)));
      miss.appendChild(document.createTextNode("."));
      root.appendChild(miss);
      if(near.length){
        var row=el("div","near");
        var nstatus=el("p","status");nstatus.setAttribute("role","status");
        near.forEach(function(n){
          var b=el("button","","Show "+String(n));b.type="button";
          b.addEventListener("click",function(){
            var asked=askHost("Show me the OrchestKit skill card for "+String(n));
            nstatus.textContent=asked?"Asked. If nothing happens, ask for \\u201c"+String(n)+"\\u201d by name.":"Ask for \\u201c"+String(n)+"\\u201d by name to see its card.";
          });
          row.appendChild(b);
        });
        root.appendChild(row);root.appendChild(nstatus);
      }else{
        root.appendChild(el("p","muted","Nothing close. Search the docs with orchestkit_docs_search."));
      }
      var all=link(d.browseUrl,"Browse all skills \\u2192");
      if(all){var bp=el("p","links");bp.appendChild(all);root.appendChild(bp);}
      return;
    }
    root.appendChild(el("h1","",String(d.name)));
    root.appendChild(el("p","sub","Ships in the "+String(d.plugin)+" plugin of OrchestKit"));
    root.appendChild(el("p","lead",String(d.summary||d.description)));
    if(d.useWhen)root.appendChild(el("p","muted",String(d.useWhen)));
    root.appendChild(el("h2","","Install in Claude Code"));
    root.appendChild(commandBlock(String(d.installCommand).split(" && "),true));
    var status=el("p","status");status.setAttribute("role","status");
    root.appendChild(copyButton(String(d.installCommand),status,"Copy both install lines"));
    root.appendChild(status);
    if(d.invoke){
      var after=el("p","note");
      after.appendChild(document.createTextNode("Then run "));
      after.appendChild(el("span","code",String(d.invoke)));
      after.appendChild(document.createTextNode(" in Claude Code."));
      root.appendChild(after);
    }
    var docs=link(d.docsUrl,String(d.name)+" docs \\u2192");
    if(docs){var p=el("p","links");p.appendChild(docs);root.appendChild(p);}
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
    out.appendChild(el("p","lead",h.where));
    out.appendChild(commandBlock(h.commands,h.prompt));
    var status=el("p","status");status.setAttribute("role","status");
    out.appendChild(copyButton(h.copy,status,h.copyLabel||"Copy command"));
    out.appendChild(status);
    out.appendChild(el("p","note",h.what));
    if(h.then){out.appendChild(el("h2","",h.then.label));out.appendChild(commandBlock(h.then.commands,h.then.prompt));}
    var docs=link(h.docsUrl,h.name+" install page \\u2192");
    if(docs){var p=el("p","links");p.appendChild(docs);out.appendChild(p);}
  }
  function render(d){
    root.textContent="";
    if(!d||typeof d!=="object"||!Array.isArray(d.hosts)||!d.hosts.length){root.appendChild(el("p","muted","Waiting for install data from the host…"));return;}
    data=d;
    root.appendChild(el("h1","","Install OrchestKit"));
    var fs=el("fieldset","");fs.appendChild(el("legend","","Pick where you work"));
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
