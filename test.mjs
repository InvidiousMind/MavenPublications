
import assert from 'node:assert/strict';import worker,{CaseVault,annualExpiry}from './worker.mjs';
class Storage{m=new Map();async get(k){return structuredClone(this.m.get(k));}async put(k,v){this.m.set(k,structuredClone(v));}async delete(k){return this.m.delete(k);}async list({prefix='',limit=10000}={}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}async transaction(f){return f(this);}async setAlarm(){} }
const storage=new Storage(),state={storage,blockConcurrencyWhile:f=>f()},vault=new CaseVault(state,{ADMIN_BOOTSTRAP_CODE:'Initial-master-code-123456'});let ip=0;
async function call(path,data,token,method){if(path==='admin/codes'&&data)data={customerId:'MAV-000001',...data};const headers={origin:'https://maven.test','CF-Connecting-IP':String(++ip)};if(token)headers.cookie=token;if(data!==undefined&&!(data instanceof FormData))headers['content-type']='application/json';return vault.fetch(new Request('https://maven.test/api/'+path,{method:method||(data===undefined?'GET':'POST'),headers,body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}));}
const take=r=>r.headers.get('set-cookie').split(';')[0];
assert.equal((await call('files')).status,401);
assert.equal((await call('login',{role:'admin',code:'not-the-right-code-123'})).status,401);
let r=await call('login',{role:'admin',code:'Initial-master-code-123456'});assert.equal(r.status,200);const admin=take(r);
r=await call('admin/codes',{label:'Order 1',caseId:'the-last-recording'},admin);const buyer=await r.json();assert.ok(buyer.code.length>30);
assert.equal((await call('admin/codes',{caseId:'the-last-recording',code:buyer.code},admin)).status,409);
r=await call('login',{code:buyer.code});assert.equal(r.status,200);const session=take(r);
assert.equal((await call('admin/codes',undefined,session)).status,403);
assert.equal((await call('download/another-case/'+ 'a'.repeat(48),undefined,session)).status,403);
const pdf=new Uint8Array(140000);pdf.set(new TextEncoder().encode('%PDF-1.7\nTest document'));const form=new FormData();form.set('caseId','the-last-recording');form.set('category','solution');form.set('file',new Blob([pdf],{type:'application/pdf'}),'solution.pdf');
assert.equal((await call('admin/upload',form,admin)).status,200);
r=await call('files',undefined,session);const listing=await r.json();assert.equal(listing.files.length,1);const file=listing.files[0];const url='download/the-last-recording/'+file.id;
assert.equal((await call(url)).status,401);r=await call(url,undefined,session);assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),pdf);
const records=await(await call('admin/codes',undefined,admin)).json();assert.equal(JSON.stringify(records).includes(buyer.code),false);
const key='buyer:'+records.codes[0].id;const record=await storage.get(key);await storage.put(key,{...record,expires:Date.now()-1});assert.equal((await call(url,undefined,session)).status,401);assert.equal((await call('login',{code:buyer.code})).status,401);await storage.put(key,record);
assert.equal(annualExpiry('2024-02-29'),Date.parse('2025-02-28T00:00:00+03:00'));assert.equal(annualExpiry('2026-11-13'),Date.parse('2027-11-13T00:00:00+03:00'));assert.throws(()=>annualExpiry('2026-02-30'));
assert.equal((await call('admin/revoke',{id:records.codes[0].id},admin)).status,200);
assert.equal((await call(url,undefined,session)).status,401);assert.equal((await call('login',{code:buyer.code})).status,401);
assert.equal((await call('admin/master',{currentCode:'wrong-code',newCode:'New-master-code-123456'},admin)).status,401);
assert.equal((await call('admin/master',{currentCode:'Initial-master-code-123456',newCode:'New-master-code-123456'},admin)).status,200);
assert.equal((await call('admin/codes',undefined,admin)).status,401);
assert.equal((await call('login',{role:'admin',code:'Initial-master-code-123456'})).status,401);
r=await call('login',{role:'admin',code:'New-master-code-123456'});assert.equal(r.status,200);
assert.equal((await vault.fetch(new Request('https://maven.test/api/login',{method:'POST',headers:{origin:'https://attacker.test'},body:'{}'}))).status,403);
for(let i=0;i<11;i++){r=await vault.fetch(new Request('https://maven.test/api/login',{method:'POST',headers:{origin:'https://maven.test','CF-Connecting-IP':'rate-test'},body:JSON.stringify({code:'invalid-code-123456'})}));}assert.equal(r.status,429);
assert.equal((await worker.fetch(new Request('https://maven.test/api/me'),{})).status,503);
const v2=new CaseVault({storage,blockConcurrencyWhile:f=>f()},{ADMIN_BOOTSTRAP_CODE:'Initial-master-code-123456'});assert.equal((await v2.fetch(new Request('https://maven.test/api/login',{method:'POST',headers:{origin:'https://maven.test','CF-Connecting-IP':'restart'},body:JSON.stringify({role:'admin',code:'Initial-master-code-123456'})}))).status,401);
console.log('PASS: annual expiry, leap-year handling, expired login/download rejection, admin initialization, unique codes, case isolation, private multi-chunk PDFs, revocation, master rotation, restart persistence, origin check, rate limiting, missing setup.');
