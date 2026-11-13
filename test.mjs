
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

// Recover through a Cloudflare-owned one-use secret. Keep all buyer and PDF records.
const recoverySecret='Recovery-test-code-1234567890';
const recovery=new CaseVault({storage,blockConcurrencyWhile:f=>f()},{ADMIN_RESET_CODE:recoverySecret});
const recover=async(code)=>recovery.fetch(new Request('https://maven.test/api/login',{method:'POST',headers:{origin:'https://maven.test','CF-Connecting-IP':'recovery-'+(++ip)},body:JSON.stringify({role:'admin',code})}));
const beforeFiles=await storage.list({prefix:'file:'}),beforeBuyers=await storage.list({prefix:'buyer:'});
assert.equal((await recover('incorrect-recovery-code')).status,401);
assert.equal((await recover(recoverySecret)).status,200);
assert.equal((await recover('New-master-code-123456')).status,401);
assert.deepEqual(await storage.list({prefix:'file:'}),beforeFiles);assert.deepEqual(await storage.list({prefix:'buyer:'}),beforeBuyers);
const recoveredToken=take(await recover(recoverySecret));
assert.equal((await recovery.fetch(new Request('https://maven.test/api/admin/master',{method:'POST',headers:{origin:'https://maven.test',cookie:recoveredToken,'CF-Connecting-IP':'rotate-recovered'},body:JSON.stringify({currentCode:recoverySecret,newCode:'Final-private-test-code-123456'})}))).status,200);
assert.equal((await recover(recoverySecret)).status,401);
assert.equal((await recover('Final-private-test-code-123456')).status,200);
assert.equal((await storage.list({prefix:'admin-reset-used:'})).size,1);
console.log('PASS: recovery requires the Cloudflare secret, invalidates the old master, preserves buyers/files, and cannot replay after master rotation.');

const caseAdmin=take(await call('login',{role:'admin',code:'Final-private-test-code-123456'}));
assert.equal((await call('admin/cases')).status,401);
let publicCases=await(await call('cases')).json();assert.equal(publicCases.cases.length,0);
const newCase={mode:'create',caseId:'new-mystery',title:'New Mystery',synopsis:'A spoiler-free test description.',status:'draft'};
assert.equal((await call('admin/cases',newCase,caseAdmin)).status,200);
assert.equal((await call('admin/cases',newCase,caseAdmin)).status,409);
assert.equal((await call('admin/cases',{...newCase,caseId:'../invalid'},caseAdmin)).status,400);
assert.equal((await call('admin/cases',{...newCase,mode:'update',status:'published'},caseAdmin)).status,409);
assert.equal((await(await call('cases')).json()).cases.length,0);
r=await call('admin/codes',{caseId:'new-mystery'},caseAdmin);const newBuyerCode=(await r.json()).code;const newBuyerSession=take(await call('login',{code:newBuyerCode}));
assert.equal((await call('admin/cases',newCase,newBuyerSession)).status,403);
for(const category of ['instructions','case-file','hints','solution']){const f=new FormData();f.set('caseId','new-mystery');f.set('category',category);f.set('file',new Blob(['%PDF-1.7\nCase test']),'case.pdf');assert.equal((await call('admin/upload',f,caseAdmin)).status,200);}
assert.equal((await call('admin/cases',{...newCase,mode:'update',status:'published'},caseAdmin)).status,200);
publicCases=await(await call('cases')).json();assert.equal(publicCases.cases.length,1);assert.deepEqual(Object.keys(publicCases.cases[0]).sort(),['caseId','synopsis','title']);
const caseFiles=(await(await call('files?case=new-mystery',undefined,caseAdmin)).json()).files;
assert.equal((await call('admin/delete-file',{caseId:'new-mystery',id:caseFiles[0].id},caseAdmin)).status,409);
assert.equal((await call('download/new-mystery/'+caseFiles[0].id)).status,401);
assert.equal((await call('download/new-mystery/'+caseFiles[0].id,undefined,newBuyerSession)).status,200);
assert.equal((await call('admin/cases',{...newCase,mode:'update',status:'archived'},caseAdmin)).status,200);
assert.equal((await(await call('cases')).json()).cases.length,0);
assert.equal((await call('download/new-mystery/'+caseFiles[0].id,undefined,newBuyerSession)).status,200);
assert.equal((await(await call('me',undefined,newBuyerSession)).json()).caseTitle,'New Mystery');
assert.equal((await call('admin/codes',{caseId:'unregistered-case'},caseAdmin)).status,400);
console.log('PASS: case create/edit validation, draft privacy, publication gate, public metadata only, protected PDFs, archival preserving buyer access, case names and unregistered-case rejection.');

// Custom customer IDs must round-trip without fixed-format restrictions.
for(const customerId of ['MAV-00001','VIP-ALICAN','Special customer 42','Özel/2026']){
 const response=await call('admin/codes',{caseId:'new-mystery',customerId},caseAdmin);
 assert.equal(response.status,200);assert.equal((await response.json()).customerId,customerId);
}
for(const customerId of ['', '   ', 'x'.repeat(101)])assert.equal((await call('admin/codes',{caseId:'new-mystery',customerId},caseAdmin)).status,400);
console.log('PASS: custom customer IDs accepted unchanged; empty and oversized IDs rejected.');
