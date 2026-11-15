import assert from 'node:assert/strict';
import worker,{CaseVault} from './worker.mjs';
class Storage{m=new Map();async get(k){return structuredClone(this.m.get(k));}async put(k,v){this.m.set(k,structuredClone(v));}async delete(k){return this.m.delete(k);}async list({prefix='',limit=10000}={}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}async transaction(f){return f(this);}async setAlarm(){}}
const storage=new Storage(),vault=new CaseVault({storage,blockConcurrencyWhile:f=>f()},{ADMIN_BOOTSTRAP_CODE:'Test-admin-code-for-Jeopardy'});let ip=0;
async function call(path,data,token){const headers={origin:'https://maven.test','CF-Connecting-IP':String(++ip)};if(token)headers.cookie=token;if(data&&!(data instanceof FormData))headers['content-type']='application/json';return vault.fetch(new Request('https://maven.test'+path,{method:data?'POST':'GET',headers,body:data instanceof FormData?data:data?JSON.stringify(data):undefined}));}
const take=r=>r.headers.get('set-cookie').split(';')[0];
let r=await call('/api/login',{role:'admin',code:'Test-admin-code-for-Jeopardy'});const admin=take(r);
assert.equal((await (await call('/api/admin/game',undefined,admin)).json()).ready,false);
const upload=new FormData();upload.append('file',new Blob(['<!doctype html><html><head><title>MAVEN Jeopardy</title></head><body>180 questions'+'.'.repeat(90000)+'<script>console.log(1)</script></body></html>'],{type:'text/html'}),'MAVEN_Jeopardy.html');assert.equal((await call('/api/admin/game',upload)).status,401);assert.equal((await call('/api/admin/game',upload,admin)).status,200);assert.equal((await (await call('/api/admin/game',undefined,admin)).json()).ready,true);
r=await call('/play/speaking-jeopardy');assert.equal(r.status,303);assert.match(r.headers.get('location'),/access=required/);assert.ok(!(await r.text()).includes('180 questions'));
r=await call('/api/admin/codes',{productId:'speaking-jeopardy',customerId:'VIP Game',label:'Classroom access',code:'Game-code-123456789'},admin);assert.equal(r.status,200);const issued=await r.json();assert.equal(issued.productId,'speaking-jeopardy');assert.equal(issued.caseId,undefined);assert.ok(issued.expires>Date.now());
r=await call('/api/login',{code:issued.code,productId:'speaking-jeopardy'});assert.equal(r.status,200);const game=take(r);assert.equal((await r.json()).destination,'/play/speaking-jeopardy');
assert.equal((await (await call('/api/me',undefined,game)).json()).productTitle,'MAVEN Speaking Jeopardy');
r=await call('/play/speaking-jeopardy',undefined,game);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(await r.text(),/180 questions/);
assert.equal((await call('/api/admin/game',upload,game)).status,403);assert.equal((await call('/api/admin/codes',{},game)).status,403);assert.equal((await call('/api/files?case=the-last-recording',undefined,game)).status,400);
r=await call('/api/admin/codes',{caseId:'the-last-recording',customerId:'Mystery buyer'},admin);const mysteryCode=(await r.json()).code;
r=await call('/api/login',{code:mysteryCode,productId:'speaking-jeopardy'});assert.equal(r.status,200);assert.equal((await r.json()).destination,null);
r=await call('/api/login',{code:mysteryCode});const mystery=take(r);assert.equal((await call('/play/speaking-jeopardy',undefined,mystery)).status,403);
r=await call('/api/admin/codes',undefined,admin);const gameRecord=(await r.json()).codes.find(c=>c.productId==='speaking-jeopardy');
await call('/api/admin/revoke',{id:gameRecord.id},admin);assert.equal((await call('/play/speaking-jeopardy',undefined,game)).status,303);assert.equal((await call('/api/login',{code:issued.code})).status,401);
await call('/api/admin/delete-revoked',{id:gameRecord.id},admin);r=await call('/api/admin/codes',{productId:'speaking-jeopardy',customerId:'Replacement',code:issued.code},admin);assert.equal(r.status,200);assert.equal((await call('/play/speaking-jeopardy',undefined,game)).status,303);
r=await call('/api/login',{code:issued.code});const replacement=take(r);const key='buyer:'+gameRecord.id;const record=await storage.get(key);await storage.put(key,{...record,expires:Date.now()-1});assert.equal((await call('/play/speaking-jeopardy',undefined,replacement)).status,303);
let assetRead=false;const env={VAULT:{idFromName(){return 'vault';},get(){return vault;}},ASSETS:{fetch(){assetRead=true;return new Response('Public asset');}}};r=await worker.fetch(new Request('https://maven.test/play/speaking-jeopardy'),env);assert.equal(r.status,303);assert.equal(assetRead,false);
const invalid=new FormData();invalid.append('file',new Blob(['not a game']),'bad.html');assert.equal((await call('/api/admin/game',invalid,admin)).status,400);
console.log('PASS: private game upload, admin-only upload permissions, file validation, game code creation, assignment, universal login destination, private game routing, case isolation, expiry, revocation, reuse and stale session rejection.');

