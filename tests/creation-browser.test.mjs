import test from 'node:test';
import assert from 'node:assert/strict';
import { openCreationBrowser, pause } from './helpers/creation-browser.mjs';
const browser = process.env.PRODUCT_GRAPH_BROWSER;
const options = { skip: !browser, timeout: 30000 };
const block = kind => `[data-creation-choice="${kind}"]`;
const snapshot = p => p.evaluate('fixture.snapshot()');
const world = (p, x, y) => p.evaluate(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('#graph-svg').getScreenCTM());return {x:p.x,y:p.y};})()`);
async function start(p, kind, point) { const from = await p.box(block(kind)); await p.mouse('mouseMoved',from);await p.mouse('mousePressed',from,1);await p.mouse('mouseMoved',point,1); }
async function drop(p, kind, point) { await start(p,kind,point);await p.mouse('mouseReleased',point);await p.wait('document.querySelector(".direct-editor")?.open'); }
async function apply(p, title) { await p.fill('#direct-title',title);await p.click('#direct-submit');await p.wait('!document.querySelector(".direct-editor")');await pause(220); }
async function closeForm(p) { await p.click('[data-cancel]');await p.wait('!document.querySelector(".direct-editor")');await pause(220); }

test('Real drag previews exact zoomed position; confirmation is one reversible edit',options,async t=>{
 const p=await openCreationBrowser(browser);t.after(p.close);
 await p.click('.creation-toggle');const before=await snapshot(p);
 await p.evaluate(`document.querySelector('#graph-svg').setAttribute('viewBox','200 50 1000 600')`);
 const destination=await world(p,900,370);await start(p,'entity',destination);
 assert.equal(await p.evaluate('document.querySelectorAll(".creation-preview").length'),1);
 assert.deepEqual(await snapshot(p),before);
 const preview=await p.evaluate(`document.querySelector('.creation-preview').getAttribute('transform')`);
 await p.mouse('mouseReleased',destination);await p.wait(`document.querySelector('#direct-choice')`);
 assert.equal(await p.evaluate(`document.querySelector('#direct-choice').value`),'entity');
 assert.equal(await p.evaluate('fixture.state.dragging'),null);assert.deepEqual(await snapshot(p),before);
 assert.equal(await p.evaluate('document.activeElement.id'),'direct-title');
 assert.equal(await p.evaluate(`document.querySelector('#direct-kind')===null`),true);
 await p.click('.creation-editor summary');await p.fill('#direct-description','Keep the original purchase history.');await apply(p,'Travel bottle');
 const after=await snapshot(p),created=after.graph.nodes.find(n=>n.title==='Travel bottle');
 assert.equal(created.status,'draft');assert.equal(created.data.description,'Keep the original purchase history.');
 assert.equal(await p.evaluate('fixture.history.length'),1);assert.equal(after.graph.edges.length,0);
 assert.equal(preview,`translate(${after.positions[created.id].x},${after.positions[created.id].y})`);
 assert.deepEqual(after.graph.nodes.slice(0,2),before.graph.nodes);assert.deepEqual(after.graph.documents,before.graph.documents);
 await p.click('#undo');assert.deepEqual(await snapshot(p),before);await p.click('#redo');assert.deepEqual(await snapshot(p),after);
 await p.click('#save');assert.deepEqual(await p.evaluate('fixture.saved'),after);assert.deepEqual(p.errors,[]);
});

test('Drop on a node chooses source, never meaning; relation plus object share Undo',options,async t=>{
 const p=await openCreationBrowser(browser);t.after(p.close);await p.click('.creation-toggle');const before=await snapshot(p);
 await drop(p,'rule',await world(p,600,160));
 assert.equal(await p.evaluate(`document.querySelector('#direct-kind').value`),'');
 await p.fill('#direct-title','Preserve past records');await p.click('#direct-submit');
 assert.deepEqual(await snapshot(p),before);assert.ok(await p.evaluate(`document.querySelector('.direct-editor')?.open`));
 await p.fill('#direct-kind','constrains');await apply(p,'Preserve past records');
 const after=await snapshot(p);assert.equal(after.graph.edges.length,1);assert.equal(after.graph.edges[0].from,'feature:catalog');
 assert.deepEqual(after.graph.edges[0].data,{relationClass:'semantic',executable:false});
 assert.equal(await p.evaluate('fixture.history.length'),1);await p.click('#undo');assert.deepEqual(await snapshot(p),before);assert.deepEqual(p.errors,[]);
});

test('Click-to-place, visible center action, keyboard and search reach every kind',options,async t=>{
 const p=await openCreationBrowser(browser);t.after(p.close);await p.click('.creation-toggle');
 assert.equal(await p.evaluate(`document.querySelectorAll('[data-creation-choice]').length`),11);
 await p.fill('.creation-search input','nonexistent');assert.equal(await p.evaluate(`document.querySelector('.creation-empty').hidden`),false);
 await p.fill('.creation-search input','acceptance');assert.equal(await p.evaluate(`document.querySelectorAll('[data-creation-choice]').length`),1);
 await p.click(block('criterion'));await p.click('[data-center]');await p.wait(`document.querySelector('#direct-choice')`);
 assert.equal(await p.evaluate(`document.querySelector('#direct-choice').value`),'criterion');await closeForm(p);
 await p.fill('.creation-search input','screen');await p.click(block('screen'));await p.click(await world(p,850,420));
 assert.equal(await p.evaluate(`document.querySelector('#direct-choice').value`),'screen');await closeForm(p);
 await p.evaluate(`document.querySelector('${block('screen')}').focus()`);await p.key('Enter');await p.key('Enter');
 await p.wait(`document.querySelector('#direct-choice')`);assert.equal(await p.evaluate(`document.querySelector('#direct-choice').value`),'screen');
 await closeForm(p);assert.equal(await p.evaluate('fixture.history.length'),0);assert.deepEqual(p.errors,[]);
});

test('Outside drops, Escape, pointer cancellation, capture loss and focus changes leave no draft',options,async t=>{
 const p=await openCreationBrowser(browser);t.after(p.close);await p.click('.creation-toggle');const before=await snapshot(p),destination=await world(p,900,400);
 for(const reason of ['outside','escape','pointercancel','capture','blur','focus','graph']){
  await p.evaluate(`window.addEventListener('pointerdown',e=>window.testPointer=e.pointerId,{once:true,capture:true})`);
  await start(p,'entity',destination);
  if(reason==='outside')await p.mouse('mouseReleased',{x:5,y:5});
  else {
   if(reason==='escape')await p.key('Escape');
   if(reason==='pointercancel')await p.evaluate(`window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.testPointer}))`);
   if(reason==='capture')await p.evaluate(`document.querySelector('${block('entity')}').releasePointerCapture(window.testPointer)`);
   if(reason==='blur')await p.evaluate(`window.dispatchEvent(new Event('blur'))`);
   if(reason==='focus')await p.evaluate(`fixture.state.view='domain';fixture.direct.updateToolbar()`);
   if(reason==='graph')await p.evaluate(`fixture.state.graph=structuredClone(fixture.state.graph);fixture.direct.updateToolbar()`);
   await p.mouse('mouseReleased',destination);
  }
  await pause(230);assert.equal(await p.evaluate(`document.querySelector('.direct-editor')===null`),true,reason);
  assert.equal(await p.evaluate('fixture.state.dragging'),null,reason);assert.deepEqual(await snapshot(p),before,reason);
  assert.equal(await p.evaluate(`document.querySelectorAll('.creation-preview,.creation-link-preview').length`),0,reason);
 }
 // Pointer cancellation belonging to another finger must not cancel this drag.
 await start(p,'entity',destination);await p.evaluate(`window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:999}))`);
 assert.equal(await p.evaluate(`document.querySelectorAll('.creation-preview').length`),1);
 await p.key('Escape');await p.mouse('mouseReleased',destination);assert.deepEqual(p.errors,[]);
});

test('Inspector/save locks, focused scope, IME and escaped source names remain safe',options,async t=>{
 const p=await openCreationBrowser(browser);t.after(p.close);await p.click('.creation-toggle');const before=await snapshot(p);
 await p.evaluate('fixture.state.formDirty=true');await p.click(block('entity'));assert.equal(await p.evaluate('fixture.state.dragging'),null);
 assert.match(await p.evaluate(`document.querySelector('#fixture-status').textContent`),/inspector draft/);
 await p.evaluate('fixture.state.formDirty=false;fixture.state.busy=true;fixture.direct.updateToolbar()');assert.equal(await p.evaluate(`document.querySelector('.creation-toggle').disabled`),true);
 await p.evaluate(`fixture.state.busy=false;fixture.state.scope={id:'focus',rootIds:['feature:catalog'],depth:0};fixture.direct.updateToolbar()`);
 await p.click(block('entity'));await p.click('[data-center]');assert.equal(await p.evaluate(`document.querySelector('#direct-kind').value`),'');
 await p.fill('#direct-kind','contains');await p.fill('#direct-title','Tiếng Việt');
 await p.evaluate(`document.querySelector('#direct-title').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));document.querySelector('.direct-editor form').requestSubmit()`);
 assert.deepEqual(await snapshot(p),before);
 await p.evaluate(`document.querySelector('#direct-title').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))`);
 await apply(p,'Tiếng Việt');assert.equal(await p.evaluate('fixture.history.length'),1);
 // Existing rename/connection forms still work with the extra toolbar control.
 await p.click('[data-direct=rename]');await apply(p,'<img src=x onerror=window.injected=true>');
 assert.equal(await p.evaluate('Boolean(window.injected)'),false);
 await p.click('[data-direct=connect]');assert.ok(await p.evaluate(`document.querySelector('#direct-query')`));await closeForm(p);assert.deepEqual(p.errors,[]);
});

for(const [width,height] of [[1440,1000],[900,900],[420,820]]){
 test(`Paper/Dark creation library and modal fit ${width}x${height}`,options,async t=>{
  const p=await openCreationBrowser(browser,width,height);t.after(p.close);await p.click('.creation-toggle');
  for(const theme of ['paper','dark']){
   await p.evaluate(`document.documentElement.dataset.theme='${theme}'`);await pause(180);
   const bounds=await p.evaluate(`(()=>{const r=document.querySelector('.creation-shelf').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()`);
   assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height);
   await p.screenshot(`creation-library-${theme}-${width}.png`);
  }
  await p.click(block('entity'));await p.click('[data-center]');await p.wait(`document.querySelector('.direct-editor')?.open`);
  const bounds=await p.evaluate(`(()=>{const r=document.querySelector('.direct-editor').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()`);
  assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height,JSON.stringify(bounds));
  await p.screenshot(`creation-form-${width}.png`);assert.deepEqual(p.errors,[]);
 });
}
