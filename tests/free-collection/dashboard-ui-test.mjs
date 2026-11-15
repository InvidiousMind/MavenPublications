import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../account.html',import.meta.url),'utf8');
for(const [,script]of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
class Node{constructor(tag){this.tag=tag;this.children=[];this.textContent='';}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}}
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,new Node('div'));return elements.get(id);};
const context=vm.createContext({$,document:{createElement:tag=>new Node(tag)},Date,Set});
vm.runInContext("const element=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};"+html.slice(html.indexOf('function itemCard('),html.indexOf('async function load(){')),context);
const text=node=>[node.textContent,...node.children.map(text)].join(' ');
const free=Array.from({length:10},(_,i)=>({productId:'mysteries',caseId:'original-'+i,title:'Original '+i,free:true,ready:true,status:'active',expires:null,destination:'/account?case=original-'+i}));
context.free=free;vm.runInContext('renderCollection([],free)',context);
let area=$('unlocked-products');assert.equal(area.children.length,4);for(const title of ['MAVEN Cards (0)','MAVEN Notes (0)','MAVEN Speaking Jeopardy (0)','MAVEN Talks (0)','MAVEN SAT (0)','MAVEN TOEFL (0)','MAVEN IELTS (0)'])assert.ok(text(area).includes(title));assert.ok(text(area).includes('MAVEN Mysteries (10)'));
let mystery=area.children[0],details=mystery.children.find(n=>n.tag==='details');assert.ok(details);assert.ok(!details.open);assert.ok(text(details).includes('Original 10 · Free (10)'));assert.equal(details.children.find(n=>n.className==='unlocked-grid').children.length,10);assert.equal($('product-count').textContent,'(10)');
context.paid=[{...free[0],free:false},{productId:'mysteries',caseId:'paid',title:'Purchased investigation',status:'active',ready:true,expires:Date.now()+10000,destination:'/account?case=paid'},{productId:'maven-talks',title:'MAVEN Talks',status:'active',ready:true,expires:Date.now()+10000,destination:'/play/maven-talks'},{productId:'speaking-jeopardy',title:'MAVEN Speaking Jeopardy',status:'expired',expires:1}];
vm.runInContext('renderCollection(paid,free)',context);area=$('unlocked-products');assert.equal($('product-count').textContent,'(12)');assert.ok(text(area).includes('Purchased mysteries (1)'));assert.ok(text(area).includes('MAVEN Cards (1)'));assert.ok(text(area).includes('MAVEN Speaking Jeopardy (0)'));assert.ok(text(area).includes('Expired'));mystery=area.children[0];assert.equal(mystery.children.find(n=>n.className==='unlocked-grid').children.length,1);
console.log('PASS: dashboard scripts parse; all product families and card types display zero counts; original ten collapse by default; purchased mysteries stay outside; free/paid duplicates and expired products do not inflate counts.');
