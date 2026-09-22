import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectRegistry } from '../src/project-registry.ts';
import { documentStructure, listDocuments, readDocument } from '../src/documents.ts';

function fixture(t:any) { const home=fs.mkdtempSync(path.join(os.tmpdir(),'pg-docs-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true})); const registry=new ProjectRegistry(home);return {home,root:registry.create('Documents').root}; }
test('physical source and generated documents stay separate and are read-only',t=>{
 const {root}=fixture(t);fs.mkdirSync(path.join(root,'projections'));fs.writeFileSync(path.join(root,'projections/domain.md'),'# Domain\n');
 const list=listDocuments(root); assert.equal(list.documents.length,2);assert.equal(list.documents.find(d=>d.path==='projections/domain.md')?.kind,'generated');assert.equal(list.capabilities.editing,false);
 const doc=readDocument(root,'documents/overview.md');assert.equal(doc.nodes[0].id,'product:root');assert.equal(doc.source,'saved');assert.equal(doc.headings[1].title,'Intent');
});
test('inline local links and backlinks resolve by relative path without mutating graph',t=>{
 const {root}=fixture(t);const source=path.join(root,'documents/overview.md');fs.appendFileSync(source,'\n[Rules](rules.md#limits)\n');fs.writeFileSync(path.join(root,'documents/rules.md'),'# Rules\n\n[Home](overview.md)\n');
 const before=fs.readFileSync(path.join(root,'graph/documents/overview.json'));
 const doc=readDocument(root,'documents/rules.md');assert.equal(doc.backlinks[0].path,'documents/overview.md');assert.equal(doc.links[0].path,'documents/overview.md');assert.equal(doc.nodes.length,0);
 assert.deepEqual(fs.readFileSync(path.join(root,'graph/documents/overview.json')),before);
});
test('fences, frontmatter and inline code do not become headings or links',()=>{
 const parsed=documentStructure('---\ntitle: ignored\n---\n# Real\n```md\n# Fake\n[bad](bad.md)\n```\n`[code](code.md)`\n[okay](okay.md)\n[[unsupported]]','documents/source.md');
 assert.deepEqual(parsed.headings,[{level:1,title:'Real',line:4}]);assert.deepEqual(parsed.targets,['documents/okay.md']);
});
test('HTML is returned only as inert source, never parsed or executed',t=>{
 const {root}=fixture(t);const content='<img src=x onerror="alert(1)">\n<script>bad()</script>';fs.writeFileSync(path.join(root,'documents/html.md'),content);
 assert.equal(readDocument(root,'documents/html.md').content,content);
});
test('symlinks, traversal and hidden paths cannot expose other project files',t=>{
 const {home,root}=fixture(t);fs.writeFileSync(path.join(home,'secret.md'),'SECRET');fs.symlinkSync(path.join(home,'secret.md'),path.join(root,'documents/link.md'));
 assert.equal(listDocuments(root).documents.some(d=>d.path==='documents/link.md'),false);
 assert.throws(()=>readDocument(root,'documents/link.md'));assert.throws(()=>readDocument(root,'documents/../../secret.md'));assert.throws(()=>readDocument(root,'.git/secret.md'));assert.throws(()=>readDocument(root,'/etc/passwd'));
});
test('index reports limits and UTF-8/oversized files without unbounded reads',t=>{
 const {root}=fixture(t);fs.writeFileSync(path.join(root,'documents/large.md'),Buffer.alloc(1048577));fs.writeFileSync(path.join(root,'documents/bad.md'),Buffer.from([0xff,0xfe]));
 const list=listDocuments(root);assert.equal(list.notices.length,2);assert.equal(list.documents.length,1);assert.throws(()=>readDocument(root,'documents/large.md'));
});
test('missing referenced source is visible and external edits change the file revision',t=>{
 const {root}=fixture(t);const doc=readDocument(root,'documents/overview.md');fs.appendFileSync(path.join(root,'documents/overview.md'),'\nChanged');assert.notEqual(readDocument(root,'documents/overview.md').revision,doc.revision);
 fs.unlinkSync(path.join(root,'documents/overview.md'));const list=listDocuments(root);assert.equal(list.documents[0].available,false);
});
test('external targets, images and escaped traversal do not enter the local link index',()=>{
 const parsed=documentStructure('[External](https://example.com/a.md)\n![image](image.md)\n[bad](%2e%2e/%2e%2e/secret.md)\n[Other](../projections/domain.md)','documents/source.md');assert.deepEqual(parsed.targets,['projections/domain.md']);
});
