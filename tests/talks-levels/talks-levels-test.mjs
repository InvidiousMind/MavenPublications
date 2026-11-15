import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CaseVault} from '../../worker.mjs';
class Storage{m=new Map();async get(k){return structuredClone(this.m.get(k));}async put(k,v){this.m.set(k,structuredClone(v));}async delete(k){return this.m.delete(k);}async list({prefix='',limit=10000}={}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}async transaction(f){return f(this);}async setAlarm(){}}
const db=new Storage(),vault=new CaseVault({storage:db,blockConcurrencyWhile:f=>f()},{ADMIN_BOOTSTRAP_CODE:'Synthetic-admin-123456'});let ip=0;
async function call(path,data,cookie){return vault.fetch(new Request('https://maven.test'+path,{method:data===undefined?'GET':'POST',headers:{origin:'https://maven.test','CF-Connecting-IP':String(++ip),...(cookie?{cookie}:{}),...(data instanceof FormData?{}:{'content-type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}));}
const token=r=>r.headers.get('set-cookie')?.split(';')[0];let r=await call('/api/login',{role:'admin',code:'Synthetic-admin-123456'});const admin=token(r);
r=await call('/api/account/register',{username:'level-reader',password:'Synthetic-password-123456'});const customer=token(r);
const ids=['a1','a2','b1','b2','c1','c2'].map(level=>'maven-talks-'+level),cookies=[],codes=[];
for(const [index,id]of ids.entries()){
 assert.equal((await call('/play/'+id)).status,303);assert.equal((await call('/play/'+id,undefined,customer)).status,403);
 r=await call('/api/admin/codes',{productId:id,customerId:'TEST-'+id},admin);assert.equal(r.status,200);const code=(await r.json()).code;codes.push(code);
 r=await call('/api/login',{code});assert.equal(r.status,200);assert.equal((await r.clone().json()).destination,'/play/'+id);cookies.push(token(r));
 assert.equal((await call('/play/'+id,undefined,cookies[index])).status,503);
 const form=new FormData();form.append('file',new Blob(['<html><head></head><body><button id="menuButton">Menu</button><nav id="menu"></nav><main>PRIVATE '+id+'</main><script>const pack="'+id+'";</script></body></html>']),'Level.html');
 assert.equal((await call('/api/admin/card-app?product='+id,form,admin)).status,200);
 r=await call('/play/'+id,undefined,cookies[index]);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('PRIVATE '+id));assert.ok(html.includes('Back to dashboard'));
 assert.equal((await call('/play/'+ids[(index+1)%6],undefined,cookies[index])).status,403);
 r=await call('/api/login',{code},customer);assert.equal(r.status,200);assert.equal((await r.json()).destination,'/play/'+id);
}
let me=await (await call('/api/account/me',undefined,customer)).json();assert.equal(me.items.length,6);assert.ok(me.items.every(i=>i.ready&&i.status==='active'&&ids.includes(i.productId)));
const userId=[...db.m].find(([k,v])=>k.startsWith('account:')&&v.username==='level-reader')[0].slice(8);
r=await call('/api/admin/account?id='+userId,undefined,admin);const details=await r.json();assert.equal(details.products.filter(p=>ids.includes(p.productId)).length,6);assert.ok(details.products.filter(p=>ids.includes(p.productId)).every(p=>p.group==='MAVEN Cards / MAVEN Talks'));
await call('/api/admin/account/access',{userId,accessRevision:details.accessRevision,changes:[{key:'app:'+ids[0],enabled:false}]},admin);assert.equal((await call('/play/'+ids[0],undefined,customer)).status,403);assert.equal((await call('/play/'+ids[1],undefined,customer)).status,200);
for(const name of ['index.html','products.html','maven-cards.html','speaking-jeopardy.html','portal.html']){const html=fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');for(const id of ids)assert.ok(html.includes('/play/'+id),name+' accepts '+id);}
const publicPage=fs.readFileSync(new URL('../../maven-cards.html',import.meta.url),'utf8');for(const level of ['A1','A2','B1','B2','C1','C2'])assert.ok(publicPage.includes('<h3>MAVEN Talks '+level+'</h3>'));assert.equal((publicPage.match(/class="talks-question-count">180 questions/g)||[]).length,6);
console.log('PASS: six private level apps, isolated codes, universal activation, dashboard readiness, admin checkboxes, independent revocation, navigation, public catalogue and 180-question labels.');
