import assert from 'node:assert/strict';
import {CaseVault} from './worker.mjs';
import {briefing,reactionFiles,transcript} from './seasons-content.mjs';

class Storage {
  values = new Map();
  queue = Promise.resolve();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key,value) { this.values.set(key,structuredClone(value)); }
  async delete(key) { return this.values.delete(key); }
  async list({prefix='',limit=1000}={}) { return new Map([...this.values].filter(([key])=>key.startsWith(prefix)).slice(0,limit)); }
  async setAlarm() {}
  async transaction(run) {
    const next=this.queue.then(()=>run(this));
    this.queue=next.catch(()=>{});
    return next;
  }
}
class Bucket {
  files = new Map();
  async put(key,bytes,{httpMetadata}) { this.files.set(key,{bytes,httpMetadata,size:bytes.byteLength}); }
  async head(key) { return this.files.get(key); }
  async get(key,options) {
    const file=this.files.get(key);
    if (!file) return null;
    const range=options?.range;
    return {...file,body:range?file.bytes.slice(range.offset,range.offset+range.length):file.bytes};
  }
}
const db=new Storage(), bucket=new Bucket();
const vault=new CaseVault({storage:db,blockConcurrencyWhile:fn=>fn()},{SEASONS_MEDIA:bucket,ADMIN_BOOTSTRAP_CODE:'test-admin-code-123456'});
const origin='https://maven.test';
async function call(path,{body,cookie,guest,extra={}}={}) {
  const raw = body instanceof Uint8Array;
  return vault.fetch(new Request(origin+path,{
    method:body===undefined?'GET':'POST',
    headers:{origin,...(cookie?{cookie}:{}),...(guest?{'x-room-credential':guest}:{}),...(raw?{'content-length':String(body.length)}:body?{'content-type':'application/json'}:{}),...extra},
    body:body===undefined?undefined:raw?body:JSON.stringify(body)
  }));
}
const login=await call('/api/login',{body:{role:'admin',code:'test-admin-code-123456'}});
assert.equal(login.status,200);
const admin=login.headers.get('set-cookie').split(';')[0];
const first='a'.repeat(48),second='b'.repeat(48);
async function member(id,character){
  await db.put('account:'+id,{username:character,version:'member-v1'});
  const raw=character.repeat(48);
  const key=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))).toString('hex');
  await db.put('session:'+key,{role:'customer',version:'member-v1',userId:id,expires:Date.now()+3600000});
  return '__Host-maven='+raw;
}
const host=await member(first,'a'), other=await member(second,'b');
const path=(action,values={})=>'/api/seasons/'+action+'?'+new URLSearchParams(values);
assert.equal((await call(path('create'),{cookie:host,body:{}})).status,403);
assert.equal((await call(path('admin/grant'),{cookie:other,body:{member:first}})).status,403);
assert.equal((await call(path('admin/grant'),{cookie:admin,body:{member:first}})).status,200);
const product=await (await call('/api/account/me',{cookie:host})).json();
assert.ok(product.items.some(item=>item.productId==='maven-mystery-seasons'));
const confirmation=await (await call(path('admin/code'),{cookie:admin,body:{}})).json();
assert.equal((await call('/api/account/activate',{cookie:other,body:confirmation})).status,200);
assert.equal((await call('/api/account/activate',{cookie:host,body:confirmation})).status,403);
const bytes=new TextEncoder().encode('test asset');
async function upload(group,name) {
  assert.equal((await call(path('admin/asset',{group,slot:'S0001_E01',name}),{cookie:admin,body:bytes})).status,200);
}
for (const name of ['solution.pdf','host-guide.pdf','case-1.pdf','case-6.pdf','audit.pdf',transcript]) await upload('episode',name);
const accountDetails = async id=>(await call('/api/admin/account?id='+id,{cookie:admin})).json();
const assign = (id,revision,changes,cookie=admin)=>call('/api/admin/account/access',{
  cookie,body:{userId:id,accessRevision:revision,changes}
});
const detail = await accountDetails(first);
assert.equal(detail.products.find(p=>p.key==='seasons:host').enabled,true);
assert.equal(detail.products.find(p=>p.key==='seasons:product').enabled,false);
const productGrant = [{key:'seasons:product',enabled:true,expiresOn:'2099-01-01'}];
assert.equal((await assign(first,detail.accessRevision,productGrant,host)).status,403);
assert.equal((await assign(first,detail.accessRevision,productGrant)).status,200);
assert.equal((await assign(first,detail.accessRevision,productGrant)).status,409);
const updated = await accountDetails(first);
const expires = updated.products.find(p=>p.key==='seasons:product').expires;
assert.equal(new Date(expires).getUTCFullYear(),new Date().getUTCFullYear()+1);
const dashboard = await (await call('/api/account/me',{cookie:host})).json();
assert.ok(dashboard.items.some(item=>item.destination==='/mystery-seasons-game?product=1'));
assert.equal((await call(path('product',{name:'case-1.pdf'}),{cookie:host})).status,200);
assert.equal((await call(path('product',{name:'solution.pdf'}),{cookie:host})).status,403);
assert.equal((await call(path('product',{name:'host-guide.pdf'}),{cookie:host})).status,403);
assert.equal((await call(path('product',{name:'case-1.pdf'}),{cookie:other})).status,403);
assert.equal((await assign(first,updated.accessRevision,[{key:'seasons:product',enabled:false}])).status,200);
assert.equal((await call(path('product'),{cookie:host})).status,403);
assert.equal((await accountDetails(first)).products.find(p=>p.key==='seasons:host').enabled,true);
await upload('shared',briefing[0].filename);
await upload('episode',briefing[5].filename);
for (const name of Object.values(reactionFiles)) await upload('shared',name+'.mp4');
assert.equal((await call(path('admin/asset',{group:'episode',slot:'S0001_E01',name:'solution.pdf'}),{cookie:host,body:bytes})).status,403);
const room=await (await call(path('create'),{cookie:host,body:{}})).json();
assert.match(room.code,/^[A-Z2-9]{6}$/);
const within=(action,options={},params={})=>call(path(action,{room:room.code,...params}),options);
const play=async(name,options={})=>within('asset',options,{name});
const command=(type,args={})=>within('room',{cookie:host,body:{type,...args}});
const firstGuest=await within('join',{body:{name:'Guest One'}});
assert.match(firstGuest.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
const joined=await firstGuest.json();
let guest=joined.secret;
assert.match(joined.rejoin,/^[A-HJ-NP-Z2-9]{6}$/);
assert.match(guest,/^[a-f0-9]{64}$/);
assert.ok(firstGuest.headers.get('set-cookie').startsWith('seasons_guest_'+room.code+'='));
const replacement=(await (await within('join',{body:{name:'Replacement'}})).json()).secret;
const roster=await (await within('state',{cookie:host})).json();
const [owner,backup]=roster.players.map(p=>p.id);
assert.equal((await command('assign',{player:owner,files:[1,2,3,4,5,6]})).status,200);
assert.equal((await play('case-1.pdf',{guest})).status,403);
assert.equal((await play('solution.pdf',{guest})).status,403);
assert.equal((await play('host-guide.pdf',{guest})).status,403);
assert.equal((await play('solution.pdf',{cookie:host})).status,200);
assert.equal((await play('solution.pdf',{cookie:other})).status,403);
assert.equal((await command('briefing')).status,200);
const range=await play(briefing[0].filename,{cookie:host,extra:{range:'bytes=0-2'}});
assert.equal(range.status,206);
assert.equal(await range.text(),'tes');
assert.equal((await command('briefing-shown')).status,200);
assert.equal((await play(briefing[0].filename,{guest})).status,403);
assert.equal((await play(briefing[5].filename,{guest})).status,200);
assert.equal((await play(transcript,{guest})).status,200);
assert.equal((await command('briefing')).status,409);
assert.equal((await command('start')).status,200);
assert.equal((await play('audit.pdf',{guest})).status,403);
const journal=(file,answers,complete)=>within('room',{guest,body:{type:'journal',file,answers,complete}});
let state=await (await journal(1,['This is clear','Not established','My note','My question'],true)).json();
assert.equal(state.player.journals[1].complete,true);
state=await (await journal(1,['This is clear','','My note','My question'],true)).json();
assert.equal(state.player.journals[1].complete,false);
assert.equal((await command('assign',{player:backup,files:[6]})).status,200);
assert.equal((await play('case-6.pdf',{guest})).status,403);
assert.equal((await play('case-6.pdf',{guest:replacement})).status,200);
assert.equal((await within('join',{body:{rejoin:guest}})).status,403);
const rejoined=await within('join',{body:{rejoin:joined.rejoin.toLowerCase()}});
assert.equal(rejoined.status,200);
const resumed=await rejoined.json();
assert.equal(resumed.rejoin,joined.rejoin);
assert.notEqual(resumed.secret,guest);
assert.equal((await within('state',{guest})).status,403);
assert.equal((await within('state',{guest:resumed.secret})).status,200);
guest=resumed.secret;
assert.equal((await play('case-1.pdf',{cookie:rejoined.headers.get('set-cookie').split(';')[0]})).status,200);
assert.equal((await command('audit')).status,200);
assert.equal((await play('audit.pdf',{guest})).status,200);
assert.equal((await play('case-1.pdf',{guest})).status,200);
assert.equal((await command('submit')).status,200);
let reaction=await (await command('outcome',{outcome:'WRONG_RETRY'})).json();
assert.equal(reaction.phase,'feedback');
assert.equal((await command('resume')).status,200);
assert.equal((await command('submit')).status,200);
reaction=await (await command('outcome',{outcome:'CORRECT'})).json();
assert.equal(reaction.phase,'closed');
assert.equal((await play(reactionFiles.CORRECT+'.mp4',{guest})).status,200);
assert.equal((await command('reaction-shown',{id:reaction.reaction.id})).status,200);
assert.equal((await play(reactionFiles.CORRECT+'.mp4',{guest})).status,403);
assert.equal((await command('reveal')).status,200);
assert.equal((await play('solution.pdf',{guest})).status,403);
const alternate=await (await call(path('create'),{cookie:host,body:{}})).json();
const alternateAction=(type,extra={})=>call(path('room',{room:alternate.code}),{cookie:host,body:{type,...extra}});
await call(path('join',{room:alternate.code}),{body:{name:'Guest'}});
const alternateRoster=await (await call(path('state',{room:alternate.code}),{cookie:host})).json();
assert.equal((await alternateAction('assign',{player:alternateRoster.players[0].id,files:[1,2,3,4,5,6]})).status,200);
for (const step of ['briefing','briefing-shown','start','audit','submit']) assert.equal((await alternateAction(step)).status,200);
assert.equal((await (await alternateAction('outcome',{outcome:'CONVICT_ANYWAY'})).json()).phase,'closed');
assert.equal((await alternateAction('reveal')).status,409);
console.log('Mystery Seasons hosted flow, member grants, private delivery and all outcomes passed.');
