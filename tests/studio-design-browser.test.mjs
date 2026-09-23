import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { studioHTML, runStudioBrowser } from './helpers/studio-browser.mjs';

const browser = process.env.PRODUCT_GRAPH_BROWSER;
const fixture = {
  manifest: {name:'Fragrance Rotation',projectId:'fragrance-fixture',schemaVersion:'1.0.0',framework:'product-graph',description:'A considered home for your collection. Keep every bottle, ritual and recommendation connected.'},
  nodes: [
    ['intent','intent','user-need','Use the collection intentionally'],
    ['rotation','product','feature','Rotation recommendation'],
    ['collection','product','feature','Collection'],
    ['usage','workflow','workflow','Record usage'],
    ['choose','workflow','step','Find the next fragrance'],
    ['bottle','domain','entity','Bottle'],
    ['record','domain','entity','Usage record'],
    ['cooldown','domain','rule','Seven-day cooldown'],
    ['screen','experience','screen','Recommendation screen'],
    ['engine','architecture','module','Rotation engine'],
    ['store','architecture','storage','Local persistence'],
    ['criterion','quality','acceptance-criterion','Explain each recommendation'],
    ['decision','decision','decision','Offline by design'],
    ['vietnamese','product','feature','Ghi nhận sử dụng'],
  ].map(([id,region,type,title])=>({id,region,type,title,status:'draft',data: id==='rotation'?{description:'Recommend a bottle with an explanation of the rules behind it.'}: {}})),
  edges: [
    ['intent','rotation','motivates'],['rotation','choose','contains'],['rotation','cooldown','constrained-by'],['rotation','screen','presented-by'],['rotation','criterion','verified-by'],
    ['choose','engine','implemented-by'],['engine','store','depends-on'],['decision','store','constrains'],['collection','bottle','contains'],['usage','record','produces'],['record','bottle','references'],['cooldown','record','reads'],
  ].map(([from,to,kind],i)=>({id:`edge-${i}`,from,to,kind})),
  documents:[{id:'overview',title:'Product brief',path:'documents/overview.md'}],
};
// Real Studio modules, DOM and stylesheet assets; the API and provider data are fixtures.
function install(fixture) {
  let graph=structuredClone(fixture),sequence=0;
  const qa=window.__studioQA={saves:[],apiCalls:[],failNextSave:false,errors:[],original:structuredClone(fixture)};
  window.addEventListener('error',e=>qa.errors.push(e.message));
  window.addEventListener('unhandledrejection',e=>qa.errors.push(String(e.reason)));
  if(!crypto.randomUUID)crypto.randomUUID=()=>`fixture-${++sequence}`;
  const template={id:'web-catalog',title:'Web collection foundation',version:'1.0',target:'Browser',capabilities:['Catalog','Navigation','Settings'],description:'A template declaration, not an installed generator.'};
  window.fetch=async(input,options={})=>{
    const url=new URL(input,'http://fixture.test'),json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    qa.apiCalls.push({url:url.pathname,method:options.method||'GET'});
    if(url.pathname==='/api/workspace'){
      if(options.method==='POST'){
        if(qa.failNextSave){qa.failNextSave=false;return json({message:'Conflict: model changed on disk. Your local edits were not saved.'},409);}
        const payload=JSON.parse(options.body);qa.saves.push(payload);graph=structuredClone(payload.graph);return json({graph,diagnostics:[],workspaceRevision:'saved-'+qa.saves.length});
      }
      return json({graph,layout:{},diagnostics:[],workspaceRevision:'loaded',tours:[],focusAreas:[
        {id:'rotation-focus',title:'Rotation',description:'Thoughtful recommendations, with a reason behind every choice.',rootIds:['rotation'],depth:1},
        {id:'collection-focus',title:'Collection',description:'A place for every bottle and its story.',rootIds:['collection'],depth:2},
        {id:'usage-focus',title:'Usage history',description:'Keep the rituals that make your collection yours.',rootIds:['usage'],depth:2},
      ],library:{patterns:[
        {id:'recommendation',title:'Explainable recommendation',version:'1.0',problem:'Choose a candidate and make its ranking understandable.',structure:['Candidates','Rules','Rank','Explain'],tradeoffs:['Deterministic rules need explicit edge cases.']},
        {id:'history',title:'Activity history',version:'1.2',problem:'Record events without losing historical context.',structure:['Item','Record','History']},
        {id:'danger',title:'<img src=x onerror=alert(1)>',problem:'Escaping regression fixture.'},
      ],templates:[template]}});
    }
    if(url.pathname==='/api/proposals')return json({proposals:[{id:'proposal-1',title:'Clarify the empty recommendation state',status:'pending',source:'agent',rationale:'Add a criterion before implementing the no-match branch.'}]});
    if(url.pathname==='/api/context'){
      const id=url.searchParams.get('rootId'),related=graph.edges.filter(e=>e.from===id||e.to===id).flatMap(e=>[e.from,e.to]);
      await new Promise(r=>setTimeout(r,id==='cooldown'?70:5));
      const neighbors=graph.nodes.filter(n=>n.id!==id&&related.includes(n.id));
      return json({context:{why:neighbors.filter(n=>n.region==='intent'),whereUsed:neighbors.filter(n=>n.region!=='intent'),impact:neighbors,decisions:[],evidence:[]}});
    }
    if(url.pathname==='/api/authoring')return json({board:{schemaVersion:'productgraph.sketch.v1',notes:[],links:[]},boardRevision:'fixture-board',graphRevision:'fixture-graph',kinds:{feature:{label:'A capability / feature',region:'product',type:'feature'}},relations:['contains','supports']});
    if(url.pathname==='/api/documents')return json({documents:[],truncated:false,notices:[]});
    if(url.pathname==='/api/implementation')return json({revision:'implementation-1',config:{schemaVersion:'productgraph.implementation.v1',projectId:fixture.manifest.projectId,targets:[]},inspection:[],templates:[],nodes:graph.nodes});
    throw new Error(`Unexpected fixture request ${url.pathname}`);
  };
}
async function checks(){
 const report=[],q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(value,label)=>{if(!value)throw new Error(label);report.push(label);};
 const click=s=>{const el=q(s);if(!el)throw new Error('Missing '+s);el.click();};
 const input=(s,value,event='input')=>{const el=q(s);el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));};
 const key=(el,name,extra={})=>el.dispatchEvent(new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true,...extra}));
 const until=async(condition,label)=>{for(let i=0;i<100;i++){if(condition())return;await sleep(20);}throw new Error(label);};
 try{
  await until(()=>q('[data-focus="rotation-focus"]'),'Studio boot');
  check(window.__studioQA.errors.length===0,'All actual Studio modules initialize without script errors');
  check(![...document.querySelectorAll('link[rel=stylesheet]')].some(l=>l.href.startsWith('http')),'No remote font or stylesheet dependency');
  check(document.documentElement.scrollWidth<=innerWidth,'Desktop shell fits viewport');
  check(!q('#drawer-content').getClientRects().length,'Supporting drawer starts collapsed');
  click('[data-focus="rotation-focus"]');
  check(q('#scope-title').textContent==='Rotation','Feature focus is preserved in the main canvas');
  check(q('#graph-canvas').getBoundingClientRect().height>=320,'Canvas keeps useful working height');
  const originalCount=document.querySelectorAll('[data-graph-node]').length;
  click('#command-button');
  check(q('#command-palette').open&&document.activeElement.id==='command-query','Project search opens with focus in its combobox');
  input('#command-query','ghi nhan su dung');
  check(q('#command-results').textContent.includes('Ghi nhận sử dụng'),'Palette searches beyond the visible scope with Vietnamese folding');
  key(q('#command-query'),'Enter');await sleep(30);
  check(q('#node-id').value==='vietnamese'&&q('#scope-title').textContent==='Rotation','Inspect result changes selection without changing focus');
  check(!q('#selection-visibility').hidden,'Outside-scope selection is explained');
  key(document.body,'k',{ctrlKey:true});
  check(q('#command-palette').open,'Ctrl K opens command palette');
  input('#command-query','nothing-will-match');check(q('#command-results').textContent.includes('No matches'),'Search empty state is actionable and truthful');
  click('#command-close');await sleep(20);
  click('#node-list [data-node="rotation"]');
  input('#node-title','A local inspector draft');
  click('[data-lens="domain"]');await sleep(100);
  check(q('#node-title').value==='A local inspector draft','Lens switch and async context preserve inspector input');
  click('[data-page="overview"]');click('[data-page="model"]');
  check(q('#node-title').value==='A local inspector draft','Overview does not discard an object draft');
  window.confirm=()=>false;
  click('#command-button');input('#command-query','Bottle');key(q('#command-query'),'Enter');await sleep(20);
  check(q('#node-id').value==='rotation'&&q('#node-title').value==='A local inspector draft','Cancelled discard prevents palette navigation');
  click('#save-button');
  check(!q('#save-feedback').hidden&&q('#save-feedback-text').textContent.includes('Apply'),'Save explains unapplied fields persistently');
  window.confirm=()=>true;
  q('#node-form').requestSubmit();
  check(q('#save-state').textContent==='Unsaved changes','Applying fields changes only the working graph');
  window.__studioQA.failNextSave=true;click('#save-button');
  await until(()=>!q('#save-button').disabled,'failed save returns');
  check(!q('#save-feedback').hidden&&q('#save-feedback-text').textContent.includes('Conflict'),'Save conflict remains visible and preserves the draft');
  check(q('#node-title').value==='A local inspector draft','Conflict never reloads over working edits');
  click('#save-button');await until(()=>!q('#save-button').disabled,'save returns');
  check(q('#save-feedback').hidden&&q('#save-state').textContent==='Ready','Successful save clears the persistent error');
  check(window.__studioQA.saves[0].graph.nodes.length===14,'Save keeps hidden objects, not only visible projection');
  input('#node-title','Rotation recommendation');q('#node-form').requestSubmit();click('#save-button');await until(()=>!q('#save-button').disabled,'name restored');
  click('[data-lens="overview"]');
  const beforeFocus=q('#graph-canvas').getBoundingClientRect().width;
  click('#canvas-focus');
  check(q('.sidebar').inert&&q('.inspector').inert,'Focus mode removes hidden panels from keyboard interaction');
  check(q('#graph-canvas').getBoundingClientRect().width>beforeFocus,'Focus mode gives canvas the available workspace');
  check(q('#save-state').textContent==='Ready','Focus mode is presentation, not a model edit');
  key(document.body,'Escape');check(!q('.sidebar').inert&&q('#canvas-focus').getAttribute('aria-pressed')==='false','Escape restores panels without losing model focus');
  click('#add-node');
  check(q('#object-dialog').open&&q('#new-object-title'),'Typed add-object form replaces native prompt');
  input('#new-object-title','A cancelled new object');window.confirm=()=>false;click('#object-close');
  check(q('#object-dialog').open&&q('#new-object-title').value==='A cancelled new object','Dismissal protects unfinished object form');
  window.confirm=()=>true;click('#object-close');await sleep(20);
  check(!q('#object-dialog')&&document.querySelectorAll('[data-graph-node]').length===originalCount,'Cancelling add leaves the model untouched');
  click('#add-node');click('#object-create-form input[value="rule"]');input('#new-object-title','New availability rule');input('#new-object-description','Explain when a bottle can be selected.');
  check(q('#new-object-relation').value==='','Relationship is never silently inferred');
  input('#new-object-relation','constrains','change');q('#object-create-form').requestSubmit();await sleep(20);
  check(!q('#object-dialog')&&q('#node-title').value==='New availability rule','Typed form creates a draft object in the same graph');
  check(q('#node-type').value==='rule'&&q('#node-status').value==='draft','Object type is real; acceptance is not claimed as verification');
  click('#undo-button');check(!q('#node-list').textContent.includes('New availability rule'),'Undo removes object and linked relationship together');
  click('#redo-button');check(q('#node-list').textContent.includes('New availability rule'),'Redo restores typed creation');
  // Select the restored node explicitly; undo/redo do not own selection.
  [...document.querySelectorAll('#node-list [data-node]')].find(b=>b.textContent.includes('New availability rule')).click();
  click('#add-edge');input('#related-search','Bottle');input('#related-target','bottle','change');input('#related-kind','reads','change');q('#relationship-dialog form').requestSubmit();await sleep(20);
  check(!q('#relationship-dialog')&&q('#edge-list').textContent.includes('Bottle'),'Relationship chooser links an object outside the visible scope by name');
  click('#add-edge');input('#related-search','Bottle');input('#related-target','bottle','change');input('#related-kind','reads','change');q('#relationship-dialog form').requestSubmit();
  check(q('#relationship-error').textContent.includes('already exists'),'Duplicate semantic links show inline errors without closing fields');
  click('#relationship-close');await sleep(20);
  click('#compare-button');
  check(q('#drawer-content').textContent.includes('New availability rule'),'Review shows actual changed objects, not only counts');
  check(q('#drawer-content pre')?.textContent.includes('before'),'Exact before/after data remains inspectable');
  check(!window.__studioQA.apiCalls.some(c=>c.url==='/api/compare'),'Working-copy review is read-only and needs no extra API');
  click('#save-button');await until(()=>!q('#save-button').disabled,'final save');
  const last=window.__studioQA.saves.at(-1);check(last.graph.nodes.length===15&&last.graph.edges.length===14,'Whole-graph save retains linked creation and relationship');
  click('#drawer-toggle');
  click('[data-page="overview"]');
  check(q('.inventory').textContent.includes('15'),'Overview inventory derives from actual working graph');
  check(q('.next-steps').textContent.includes('1 pending proposal'),'Overview surfaces actual review work');
  click('[data-overview-sketch]');await until(()=>q('#sketch-save-state').textContent.includes('saved'),'actual sketch opens');
  check(q('#authoring-dialog').open,'Overview starts the existing authoring tool, not a placeholder');click('#sketch-close');
  click('[data-page="library"]');input('#library-search','no matching');click('#reset-library-filter');
  check(document.querySelectorAll('[data-library-item]').length===4,'Library reset restores actual project definitions');
  click('[data-library-item="pattern-0"]');
  check(q('#library-dialog-overview').textContent.includes('Deterministic rules'),'Library shows source-provided structure and trade-offs');
  check(!q('#library-dialog-overview img')&&q('#library-dialog-json').textContent.includes('recommendation'),'Readable library details retain exact source JSON');
  click('#library-dialog-close');check(document.activeElement.dataset.libraryItem==='pattern-0','Definition dialog restores its opener');
  check(!q('#library-results img'),'Untrusted library title is escaped');
  click('[data-page="build"]');await until(()=>q('#target-add')&&!q('#target-add').disabled,'targets load');
  check(q('#page-content').textContent.includes('Generation not implemented'),'Existing Targets tab still mounts with explicit generator boundary');
  click('[data-page="model"]');click('#command-button');input('#command-query','Documents');key(q('#command-query'),'Enter');await sleep(40);
  check(q('#document-browser')?.open,'Command palette opens the actual document reader');click('#documents-close');await sleep(20);
  input('#appearance','dark','change');check(document.documentElement.dataset.theme==='dark','Dark theme shares the same interaction layer');input('#appearance','light','change');
  check(window.__studioQA.errors.length===0,'Complete Studio UI finishes without uncaught errors');
  check(!window.__studioQA.apiCalls.some(c=>c.url==='/api/implementation'&&c.method==='POST'),'Visual inspection does not persist target changes');
  click('[data-focus="rotation-focus"]');click('#node-list [data-node="rotation"]');await sleep(100);
  document.documentElement.dataset.studioSmoke='passed';
 }catch(e){document.documentElement.dataset.studioSmoke='failed';report.push('FAIL: '+e.stack);}
 const node=document.createElement('pre');node.id='studio-smoke-result';node.textContent=JSON.stringify(report);node.hidden=true;document.body.append(node);
}
for(const [width,height] of [[1440,1000],[1024,768],[768,900]]) test(`Complete Studio design and authoring at ${width}x${height}`,{skip:!browser,timeout:45000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pg-design-'));
 try{
  const result=await runStudioBrowser(studioHTML(install,fixture,checks),{browser,profile,width,height,onReady:async command=>{
   const out=process.env.PRODUCT_GRAPH_SCREENSHOTS;if(!out)return;fs.mkdirSync(out,{recursive:true});
   const capture=async name=>{await new Promise(r=>setTimeout(r,120));const image=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${name}-${width}.png`),Buffer.from(image.data,'base64'));};
   await command('Runtime.evaluate',{expression:"document.querySelector('#toast').classList.remove('show')"});
   await capture('model');
   if(width!==1440)return;
   for(const page of ['overview','library','build']){await command('Runtime.evaluate',{expression:`document.querySelector('[data-page="${page}"]').click()`});await capture(page);}
   await command('Runtime.evaluate',{expression:`document.querySelector('[data-page="model"]').click();document.querySelector('#add-node').click()`});await capture('add-object');
   await command('Runtime.evaluate',{expression:`document.querySelector('#object-close').click();document.querySelector('#command-button').click();document.querySelector('#command-query').value='Rotation';document.querySelector('#command-query').dispatchEvent(new Event('input',{bubbles:true}))`});await capture('command');
   await command('Runtime.evaluate',{expression:`document.querySelector('#command-close').click();document.querySelector('#canvas-focus').click()`});await capture('focus');
   await command('Runtime.evaluate',{expression:`document.querySelector('#canvas-focus').click();document.querySelector('#appearance').value='dark';document.querySelector('#appearance').dispatchEvent(new Event('change',{bubbles:true}))`});await capture('dark');
  }});
  assert.equal(result.status,'passed',result.report);console.log(result.report);
 }finally{fs.rmSync(profile,{recursive:true,force:true});}
});
