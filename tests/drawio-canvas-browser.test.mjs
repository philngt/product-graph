import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './helpers/drawio-browser.mjs';
const browser = process.env.PRODUCT_GRAPH_BROWSER;
const ui = fileURLToPath(new URL('../ui/', import.meta.url));
function html() {
  const cache = new Map();
  function module(name) {
    if (cache.has(name)) return cache.get(name);
    const source = fs.readFileSync(path.join(ui, name), 'utf8').replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (_, q, relative) => `from ${JSON.stringify(module(relative.slice(2)))}`);
    const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`; cache.set(name, url); return url;
  }
  const css = fs.readFileSync(path.join(ui, 'direct-canvas.css'), 'utf8');
  return `<!doctype html><html><head><style>:root{--ink:#292933;--paper:#fbf7ee;--surface:#eee7da;--line:#d3c8b6;--frame:#a69b88;--accent:#b8482b;--accent-wash:#f7e7dc;--muted:#68636a;--node:#fdfaf2;--danger:#ae3034;--display:Georgia,serif}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;color:var(--ink);background:var(--paper);font:14px system-ui}header.host{padding:20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between}h1{font:26px Georgia;margin:0}button{cursor:pointer}.button{padding:8px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:inherit}.button-primary{background:var(--accent);color:var(--paper)}#graph-canvas{height:calc(100vh - 200px);min-height:420px;background:radial-gradient(var(--line) 1px,transparent 1px);background-size:20px 20px}#graph-svg{width:100%;height:100%;touch-action:none}.node-card{fill:var(--node);stroke:var(--frame);stroke-width:1.2}.edge-line{fill:none;stroke:var(--muted);stroke-width:1.5}.graph-node{cursor:pointer}.graph-node text{fill:var(--ink);pointer-events:none;font:18px Georgia}.graph-node:focus-visible .node-card{stroke:var(--accent);stroke-width:3}#message{padding:10px} ${css}</style></head><body><header class="host"><h1>Product Graph · direct authoring</h1><span>Real canvas modules · test host</span></header><main><button id="undo" class="button">Undo</button><button id="save" class="button">Save model</button><div id="graph-canvas" tabindex="0"><svg id="graph-svg" viewBox="0 0 1000 600"></svg></div><p id="message" role="status"></p></main><script type="module">
import {createDirectCanvas} from ${JSON.stringify(module('direct-canvas.js'))};
import {prepareCanvasEdit,nearbyPosition} from ${JSON.stringify(module('canvas-edit-model.js'))};
import {connectorGeometry,CARD} from ${JSON.stringify(module('canvas-layout.js'))};
const graph={manifest:{projectId:'demo'},nodes:[{id:'a',title:'Record usage',region:'product',type:'feature'},{id:'b',title:'Bottle',region:'domain',type:'entity'},{id:'c',title:'Collection',region:'domain',type:'entity'}],edges:[{id:'edge:r',from:'a',to:'b',kind:'reads',data:{provenance:'human'}}],documents:[{id:'brief',path:'documents/brief.md',links:['a']}]};
const state={graph,scope:{id:'project',rootIds:[]},view:'overview',selectedId:'a',formDirty:false,busy:false,dragging:null};
let geometry={a:{x:180,y:130},b:{x:570,y:130},c:{x:570,y:400}},controller,seq=0; const history=[];
window.__state=state;window.__history=history;window.__saved=null;window.__confirm=true;window.confirm=()=>window.__confirm;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const svg=document.querySelector('#graph-svg'),lanes=new Map();svg.innerHTML=state.graph.edges.map(e=>{const pair=JSON.stringify([e.from,e.to].sort()),lane=lanes.get(pair)||0;lanes.set(pair,lane+1);const shape=connectorGeometry(geometry[e.from],geometry[e.to],e.from===e.to,lane);return '<path class="edge-line" d="'+shape.path+'"/>';}).join('')+state.graph.nodes.map(n=>{const p=geometry[n.id];return '<g class="graph-node" data-graph-node="'+esc(n.id)+'" role="button" tabindex="0" transform="translate('+(p.x-110)+','+(p.y-44)+')"><rect class="node-card" width="220" height="88" rx="9"/><text x="16" y="48">'+esc(n.title)+'</text></g>';}).join('');controller?.decorate();}
function perform(edit,point){if(state.busy||state.dragging||state.formDirty)return false;const plan=prepareCanvasEdit(state.graph,edit,()=> 'new-'+(++seq));if(!plan.changed)return true;history.push({graph:structuredClone(state.graph),positions:structuredClone(geometry)});state.graph=plan.graph;state.selectedId=plan.selectedId;if(plan.createdId)geometry[plan.createdId]=nearbyPosition(point,geometry,CARD);render();return true;}
render();controller=createDirectCanvas({state,positions:()=>geometry,scopeIds:()=>new Set(state.graph.nodes.map(n=>n.id)),perform,showModel:()=>{},startGesture:()=>state.dragging='connector',endGesture:()=>state.dragging=null,notify:m=>document.querySelector('#message').textContent=m});render();window.__render=render;
document.querySelector('#undo').onclick=()=>{const old=history.pop();if(old){state.graph=old.graph;geometry=old.positions;state.selectedId='a';render();}};
document.querySelector('#save').onclick=()=>window.__saved=structuredClone(state.graph);window.__ready=true;
</script></body></html>`;
}
for (const [width,height] of [[1440,1000],[1024,768]]) test(`direct authoring real Chromium interactions ${width}×${height}`, {skip:!browser,timeout:40000}, async t=>{
  const p=await launch(browser,width,height);t.after(p.close);const ev=p.evaluate,checks=[];
  const check=async(expression,label)=>{assert.ok(await ev(expression),label);checks.push(label);};
  const delay=()=>new Promise(r=>setTimeout(r,150));
  const world=async(x,y)=>ev(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('#graph-svg').getScreenCTM());return {x:p.x,y:p.y}})()`);
  const drag=async(from,to)=>{await p.mouse('mousePressed',from,1);await p.mouse('mouseMoved',to,1);await p.mouse('mouseReleased',to);await delay();};
  await ev(`document.open();document.write(${JSON.stringify(html())});document.close()`);await p.wait('window.__ready');
  await check('document.querySelectorAll("[data-edge-index]").length===1','Existing relationship has an accessible hit target');
  const mid=await world(380,130);await p.mouse('mousePressed',mid,1);await p.mouse('mouseReleased',mid);
  await p.wait('document.querySelector("#direct-delete-edge")');
  await check('document.querySelector("#direct-kind").value==="reads"','Clicking the connector opens its current semantic definition');
  await p.fill('#direct-kind','writes');await p.fill('#direct-query','Collection');await p.fill('#direct-destination','c');await p.click('#direct-submit');
  await check('window.__state.graph.edges[0].kind==="writes" && window.__state.graph.edges[0].to==="c"','Edge meaning and destination change explicitly');
  await check('window.__state.graph.edges[0].id==="edge:r" && window.__state.graph.edges[0].data.provenance==="human"','Identity and provenance survive edge editing');
  await check('window.__history.length===1','Relationship edit is one undoable host operation');await p.click('#undo');
  await ev('document.querySelector("[data-edge-index]").focus()');await p.key('Enter');await p.wait('document.querySelector("#direct-delete-edge")');
  await check('document.querySelector("#direct-kind").value==="reads"','Keyboard can edit the edge after Undo');
  await ev('window.__confirm=false');await p.click('#direct-delete-edge');await check('window.__state.graph.edges.length===1','Cancelling deletion preserves the edge');
  await ev('window.__confirm=true');await p.click('#direct-delete-edge');await check('window.__state.graph.edges.length===0 && window.__state.graph.nodes.length===3 && window.__state.graph.documents.length===1','Delete removes only the relationship');await p.click('#undo');
  await ev('document.querySelector("[data-edge-index]").focus()');await p.key('Enter');await p.wait('document.querySelector("#direct-kind")');
  await p.fill('#direct-kind','supports');await ev('window.__state.graph.edges[0].data.newer=true');await p.click('#direct-submit');
  await check('document.querySelector("#direct-error").textContent.includes("changed") && window.__state.graph.edges[0].kind==="reads"','Stale observed metadata blocks overwrite and retains the form');await p.click('[data-cancel]');
  const source=await world(308,113),blank=await world(850,390);
  await drag(source,blank);await p.wait('document.querySelector("#direct-choice")');
  await check('window.__state.graph.nodes.length===3 && window.__state.graph.edges.length===1','Dropping on empty canvas only opens a proposal form');
  await check('document.querySelector("#direct-kind").value===""','Create-and-connect does not guess relationship meaning');
  await p.fill('#direct-choice','rule');await p.fill('#direct-title','Cooldown rule');await p.fill('#direct-kind','constrains');await p.click('#direct-submit');
  await check('window.__state.graph.nodes.length===4 && window.__state.graph.edges.length===2','Explicit Apply creates object and relationship together');
  await check('window.__state.graph.nodes[3].status==="draft" && window.__state.graph.edges[1].data.executable===false','New meaning is draft and non-executable');
  await check('window.__history.length===1','Create-and-connect is exactly one undo step');await p.click('#undo');
  await drag(source,await world(570,130));await p.wait('document.querySelector("#direct-destination")');
  await check('document.querySelector("#direct-destination").value==="b"','Drop on existing object reuses its stable ID');await p.fill('#direct-kind','reads');await p.click('#direct-submit');
  await check('document.querySelector("#direct-error").textContent.includes("already exists") && window.__state.graph.edges.length===1','Duplicate relationship is rejected without mutation');await p.click('[data-cancel]');
  await p.mouse('mousePressed',source,1);await p.mouse('mouseMoved',blank,1);await p.key('Escape');await p.mouse('mouseReleased',blank);await delay();
  await check('!document.querySelector(".direct-preview") && !document.querySelector(".direct-editor") && window.__state.dragging===null','Escape cancels the connection gesture cleanly');
  await drag(source,{x:15,y:15});await check('!document.querySelector(".direct-editor") && window.__state.graph.nodes.length===3','Dropping outside canvas cannot create an object');
  await ev('window.__state.formDirty=true');await p.click('[data-direct=rename]');await check('!document.querySelector(".direct-editor") && document.querySelector("#message").textContent.includes("inspector")','Direct edit keeps an unapplied inspector draft');await ev('window.__state.formDirty=false');
  await p.click('[data-direct=rename]');await p.fill('#direct-title','Unsaved title');await ev('window.__confirm=false');await p.click('[data-cancel]');await check('document.querySelector("#direct-title").value==="Unsaved title"','Discard cancellation preserves field input');
  await check('!window.dispatchEvent(new Event("beforeunload",{cancelable:true}))','Unapplied canvas input protects browser unload');await ev('window.__confirm=true');await p.click('[data-cancel]');
  await p.click('[data-direct=rename]');await p.fill('#direct-title','<img src=x onerror=window.injected=true>');await ev('document.querySelector("#direct-title").dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}))');await p.click('#direct-submit');
  await check('window.__state.graph.nodes[0].title==="Record usage"','IME composition cannot accidentally submit');await ev('document.querySelector("#direct-title").dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}))');await p.click('#direct-submit');
  await check('window.injected===undefined && document.querySelector("#graph-svg img")===null','Untrusted title stays escaped text');await p.click('#save');await check('window.__saved.nodes.length===3 && window.__saved.documents.length===1','Host Save receives the whole graph, not a selection');await p.click('#undo');
  await ev('window.__state.selectedId=null;window.__render()');await check('!document.querySelector("[data-direct=add]").disabled && document.querySelector("[data-direct=rename]").disabled','Add is available with no selection while rename is not');
  await ev('document.querySelector("#graph-canvas").focus()');await p.key('n');await p.wait('document.querySelector("#direct-choice")');await check('document.querySelector("#direct-kind")===null','N adds a standalone product object without an invented edge');await p.click('[data-cancel]');
  await p.click('[data-direct=help]');await check('document.querySelector(".direct-shortcuts") && !document.querySelector("#direct-submit")','Help is read-only and has visible keyboard alternatives');await p.click('[data-cancel]');
  await check('document.documentElement.scrollWidth<=innerWidth','Controls fit the viewport');assert.deepEqual(p.errors,[]);
  console.log(JSON.stringify({width,checks}));
  if(process.env.PRODUCT_GRAPH_SCREENSHOTS && width===1440){fs.mkdirSync(process.env.PRODUCT_GRAPH_SCREENSHOTS,{recursive:true});const shot=await p.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.PRODUCT_GRAPH_SCREENSHOTS,'drawio-canvas.png'),Buffer.from(shot.data,'base64'));await ev('document.querySelector("[data-edge-index]").focus()');await p.key('Enter');await p.wait('document.querySelector("#direct-delete-edge")');const editorShot=await p.command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.PRODUCT_GRAPH_SCREENSHOTS,'relationship-editor.png'),Buffer.from(editorShot.data,'base64'));}
});
