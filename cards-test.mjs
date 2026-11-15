import assert from 'node:assert/strict';
import worker,{CaseVault} from './worker.mjs';
class Storage{m=new Map();async get(k){return structuredClone(this.m.get(k));}async put(k,v){this.m.set(k,structuredClone(v));}async delete(k){return this.m.delete(k);}async list({prefix='',limit=10000}={}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}async transaction(f){return f(this);}async setAlarm(){}}
const storage=new Storage(),vault=new CaseVault({storage,blockConcurrencyWhile:f=>f()},{ADMIN_BOOTSTRAP_CODE:'Test-Cards-admin-123456'});let ip=0;
async function call(path,data,token){const headers={origin:'https://maven.test','CF-Connecting-IP':String(++ip)};if(token)headers.cookie=token;if(data&&!(data instanceof FormData))headers['content-type']='application/json';return vault.fetch(new Request('https://maven.test'+path,{method:data?'POST':'GET',headers,body:data instanceof FormData?data:data?JSON.stringify(data):undefined}));}
const take=r=>r.headers.get('set-cookie').split(';')[0];let r=await call('/api/login',{role:'admin',code:'Test-Cards-admin-123456'});const admin=take(r),sessions=new Map();
for(const id of ['maven-talks','maven-sat','maven-toefl','maven-ielts']){
 assert.equal((await call('/play/'+id)).status,303);
 r=await call('/api/admin/codes',{productId:id,customerId:'Classroom',code:id+'-access-code-123456'},admin);assert.equal(r.status,200);const issued=await r.json();assert.equal(issued.productId,id);
 r=await call('/api/login',{code:issued.code,productId:'speaking-jeopardy'});assert.equal(r.status,200);const session=take(r);sessions.set(id,session);assert.equal((await r.json()).destination,'/play/'+id);
 assert.equal((await (await call('/api/me',undefined,session)).json()).destination,'/play/'+id);
 assert.equal((await call('/play/'+id,undefined,session)).status,503);
 const form=new FormData();form.append('file',new Blob(['<!doctype html><html><body>'+id+' '+'.'.repeat(70000)+'<script>console.log(1)</script></body></html>'],{type:'text/html'}),'Flashcards.html');
 assert.equal((await call('/api/admin/card-app?product='+id,form,session)).status,403);
 assert.equal((await call('/api/admin/card-app?product='+id,form,admin)).status,200);
 r=await call('/play/'+id,undefined,session);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.ok((await r.text()).includes(id));
 assert.equal((await call('/play/speaking-jeopardy',undefined,session)).status,403);
}
assert.equal((await call('/play/maven-sat',undefined,sessions.get('maven-talks'))).status,403);
assert.equal((await call('/api/admin/card-app?product=unknown',undefined,admin)).status,400);
r=await call('/api/admin/codes',undefined,admin);const record=(await r.json()).codes.find(c=>c.productId==='maven-talks');await call('/api/admin/revoke',{id:record.id},admin);assert.equal((await call('/play/maven-talks',undefined,sessions.get('maven-talks'))).status,303);
const sat=(await (await call('/api/admin/codes',undefined,admin)).json()).codes.find(c=>c.productId==='maven-sat');const key='buyer:'+sat.id;await storage.put(key,{...await storage.get(key),expires:Date.now()-1});assert.equal((await call('/play/maven-sat',undefined,sessions.get('maven-sat'))).status,303);
let assetRead=false;const env={VAULT:{idFromName(){return 'vault';},get(){return vault;}},ASSETS:{fetch(){assetRead=true;return new Response('Public asset');}}};r=await worker.fetch(new Request('https://maven.test/play/maven-ielts'),env);assert.equal(r.status,303);assert.equal(assetRead,false);
console.log('PASS: all four collection code destinations, private HTML apps, cross-product isolation, missing app handling, admin uploads, revocation, expiry and worker routing.');
