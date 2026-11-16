import assert from 'node:assert/strict';
import {CaseVault} from '../../worker.mjs';
class Storage{m=new Map();async get(k){return structuredClone(this.m.get(k));}async put(k,v){this.m.set(k,structuredClone(v));}async delete(k){return this.m.delete(k);}async list({prefix='',limit=10000}={}){return new Map([...this.m].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}async transaction(f){return f(this);}async setAlarm(){}}
const db=new Storage(),vault=new CaseVault({storage:db,blockConcurrencyWhile:f=>f()},{});let ip=0;
async function call(path,data,cookie){return vault.fetch(new Request('https://maven.test'+path,{method:data===undefined?'GET':'POST',headers:{origin:'https://maven.test','CF-Connecting-IP':String(++ip),...(cookie?{cookie}:{}),'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}));}
const ids=['the-last-recording','the-empty-frame','the-guest-in-room-nine','the-silver-laurel','the-final-rehearsal','the-bridge-that-never-existed','the-passenger-who-never-sailed','the-thirteenth-photograph','the-ninth-sample','the-last-toast'];
for(const id of [...ids,'future-paid-case']){await db.put('case:'+id,{caseId:id,title:id,status:'published'});const fileId='a'.repeat(48);await db.put('file:'+id+':'+fileId,{id:fileId,name:'Start.pdf',category:'instructions',size:5,chunks:1});await db.put('chunk:'+fileId+':0',new TextEncoder().encode('%PDF-'));}
let r=await call('/api/account/register',{username:'free-reader',password:'Synthetic-password-123456'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
let me=await (await call('/api/account/me',undefined,cookie)).json();assert.equal(me.items.length,0);assert.equal(me.freeItems.length,10);assert.deepEqual(me.freeItems.map(i=>i.caseId),ids);assert.ok(me.freeItems.every(i=>i.expires===null&&i.free));
for(const id of ids){assert.equal((await call('/api/files?case='+id,undefined,cookie)).status,200);assert.equal((await call('/api/download/'+id+'/'+'a'.repeat(48),undefined,cookie)).status,200);}
assert.equal((await call('/api/files?case='+ids[0])).status,401);assert.equal((await call('/api/download/'+ids[0]+'/'+'a'.repeat(48))).status,401);
assert.equal((await call('/api/files?case=future-paid-case',undefined,cookie)).status,403);assert.equal((await call('/api/download/future-paid-case/'+'a'.repeat(48),undefined,cookie)).status,403);assert.equal((await call('/play/maven-talks',undefined,cookie)).status,403);
await db.put('case:'+ids[0],{caseId:ids[0],title:'Draft',status:'draft'});assert.equal((await call('/api/files?case='+ids[0],undefined,cookie)).status,403);me=await (await call('/api/account/me',undefined,cookie)).json();assert.equal(me.freeItems.length,9);
assert.equal([...db.m.keys()].filter(k=>k.startsWith('buyer:')||k.startsWith('grant:')).length,0);
// Original cases are automatic entitlements, absent from manual account grants.
const userId=[...db.m].find(([k,v])=>k.startsWith('account:')&&v.username==='free-reader')[0].slice(8);
const detail=await vault.managedAccount(userId);assert.ok(!detail.products.some(p=>ids.includes(p.caseId)));assert.ok(detail.products.some(p=>p.caseId==='future-paid-case'));
await db.put('case:'+ids[0],{caseId:ids[0],title:'Published again',status:'published'});
const snapshot=await vault.session(new Request('https://maven.test',{headers:{cookie}}));
const oldHash='b'.repeat(64);await db.put('buyer:'+oldHash,{ownerId:userId,accessVersion:'old',productId:'mysteries',caseId:ids[1],revoked:true,expires:1});await db.put('grant:'+userId+':'+oldHash,{accessVersion:'old'});
assert.equal((await call('/api/files?case='+ids[1],undefined,cookie)).status,200);me=await (await call('/api/account/me',undefined,cookie)).json();assert.equal(me.freeItems.length,10);
await db.put('master',{version:'admin-version'});const adminToken='c'.repeat(48),digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(adminToken))).toString('hex');await db.put('session:'+digest,{role:'admin',version:'admin-version',expires:Date.now()+100000});const adminCookie='__Host-maven='+adminToken;
const remote=await (await call('/api/admin/account?id='+userId,undefined,adminCookie)).json();assert.ok(!remote.products.some(p=>ids.includes(p.caseId)));
assert.equal((await call('/api/admin/account/access',{userId,accessRevision:remote.accessRevision,changes:[{key:'case:'+ids[1],enabled:false}]},adminCookie)).status,400);
assert.equal((await call('/api/files?case='+ids[1],undefined,cookie)).status,200);
const signup=await call('/api/account/register',{username:'new-free-reader',password:'Synthetic-password-123456'});assert.equal(signup.status,200);const newCookie=signup.headers.get('set-cookie').split(';')[0];const newDashboard=await (await call('/api/account/me',undefined,newCookie)).json();assert.equal(newDashboard.freeItems.length,10);assert.equal(newDashboard.items.length,0);

console.log('PASS: every account receives the original 10 in series order without codes or expiry; private PDFs require login; future paid products and draft cases remain protected; originals are excluded from admin grant controls and cannot be manually revoked; old revoked codes do not remove free access; new accounts immediately receive all ten.');

