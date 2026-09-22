import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeGraph, graphBounds, connectorGeometry, zoomCamera, CARD } from '../ui/canvas-layout.js';
const nodes = ['a','b','c','d'].map(id => ({ id, title: id }));
const edges = [{ from:'a',to:'b' },{ from:'b',to:'c' }];
test('layering is deterministic independent of input ordering', () => {
  assert.deepEqual(arrangeGraph(nodes,edges), arrangeGraph([...nodes].reverse(),[...edges].reverse()));
});
test('workflow order runs left to right', () => {
  const p = arrangeGraph(nodes,edges); assert.ok(p.a.x < p.b.x && p.b.x < p.c.x);
});
test('cycles, self references and dangling edges remain bounded', () => {
  const p = arrangeGraph(nodes,[...edges,{from:'c',to:'a'},{from:'d',to:'d'},{from:'d',to:'missing'}]);
  assert.equal(Object.keys(p).length,4); Object.values(p).forEach(v => assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y)));
});
test('pinned nodes retain coordinates and unpinned nodes avoid them', () => {
  const pins = { a:{x:160,y:120,pinned:true},b:{x:160,y:120,pinned:false} };
  const p = arrangeGraph(nodes,edges,{positions:pins});
  assert.deepEqual(p.a,pins.a); assert.notDeepEqual(p.b,pins.b);
  assert.ok(Math.abs(p.a.x-p.d.x) >= CARD.width || Math.abs(p.a.y-p.d.y) >= CARD.height);
});
test('rendering preserves all stored coordinates, arrange only preserves pins', () => {
  const p={a:{x:-900,y:1200,pinned:false}};
  assert.equal(arrangeGraph(nodes,edges,{positions:p,preserveAll:true}).a.x,-900);
  assert.notEqual(arrangeGraph(nodes,edges,{positions:p}).a.x,-900);
});
test('layout never mutates canonical graph or supplied layout', () => {
  const p={a:{x:100,y:200,pinned:true}}, before=JSON.stringify([nodes,edges,p]);
  arrangeGraph(nodes,edges,{positions:p}); assert.equal(JSON.stringify([nodes,edges,p]),before);
});
test('empty graph has a usable camera', () => { const p=arrangeGraph([],[]); assert.equal(Object.keys(p).length,0); assert.ok(graphBounds(p).width>0); });
test('fit bounds include negative and distant pins', () => {
  const p={a:{x:-1200,y:-800},b:{x:9000,y:6000}}, b=graphBounds(p);
  assert.ok(b.x < -1200 && b.y < -800 && b.x+b.width > 9000 && b.y+b.height > 6000);
});
test('nonfinite persisted geometry falls back to usable positions', () => { const p=arrangeGraph(nodes,edges,{positions:{a:{x:Infinity,y:NaN,pinned:true}},preserveAll:true}); assert.ok(Number.isFinite(p.a.x)); });
test('connector endpoints bind to rectangle borders', () => {
  const e=connectorGeometry({x:0,y:0},{x:500,y:0}); assert.ok(e.path.startsWith('M 110 0')); assert.ok(e.path.endsWith('390 0')); assert.equal(e.label.x,250);
});
test('self loop and parallel edges have distinct paths', () => {
  const a={x:100,y:100}, b={x:600,y:100};
  assert.notEqual(connectorGeometry(a,b,false,0).path,connectorGeometry(a,b,false,1).path);
  assert.ok(connectorGeometry(a,a,true).path.includes('C')); assert.ok(Number.isFinite(connectorGeometry(a,a,true).label.x));
});
test('zoom preserves camera center and bounds scale', () => {
  const a={x:-10,y:20,width:900,height:500},b=zoomCamera(a,.8);
  assert.equal(a.x+a.width/2,b.x+b.width/2); assert.equal(a.y+a.height/2,b.y+b.height/2);
  assert.ok(zoomCamera(a,.00001).width>=180);
});
test('arbitrary object IDs are keys, not object prototypes', () => {
  const p=arrangeGraph([{id:'__proto__'},{id:'constructor'}],[]);
  assert.equal(Object.keys(p).length,2); assert.ok(Number.isFinite(p.__proto__.x));
});
test('grid view is bounded to three columns', () => {
  const p=arrangeGraph(Array.from({length:40},(_,i)=>({id:String(i)})),[],{mode:'grid'});
  assert.equal(new Set(Object.values(p).map(v=>v.x)).size,3);
});
