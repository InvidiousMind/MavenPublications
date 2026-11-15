const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{for(const page of ['index.html','products.html','speaking-jeopardy.html','maven-cards.html']){
 const source=fs.readFileSync(__dirname+'/'+page,'utf8'),start=source.indexOf("document.querySelectorAll('.jeopardy-access')"),script=source.slice(start,source.indexOf('</script>',start));assert.ok(start>0,page);
 for(const destination of ['/play/maven-talks','/play/maven-sat','/play/maven-toefl','/play/maven-ielts','/play/speaking-jeopardy',null]){
  const input={value:'valid-code-for-any-product'},status={},form={dataset:{},querySelector:s=>s==='input'?input:status,addEventListener:(e,f)=>form.submit=f};let payload,opened;
  vm.runInNewContext(script,{document:{querySelectorAll:()=>[form]},fetch:async(url,options)=>{payload=JSON.parse(options.body);return{ok:true,json:async()=>({destination})}},location:{assign:url=>opened=url}});
  await form.submit({preventDefault(){}});assert.deepEqual(payload,{code:'valid-code-for-any-product'});assert.equal(opened,destination||'/portal');assert.equal(input.value,'');
 }
}
console.log('PASS: every public code form accepts any product code and routes all five apps or mystery portal correctly.');})().catch(e=>{console.error(e);process.exit(1)});
