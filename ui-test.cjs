const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Element{
 constructor(tag='div',text=''){this.tag=tag;this.textContent=text;this.value='';this.dataset={};this.events={};this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.classes=new Set();this.classList={toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
 addEventListener(k,f){this.events[k]=f;}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=[...x];}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}scrollIntoView(){}focus(){}querySelector(){return new Element();}click(){return this.onclick?.();}reset(){}
}
const tick=()=>new Promise(r=>setImmediate(r));
async function boot(role='admin',initialHash='',query=null){
 const html=fs.readFileSync(__dirname+'/portal.html','utf8'),els=new Map();
 for(const m of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new Element(m[1]);e.hidden=/\bhidden\b/.test(m[2]);e.value=m[2].match(/\bvalue="([^"]*)"/)?.[1]||'';els.set('#'+m[3],e);}
 const get=s=>{if(!els.has(s))els.set(s,new Element());return els.get(s);};
 const body=new Element(),events={},loc={search:query??(role==='admin'?'?admin=1':''),hash:initialHash,reload(){}};
 let currentCase='the-empty-frame',currentTitle='The Empty Frame',loginFails=false;const requests=[];
 let records=[{caseId:'the-last-recording',title:'The Last Recording',status:'published'},{caseId:'the-empty-frame',title:'The Empty Frame',status:'draft'},{caseId:'the-guest-in-room-nine',title:'The Guest in Room Nine',status:'published'}],savedOrders=[],orderFails=false,deleteFails=true,deleted=false;
 let accessDeleted=false,accessDeleteFails=true;const revokedEntry={id:'b'.repeat(64),label:'Old purchase',customerId:'VIP',caseId:'the-empty-frame',revoked:true,expires:Date.now()+100000};
 const fetch=async(url,opt={})=>{let data={},ok=true;
  requests.push(url);
  if(url==='/api/login'){if(loginFails){ok=false;data={error:'Invalid or expired code.'};}else{role='buyer';currentCase='the-last-recording';currentTitle='The Last Recording';}}
  if(url==='/api/me')data={role,caseId:currentCase,caseTitle:currentTitle};
  if(url==='/api/admin/codes')data={codes:accessDeleted?[]:[revokedEntry]};
  if(url==='/api/admin/cases'){if(opt.method==='POST'){const b=JSON.parse(opt.body);if(b.mode==='create')records.push(b);else records=records.map(c=>c.caseId===b.caseId?{...c,...b}:c);}data={cases:records.map(c=>({...c}))};}
  if(url==='/api/admin/cases/order'){const ids=JSON.parse(opt.body).caseIds;if(orderFails){ok=false;data={error:'Save failed. Try again.'};}else{savedOrders.push(ids);records=ids.map(id=>records.find(c=>c.caseId===id));}}
  if(url.startsWith('/api/files?'))data={files:deleted?[]:[{id:'a'.repeat(48),name:'Start Here.pdf',category:'instructions',size:123}]};
  if(url==='/api/admin/delete-revoked'){if(accessDeleteFails){ok=false;data={error:'Please try again.'};}else accessDeleted=true;}
  if(url==='/api/admin/delete-file'){if(deleteFails){ok=false;data={error:'Set the case to Draft before deleting its PDFs.'};}else deleted=true;}
  return{ok,json:async()=>data};
 };
 const context={console,Date,URLSearchParams,FormData,location:loc,document:{querySelector:get,querySelectorAll:selector=>selector==='#view-products .product-card'?[new Element('a')]:[],createElement:tag=>new Element(tag),body},window:{scrollTo(){},addEventListener:(name,fn)=>events[name]=fn},fetch};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);await tick();
 const navigate=async path=>{loc.hash='#'+path;events.hashchange();await tick();};
 return{get,loc,events,body,navigate,savedOrders,requests,setLoginFails:v=>loginFails=v,setAccessDeleteFails:v=>accessDeleteFails=v,setOrderFails:v=>orderFails=v,setDeleteFails:v=>deleteFails=v};
}
(async()=>{
 const {get,navigate,savedOrders,setOrderFails,setDeleteFails,setAccessDeleteFails,body}=await boot();
 assert.equal(get('#view-overview').hidden,false);assert.equal(get('#view-products').hidden,true);assert.ok(body.classes.has('admin-session'));
 await navigate('products');assert.equal(get('#view-products').hidden,false);assert.equal(get('#view-overview').hidden,true);
 await navigate('products/mysteries');assert.equal(get('#case-list').children.length,3);assert.equal(get('#nav-products').attributes['aria-current'],'page');
 get('#arrange-cases').onclick();assert.equal(get('#case-order-panel').hidden,false);assert.equal(get('#save-case-order').disabled,true);
 get('#case-order-list').children[1].children[2].children[0].onclick();assert.equal(savedOrders.length,0);assert.equal(get('#save-case-order').disabled,false);
 setOrderFails(true);await get('#save-case-order').onclick();assert.match(get('#order-feedback').textContent,/failed/);assert.equal(savedOrders.length,0);
 setOrderFails(false);await get('#save-case-order').onclick();assert.deepEqual(savedOrders[0],['the-empty-frame','the-last-recording','the-guest-in-room-nine']);assert.match(get('#order-feedback').textContent,/Order saved/);
 await navigate('products/mysteries/cases/the-empty-frame');assert.equal(get('#view-case').hidden,false);assert.equal(get('#case-slug').disabled,true);assert.equal(get('#case-title-input').value,'The Empty Frame');
 get('#case-title-input').value='Unsaved title';await navigate('products/mysteries/cases/the-empty-frame/files');assert.equal(get('#case-title-input').value,'Unsaved title');assert.equal(get('#case-files-panel').hidden,false);assert.equal(get('#upload-case').value,'the-empty-frame');
 let row=get('#admin-files').children[0];row.children[3].onclick();await row.children[4].children[1].onclick();assert.match(row.children[4].children[3].textContent,/Draft/);setDeleteFails(false);await row.children[4].children[1].onclick();assert.match(get('#admin-files').children[0].textContent,/not been uploaded/);
 await navigate('products/mysteries/new/files');assert.equal(get('#saved-case-upload').hidden,true);assert.equal(get('#new-case-files-note').hidden,false);
 await navigate('products/mysteries/new');get('#case-title-input').value='Fourth Mystery';get('#case-title-input').events.input();assert.equal(get('#case-slug').value,'fourth-mystery');get('#case-status').value='draft';
 await get('#case-form').events.submit({preventDefault(){},submitter:get('#save-case')});await navigate('products/mysteries/cases/fourth-mystery');assert.equal(get('#case-slug').disabled,true);assert.match(get('#case-feedback').textContent,/Case saved/);
 await navigate('access');let revokedRow=get('#codes').children[0];assert.equal(revokedRow.children[2].textContent,'Delete revoked access');revokedRow.children[2].onclick();assert.equal(revokedRow.children[3].hidden,false);revokedRow.children[3].children[2].onclick();assert.equal(revokedRow.children[3].hidden,true);revokedRow.children[2].onclick();await revokedRow.children[3].children[1].onclick();assert.match(revokedRow.children[3].children[3].textContent,/try again/);setAccessDeleteFails(false);await revokedRow.children[3].children[1].onclick();assert.match(get('#codes').children[0].textContent,/No buyer codes/);assert.equal(get('#view-access').hidden,false);assert.equal(get('#view-case').hidden,true);await navigate('settings');assert.equal(get('#view-settings').hidden,false);
 const buyer=await boot('buyer');assert.equal(buyer.get('#buyer').hidden,false);assert.equal(buyer.get('#admin').hidden,true);assert.equal(buyer.get('#logout').hidden,false);
 buyer.get('#enter-another-code').onclick();assert.equal(buyer.get('#buyer').hidden,true);assert.equal(buyer.get('#login').hidden,false);
 const entry=await boot('buyer','','?enter=1');assert.equal(entry.get('#login').hidden,false);assert.equal(entry.get('#buyer').hidden,true);assert.equal(entry.requests.length,0);
 entry.get('#access').value='invalid-code-123456';entry.setLoginFails(true);await entry.get('#login-form').events.submit({preventDefault(){},submitter:new Element('button')});assert.equal(entry.get('#login').hidden,false);assert.match(entry.get('#message').textContent,/Invalid or expired/);
 entry.setLoginFails(false);entry.get('#access').value='valid-code-12345678';await entry.get('#login-form').events.submit({preventDefault(){},submitter:new Element('button')});assert.equal(entry.get('#login').hidden,true);assert.equal(entry.get('#buyer').hidden,false);assert.equal(entry.get('#case-title').textContent,'The Last Recording');assert.ok(entry.requests.includes('/api/files?case=the-last-recording'));assert.equal(entry.get('#access').value,'');
 console.log('PASS: fresh product code entry, invalid code feedback, code resolves assigned product, switching products, and clearing submitted codes.');
 console.log('PASS: sidebar views, product hierarchy, case details/PDF tabs, unsaved tab retention, new case/save flow, order move/save/failure/retry, inline delete handling and buyer sign-out.');
})().catch(e=>{console.error(e);process.exit(1)});


