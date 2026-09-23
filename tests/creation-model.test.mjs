import test from 'node:test';
import assert from 'node:assert/strict';
import { creationChoices, creationPlacement } from '../ui/creation-model.js';
import { OBJECT_CHOICES } from '../ui/authoring-model.js';
import { prepareCanvasEdit } from '../ui/canvas-edit-model.js';
const seed = () => ({ graph:{nodes:[{id:'a',title:'Collection',data:{keep:true}},{id:'b',title:'Bottle'}],edges:[],documents:[{id:'brief'}]},scope:{id:'project',rootIds:[],depth:2},scopeIds:new Set(['a','b']),positions:{a:{x:300,y:200,pinned:false},b:{x:620,y:200,pinned:true}},point:{x:100,y:500} });
test('Library reuses all canonical kinds and searches every term without mutation',()=>{
 assert.deepEqual(creationChoices(),OBJECT_CHOICES);
 assert.deepEqual(creationChoices(' OBjéct manages ').map(c=>c.key),['entity']);
 assert.deepEqual(creationChoices('not-a-kind'),[]);
 assert.equal(creationChoices('workflow').length,2);
 assert.equal(creationChoices()[0],OBJECT_CHOICES[0]);
});
test('Blank project placement does not infer a relation or mutate data',()=>{
 const input=seed(),before=structuredClone(input);
 assert.deepEqual(creationPlacement(input),{from:undefined,position:{x:100,y:500,pinned:true}});
 assert.deepEqual(input,before);
});
test('Node drops choose an existing source and collision-free preview only',()=>{
 const input={...seed(),sourceId:'a'},before=structuredClone(input),plan=creationPlacement(input);
 assert.equal(plan.from,'a');assert.deepEqual(plan.position,{x:620,y:336,pinned:true});assert.deepEqual(input,before);
 assert.equal('kind' in plan,false);assert.equal(input.graph.edges.length,0);
});
test('Focused blank placement requires a current in-scope source',()=>{
 const input=seed();input.scope={id:'focus',rootIds:['a'],depth:0};
 assert.equal(creationPlacement(input).from,'a');
 assert.throws(()=>creationPlacement({...input,scopeIds:new Set()}),/focus/);
 assert.throws(()=>creationPlacement({...input,scope:{id:'missing',rootIds:['deleted']}}),/focus/);
 assert.throws(()=>creationPlacement({...input,scopeIds:new Set(['a']),sourceId:'b'}),/focus/);
});
test('Reject stale sources, missing graph and non-finite coordinates',()=>{
 const input=seed();assert.throws(()=>creationPlacement({...input,sourceId:'gone'}),/missing/);
 assert.throws(()=>creationPlacement({...input,graph:null}),/Open a product/);
 for(const point of [null,{x:NaN,y:1},{x:1,y:Infinity}])assert.throws(()=>creationPlacement({...input,point}),/position/);
});
test('Preview and validated creation preserve metadata and need explicit semantics',()=>{
 const input=seed(),before=structuredClone(input.graph),preview=creationPlacement({...input,sourceId:'a'});
 const edit={action:'create',choice:'rule',title:'Keep history',description:'Do not overwrite records.',from:preview.from};
 assert.throws(()=>prepareCanvasEdit(input.graph,edit,()=> 'test'),/relationship/);
 assert.deepEqual(input.graph,before);
 const plan=prepareCanvasEdit(input.graph,{...edit,kind:'constrains'},()=> 'test');
 assert.equal(plan.graph.nodes.length,3);assert.equal(plan.graph.edges.length,1);assert.equal(plan.createdId,'domain:test');
 assert.equal(plan.graph.nodes[2].status,'draft');assert.equal(plan.graph.nodes[2].data.description,edit.description);
 assert.deepEqual(plan.graph.edges[0].data,{relationClass:'semantic',executable:false});
 assert.deepEqual(plan.graph.nodes.slice(0,2),before.nodes);assert.deepEqual(plan.graph.documents,before.documents);
});
