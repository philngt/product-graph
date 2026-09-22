import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { studioHTML, runStudioBrowser } from './helpers/studio-browser.mjs';

const browser = process.env.PRODUCT_GRAPH_BROWSER;
const fixture = {
  manifest: { name:'Fragrance Rotation', description:'Use the collection intentionally. Build an offline personal app from connected product decisions.' },
  nodes:[
    ['intent','intent','user-need','Use the collection well'],
    ['rotation','product','feature','Rotation recommendation'],
    ['collection','product','feature','Collection'],
    ['usage','workflow','workflow','Record usage'],
    ['choose','workflow','step','Choose next fragrance'],
    ['bottle','domain','entity','Bottle'],
    ['record','domain','entity','Usage record'],
    ['cooldown','domain','rule','Seven-day cooldown'],
    ['screen','experience','screen','Recommendation screen'],
    ['engine','architecture','module','Rotation engine'],
    ['store','architecture','storage','Local persistence'],
    ['test','quality','acceptance','Explain each suggestion'],
    ['decision','decision','decision','Offline by design'],
  ].map(([id,region,type,title])=>({id,region,type,title,status:'modeled',data:{}})),
  edges:[
    ['intent','rotation','motivates'],['rotation','choose','realized-by'],['rotation','cooldown','constrained-by'],['rotation','screen','presented-by'],['rotation','engine','implemented-by'],['rotation','test','verified-by'],
    ['choose','cooldown','uses'],['engine','store','depends-on'],['decision','store','constrains'],['collection','bottle','contains'],['usage','record','produces'],['record','bottle','references'],['cooldown','record','reads'],
  ].map(([from,to,kind],i)=>({id:`edge-${i}`,from,to,kind})),documents:[{id:'overview',title:'Product brief',path:'documents/overview.md'}],
};
function install(fixture) {
  let graph=structuredClone(fixture), saves=[], sequence=0;
  window.__fixtureGraph=fixture;
  if(!crypto.randomUUID)crypto.randomUUID=()=>`fixture-${++sequence}`;
  window.fetch=async(input,options={})=>{
    const url=new URL(input,'http://fixture.test'),json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
    if(url.pathname==='/__qa')return json({saves});
    if(url.pathname==='/api/workspace'){
      if(options.method==='POST'){const value=JSON.parse(options.body);saves.push(value);graph=value.graph;return json({graph,diagnostics:[]});}
      return json({graph,layout:{},diagnostics:[],proposals:[],tours:[],focusAreas:[
        {id:'rotation-focus',title:'Rotation',description:'Rules, recommendations and the experience behind them.',rootIds:['rotation'],depth:1},
        {id:'collection-focus',title:'Collection',description:'A reliable home for every bottle and its history.',rootIds:['collection'],depth:2},
        {id:'usage-focus',title:'Usage history',description:'Capture actual use and preserve the context.',rootIds:['usage'],depth:2},
      ],library:{patterns:[
        {id:'recommendation',title:'Explainable recommendation',version:'1.0',problem:'Choose a candidate and explain the rules behind the result.',structure:['Input','Rules','Rank','Explain'],tradeoffs:['Deterministic rules need explicit edge cases.']},
        {id:'history',title:'Usage history',version:'1.2',problem:'Record events without losing historical context.',structure:['Item','Record','History']},
        {id:'danger',title:'<img src=x onerror=alert(1)>',problem:'Escaping regression fixture.'},
      ],templates:[{id:'offline-swiftui',title:'Offline SwiftUI personal app',target:'SwiftUI',version:'0.1',capabilities:['Local storage','Navigation','Settings'],description:'Target definition only. No generator is installed.'}]}});
    }
    if(url.pathname==='/api/proposals')return json({proposals:[]});
    if(url.pathname==='/api/context'){
      const id=url.searchParams.get('rootId'); const related=graph.edges.filter(e=>e.from===id||e.to===id).flatMap(e=>[e.from,e.to]);
      const neighbors=graph.nodes.filter(n=>n.id!==id&&related.includes(n.id));
      return json({context:{why:neighbors.filter(n=>n.region==='intent'),whereUsed:neighbors.filter(n=>n.region!=='intent'),impact:neighbors,decisions:[],evidence:[]}});
    }
    if(url.pathname==='/api/compare')return json({nodesAdded:[],nodesRemoved:[],nodesChanged:[],edgesAdded:[],edgesRemoved:[]});
    throw new Error(`Unexpected request ${url.pathname}`);
  };
}
async function checks() {
  const report=[],q=s=>document.querySelector(s),click=s=>q(s).click(),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(ok,label)=>{if(!ok)throw new Error(label);report.push(label);};
  const input=(selector,value,type='input')=>{q(selector).value=value;q(selector).dispatchEvent(new Event(type,{bubbles:true}));};
  const rect=()=>q('#graph-svg').viewBox.baseVal;
  const position=id=>q(`[data-graph-node="${id}"]`).getAttribute('transform');
  try {
    for(let i=0;i<100&&!q('[data-focus="rotation-focus"]');i++)await wait(25);
    check(document.documentElement.dataset.theme==='light','Paper appearance is available without remote fonts');
    check(!document.querySelector('link[href^="http"]'),'No remote stylesheet/font dependency');
    check(document.documentElement.scrollWidth<=innerWidth,'Workspace does not horizontally overflow desktop viewport');
    click('[data-page="overview"]');
    check(q('.workspace').dataset.page==='overview'&&!q('#studio-page').hidden,'Overview is a real workspace screen');
    check(q('.inventory').textContent.includes('13')&&q('.inventory').textContent.includes('relationships'),'Overview derives inventory from working graph');
    check(!q('#studio-page').textContent.includes('92%'),'Overview does not invent readiness percentages');
    click('[data-overview-focus="0"]');
    check(q('#scope-title').textContent==='Rotation'&&!q('#graph-surface').hidden,'Overview focus card enters same editable model');
    check(document.querySelectorAll('.edge-label').length===7,'Visible relationships have semantic labels');
    click('#node-list [data-node="rotation"]');
    input('#node-title','Unapplied draft');
    click('[data-page="library"]');click('[data-page="model"]');
    check(q('#node-title').value==='Unapplied draft','Switching screens preserves inspector draft');
    window.confirm=()=>true;
    click('#node-list [data-node="cooldown"]');
    const beforeWidth=rect().width;
    click('#zoom-in');check(rect().width<beforeWidth,'Zoom changes view camera');
    check(q('#save-state').textContent==='Ready','Zoom does not dirty canonical graph');
    click('#fit-view');check(Math.abs(rect().width-beforeWidth)<1,'Fit restores computed bounds');
    const svg=q('#graph-svg'), beforeX=rect().x;
    svg.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:2,button:0,clientX:500,clientY:400}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:2,clientX:580,clientY:440}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,button:0,clientX:580,clientY:440}));
    check(rect().x!==beforeX&&q('#save-state').textContent==='Ready','Background panning is view-only');
    click('#fit-view');
    const el=q('[data-graph-node="cooldown"]'),box=el.getBoundingClientRect(),x=box.x+30,y=box.y+30;
    el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:3,button:0,clientX:x,clientY:y}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:3,clientX:x+70,clientY:y+60}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:3,button:0,clientX:x+70,clientY:y+60}));
    const pinned=position('cooldown');
    check(q('[data-graph-node="cooldown"] .node-pin')?.textContent==='PIN','Dragging pins layout, not semantic ownership');
    click('#auto-layout');check(position('cooldown')===pinned,'Arrange preserves pinned node position');
    click('#unpin-selection');check(!q('[data-graph-node="cooldown"] .node-pin'),'Unpin selected is functional');
    click('#undo-button');check(q('[data-graph-node="cooldown"] .node-pin'),'Layout unpin can be undone');
    click('#redo-button');check(!q('[data-graph-node="cooldown"] .node-pin'),'Layout unpin can be redone');
    click('#save-button');for(let i=0;i<100&&q('#save-button').disabled;i++)await wait(20);
    const saved=(await(await fetch('/__qa')).json()).saves.at(-1);
    check(saved.graph.nodes.length===13,'Layout save still sends whole graph');
    check(JSON.stringify(saved.graph)===JSON.stringify(window.__fixtureGraph),'Layout operations never rewrite product semantics');
    click('[data-lens="overview"]');q('[data-lens="overview"]').focus();q('[data-lens="overview"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    check(document.activeElement.dataset.lens==='product','Lens keyboard navigation restores focus after render');
    click('[data-page="library"]');
    check(document.querySelectorAll('[data-library-item]').length===4,'Library displays actual local definitions');
    input('#library-kind','template','change');check(document.querySelectorAll('[data-library-item]').length===1,'Library type filter works');
    input('#library-search','no match');check(q('#library-results').textContent.includes('No matching'),'Library search has an empty state');
    input('#library-search','');
    click('[data-library-item="template-0"]');
    check(q('#library-dialog').open&&q('#library-dialog-json').textContent.includes('offline-swiftui'),'Inspect opens real source definition');
    check(q('#library-dialog button[disabled]')!==null,'Unsupported pattern application is explicitly disabled');
    click('#library-dialog-close');check(document.activeElement.dataset.libraryItem==='template-0','Closing definition restores opener focus');
    input('#library-kind','all','change');
    check(!q('#library-results img'),'Untrusted library title is escaped');
    click('[data-page="build"]');check(q('#page-content').textContent.includes('not implemented'),'Target inspection labels missing compiler honestly');
    check(q('#page-content button[disabled]')?.textContent==='Generate application','No fake working generate action');
    const count=(await(await fetch('/__qa')).json()).saves.length;
    check(count===1,'Overview/library/target reads do not persist changes');
    input('#appearance','dark','change');check(document.documentElement.dataset.theme==='dark','Dark appearance changes tokens');
    input('#appearance','light','change');
    click('[data-page="model"]');click('[data-focus="rotation-focus"]');click('[data-lens="overview"]');click('#node-list [data-node="rotation"]');
    await wait(20);
    check(q('#graph-canvas').getBoundingClientRect().height>=290,'Canvas retains useful working area');
    document.documentElement.dataset.studioSmoke='passed';
  }catch(error){document.documentElement.dataset.studioSmoke='failed';report.push(`FAIL: ${error.message}`);}
  const el=document.createElement('pre');el.id='studio-smoke-result';el.textContent=JSON.stringify(report);el.hidden=true;document.body.append(el);
}

for (const [width,height] of [[1440,1000],[1024,768]]) test(`Paper studio screens and semantic canvas at ${width}x${height}`,{skip:!browser,timeout:40000},async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'product-graph-paper-'));
  try {
    const result=await runStudioBrowser(studioHTML(install,fixture,checks),{browser,profile,width,height,onReady:async command=>{
      const out=process.env.PRODUCT_GRAPH_SCREENSHOTS;if(!out || width!==1440)return;fs.mkdirSync(out,{recursive:true});
      await new Promise(r=>setTimeout(r,2400));
      for(const page of ['model','overview','library','build']){
        await command('Runtime.evaluate',{expression:`document.querySelector('[data-page="${page}"]').click()`});
        await new Promise(r=>setTimeout(r,120));
        const image=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`paper-studio-${page}.png`),Buffer.from(image.data,'base64'));
      }
    }});
    assert.equal(result.status,'passed',result.report);console.log(result.report);
  }finally{fs.rmSync(profile,{recursive:true,force:true});}
});
