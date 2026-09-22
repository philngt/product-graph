import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectClient} from '../ui/project-client.js';
const A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
test('each client keeps its own route and revision even when requests overlap',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push({url,headers:opts.headers});return Response.json({workspaceRevision:url.includes(A)?'rev-a':'rev-b'});};
 const a=createProjectClient(`/project/${A}/`,fetcher), b=createProjectClient(`/project/${B}/`,fetcher);
 await Promise.all([a.request('/api/workspace'),b.request('/api/workspace')]);await a.request('/api/workspace',{method:'POST',body:'{}'});await b.request('/api/workspace',{method:'POST',body:'{}'});
 assert.equal(calls[2].url,`/api/projects/${A}/workspace`);assert.equal(calls[2].headers.get('X-Product-Graph-Revision'),'rev-a');assert.equal(calls[3].headers.get('X-Product-Graph-Revision'),'rev-b');
});
test('context and previews cannot update the optimistic-write token',async()=>{
 const headers=[];let n=0;const client=createProjectClient(`/project/${A}`,async(url,opts)=>{headers.push(opts.headers.get('X-Product-Graph-Revision'));return Response.json({workspaceRevision:++n===1?'observed':'new'});});
 await client.request('/api/workspace');await client.request('/api/context?rootId=x');await client.request('/api/proposals/x/preview',{method:'POST'});await client.request('/api/workspace',{method:'POST'});assert.equal(headers.at(-1),'observed');
});
test('failed writes preserve revision, and legacy serve remains unscoped',async()=>{
 const calls=[];const client=createProjectClient('/',async(url,opts)=>{calls.push([url,opts.headers.get('X-Product-Graph-Revision')]);if(calls.length===2)return Response.json({message:'Conflict'},{status:409});return Response.json({workspaceRevision:'base'});});
 await client.request('/api/workspace');await assert.rejects(client.request('/api/workspace',{method:'POST'}),/Conflict/);await client.request('/api/commands',{method:'POST'});assert.deepEqual(calls[2],['/api/commands','base']);
});
