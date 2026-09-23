import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { studioHTML, runStudioBrowser } from './helpers/studio-browser.mjs';

const browser = process.env.PRODUCT_GRAPH_BROWSER;
const fixture = {
  manifest: { name: 'Studio regression fixture' },
  nodes: [
    { id:'feature',region:'product',type:'feature',title:'Rotation',data:{} },
    { id:'step',region:'workflow',type:'step',title:'Recommend next',data:{} },
    { id:'rule',region:'domain',type:'rule',title:'Cooldown',data:{days:3} },
    { id:'store',region:'architecture',type:'module',title:'Persistence',data:{} },
    { id:'decision',region:'decision',type:'decision',title:'Offline only',data:{} },
    { id:'other',region:'product',type:'feature',title:'Collection',data:{} },
  ],
  edges: [
    {id:'e1',kind:'contains',from:'feature',to:'step'},
    {id:'e2',kind:'uses',from:'step',to:'rule'},
    {id:'e3',kind:'implemented-by',from:'rule',to:'store'},
    {id:'e4',kind:'constrains',from:'decision',to:'store'},
  ], documents: [],
};

// Keep the focus-authoring acceptance cases from PR #1 on the actual UI.
async function browserChecks() {
  const checks = [];
  const q = selector => document.querySelector(selector);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition,label) => { if (!condition) throw new Error(label); checks.push(label); };
  const click = selector => { const el=q(selector); if (!el) throw new Error(`Missing ${selector}`); el.click(); };
  const input = (selector,value) => { q(selector).value=value; q(selector).dispatchEvent(new Event('input',{bubbles:true})); };
  const nodes = () => document.querySelectorAll('[data-graph-node]').length;
  try {
    for (let i=0;i<100&&!q('[data-focus="rotation"]');i++) await sleep(30);
    check(Boolean(q('[data-focus="rotation"]')),'Studio boots with fixture workspace');
    check(q('#drawer-content').hidden,'Supporting drawer starts collapsed');
    check(nodes()===6,'Initial project scope shows all six objects');
    click('[data-focus="rotation"]');
    check(q('#scope-title').textContent==='Rotation','Sidebar enters feature focus');
    check(!q('#back-button').disabled,'Sidebar navigation records history');
    check(nodes()===3,'Feature neighborhood is bounded');
    check(q('#scope-summary').textContent.includes('1 relationships leave'),'Cross-scope relationship is disclosed');
    const svgNode=q('[data-graph-node="step"]');
    svgNode.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,button:0,clientX:100,clientY:100}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,button:0,clientX:100,clientY:100}));
    svgNode.click(); // Synthetic pointer-up does not synthesize the native click event.
    check(q('#save-state').textContent==='Ready','A pointer click does not dirty layout');
    check(q('#node-id').value==='step'&&q('#scope-title').textContent==='Rotation','Selection does not refocus');
    click('[data-lens="domain"]'); click('#node-list [data-node="rule"]'); input('#search','Cooldown'); click('#all-models-button');
    check(q('[data-lens="domain"]').getAttribute('aria-pressed')==='true','All models preserves lens');
    check(q('#scope-title').textContent==='Entire project','All models actually expands scope');
    click('#back-button');
    check(q('#scope-title').textContent==='Rotation'&&q('#search').value==='Cooldown'&&q('#node-id').value==='rule','Back restores focus, search and selection');
    click('#forward-button'); check(q('#search').value===''&&q('#node-id').value==='rule','Forward restores destination without discarding selection');
    click('#isolate-button'); check(q('#scope-title').textContent==='Cooldown'&&nodes()===1,'Isolate creates a named depth-zero focus');
    click('#expand-button'); check(nodes()===3,'Expand adds one neighborhood hop');
    click('#back-button'); check(nodes()===1,'Back restores isolate depth');
    click('#back-button'); check(q('#scope-title').textContent==='Entire project'&&q('[data-lens="domain"]').classList.contains('active'),'Back restores pre-isolate scope and lens');
    click('#node-list [data-node="rule"]'); click('#node-list [data-node="step"]'); await sleep(250);
    check(q('#node-id').value==='step'&&q('#where-list').textContent.includes('Recommend next')&&!q('#where-list').textContent.includes('Cooldown'),'Late context cannot replace current selection context');
    input('#node-title','Recommend draft'); click('[data-lens="architecture"]'); await sleep(250);
    check(q('#node-title').value==='Recommend draft','Lens changes and context refresh preserve unapplied inspector input');
    check(!q('#selection-visibility').hidden&&q('#selection-visibility').textContent.includes('hidden by this lens'),'Hidden selection is explained, not reset');
    window.confirm=()=>false; click('[data-focus="rotation"]');
    check(q('#scope-title').textContent==='Entire project'&&q('#node-title').value==='Recommend draft','Cancelled draft discard cancels navigation');
    q('#node-form').requestSubmit();
    check(q('#save-state').textContent==='Unsaved changes','Applying object edits changes only the local model');
    check(q('#where-list').textContent.includes('Save the model'),'Saved context is not misrepresented as current while dirty');
    click('[data-tool="review"]'); click('[data-proposal-apply="proposal-1"]');
    const beforeSave=await(await fetch('/__qa')).json();
    check(beforeSave.proposalApplies===0,'Proposal apply cannot discard unsaved local edits');
    click('#drawer-toggle'); check(q('#drawer-content').hidden,'Drawer can be hidden again');
    click('#isolate-button'); check(nodes()===1,'Dirty model can still be explored through isolation');
    click('#save-button'); for(let i=0;i<100&&q('#save-button').disabled;i++)await sleep(20);
    const saved=await(await fetch('/__qa')).json();
    check(saved.savedNodes===6&&saved.savedTitle==='Recommend draft','Save writes the whole edited graph, not just the visible projection');
    check(q('#save-state').textContent==='Ready','Successful save clears dirty state');
    window.prompt=()=>{throw new Error('Object creation must not require prompt()')}; click('#add-node');
    input('#direct-choice','step'); input('#direct-title','Exception path'); input('#direct-kind','contains');
    click('#direct-submit');
    check(q('#node-title').value==='Exception path'&&nodes()>=2,'Add to focus connects the new object and reveals it');
    click('#undo-button'); check(![...document.querySelectorAll('.node-title')].some(el=>el.textContent==='Exception path'),'Undo removes the added object and relationship together');
    click('#redo-button'); check([...document.querySelectorAll('.node-title')].some(el=>el.textContent==='Exception path'),'Redo restores the creation');
    click('[data-tool="decisions"]'); check(nodes()===1&&q('.node-title').textContent==='Offline only','Decisions tool opens the actual decision projection');
    click('[data-tool="all"]'); click('[data-lens="overview"]'); click('#node-list [data-node="rule"]'); click('#focus-here-button');
    window.confirm=()=>true; click('#delete-node'); check(nodes()===0&&q('#empty-state h2').textContent==='Focus object is missing','Deleting focus root does not silently reveal all models');
    click('#all-models-button'); check(nodes()===6,'Rest of graph remains accessible after deleting focus root');
    click('[data-drawer="compare"]'); click('[data-drawer="library"]'); await sleep(300);
    check(q('#drawer-content').textContent.includes('Library is empty'),'Late compare result cannot overwrite Library');
    document.documentElement.dataset.studioSmoke='passed';
  } catch(error) { document.documentElement.dataset.studioSmoke='failed'; checks.push(`FAIL: ${error.stack||error.message}`); }
  const report=document.createElement('pre'); report.id='studio-smoke-result'; report.textContent=JSON.stringify(checks); document.body.append(report);
}

function installFixture(fixture) {
  let graph=structuredClone(fixture),proposalApplies=0,savedNodes=0,savedTitle='',sequence=0;
  if(!crypto.randomUUID)crypto.randomUUID=()=>`fixture-${++sequence}`;
  window.fetch=async(input,options={})=>{
    const url=new URL(input,'http://fixture.test');
    const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
    if(url.pathname==='/__qa')return json({proposalApplies,savedNodes,savedTitle});
    if(url.pathname==='/api/workspace'){
      if(options.method==='POST'){graph=JSON.parse(options.body).graph;savedNodes=graph.nodes.length;savedTitle=graph.nodes.find(n=>n.id==='step')?.title;return json({graph,diagnostics:[]});}
      return json({graph,focusAreas:[{id:'rotation',title:'Rotation',rootIds:['feature'],depth:2}],layout:{},tours:[],library:{patterns:[],templates:[]},diagnostics:[]});
    }
    if(url.pathname==='/api/proposals')return json({proposals:[{id:'proposal-1',title:'Agent change',status:'pending',source:'fixture',rationale:'Test unsaved guard'}]});
    if(url.pathname.endsWith('/apply')){proposalApplies++;return json({});}
    if(url.pathname==='/api/context'){
      const selected=graph.nodes.find(n=>n.id===url.searchParams.get('rootId'));
      await new Promise(resolve=>setTimeout(resolve,selected?.id==='rule'?100:5));
      return json({context:{why:[],whereUsed:selected?[selected]:[],decisions:[],evidence:[],impact:[]}});
    }
    if(url.pathname==='/api/compare'){await new Promise(resolve=>setTimeout(resolve,150));return json({nodesAdded:[],nodesRemoved:[],nodesChanged:[],edgesAdded:[],edgesRemoved:[]});}
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
}

test('Studio browser regression with in-memory fixture API',{skip:!browser,timeout:40000},async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'product-graph-browser-'));
  try {const result=await runStudioBrowser(studioHTML(installFixture,fixture,browserChecks),{browser,profile}); assert.equal(result.status,'passed',result.report); console.log(result.report);}
  finally{fs.rmSync(profile,{recursive:true,force:true});}
});
