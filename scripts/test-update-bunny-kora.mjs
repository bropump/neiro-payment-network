import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateBunny} from './update-bunny-kora.mjs';

const lock=JSON.parse(readFileSync(new URL('../examples/operator/kora-release.json',import.meta.url)));
const old='sha256:'+'1'.repeat(64);
const initial={getConfig:{fee_payers:['public-fixture-payer'],enabled_methods:{sign_transaction:true},validation_config:{price:{type:'margin',margin:0.05},token_2022:{allow_token_metadata_instructions:false}}},getPayerSigner:{signer_pubkey:'public-fixture-payer',payment_address:'public-fixture-payer'}};
const results=[];
for(const scenario of ['update-child','update-index','no-op-child','no-op-index','policy-mismatch','patch-error','readiness-timeout','version-mismatch','missing-original-region','container-unready','update-propagation-lag','rollback-propagation-lag']){
  let clock=0,phase=scenario.startsWith('no-op')?'new':'old',patches=[],cancelled=0,reads=[],publicCalls=0,resolutions=0;
  async function mock(url,options={}){
    const method=options.method??'GET';
    if(url.startsWith('https://api.bunny.net/')){
      assert.equal(options.redirect,'error');
      if(method==='GET'){
        const path=new URL(url).pathname.replace('/mc/apps/public-test-app','');
        assert(['/overview','/endpoints'].includes(path),'Forbidden platform read: '+path);reads.push(path);
        if(path==='/endpoints')return {ok:true,json:async()=>({items:[{containerName:'stock-kora',type:'cdn',containerId:'fixture-container',publicHost:'public-test.invalid:443'}]})};
        const digest=phase==='new'?(scenario.endsWith('-index')?lock.image.split('@')[1]:lock.runtime_image_digest):old;
        const region={region:'EU',status:'active',instances:1,pods:[{containers:[{name:'stock-kora',status:scenario==='container-unready'&&phase==='new'?'starting':'ready',image:'ghcr.io/solana-foundation/kora@'+digest}]}]};
        const regions=[region];if(scenario==='missing-original-region')regions.push({...structuredClone(region),region:phase==='new'?'APAC':'US'});
        return {ok:true,json:async()=>({status:'active',regions})};
      }
      assert.equal(method,'PATCH');assert.equal(new URL(url).pathname,'/mc/apps/public-test-app/containers/fixture-container');
      const body=JSON.parse(options.body);patches.push(body);
      assert(!('environmentVariables' in body));
      phase=body.imageDigest===old?'old':'new';
      return {ok:!(scenario==='patch-error'&&patches.length===1),status:500,body:{cancel:async()=>{cancelled++;}},json:async()=>{throw Error('MUST NOT parse PATCH body');},text:async()=>{throw Error('MUST NOT read PATCH body');}};
    }
    assert.equal(url,'https://public-test.invalid');assert.equal(method,'POST');publicCalls++;
    const m=JSON.parse(options.body).method;assert(['getConfig','getPayerSigner'].includes(m));
    const s=structuredClone(initial);
    if(phase==='new'){s.getConfig.validation_config.token_2022.allow_token_metadata_instructions=true;s.getConfig.validation_config.allowed_transaction_versions=['legacy',0,1];}
    if(['policy-mismatch','rollback-propagation-lag'].includes(scenario)&&phase==='new')s.getConfig.validation_config.price.margin=99;
    if(scenario==='version-mismatch'&&phase==='new')s.getConfig.validation_config.allowed_transaction_versions=['legacy'];
    if(scenario==='readiness-timeout'&&phase==='new')throw Error('Fixture unavailable');
    if(scenario==='update-propagation-lag'&&phase==='new'&&clock<10000)return {ok:true,json:async()=>({jsonrpc:'2.0',result:structuredClone(initial[m]),id:1})};
    if(scenario==='rollback-propagation-lag'&&phase==='old'&&patches.length===2&&clock<15000){s.getConfig.validation_config.token_2022.allow_token_metadata_instructions=true;s.getConfig.validation_config.allowed_transaction_versions=['legacy',0,1];}
    return {ok:true,json:async()=>({jsonrpc:'2.0',result:s[m],id:1})};
  }
  let value,error;
  try{value=await updateBunny({app:'public-test-app',key:'public-fixture-token',lock,enableMetadata:true,fetchFn:mock,pause:async ms=>{clock+=ms;},now:()=>clock,timeout:15000,resolveImageTag:async digest=>{assert.equal(digest,old);resolutions++;return 'fixture-old';}});}catch(e){error=e.message;}
  if(scenario.startsWith('update')){
    assert.equal(value.status,'updated');assert.equal(value.metadata,true);assert.equal(patches.length,1);assert(patches[0].entryPoint.argumentsArray[0].includes('allow_token_metadata_instructions = true'));
  }else if(scenario.startsWith('no-op')){
    assert.equal(value.status,'current');assert.equal(patches.length,0);
  }else{
    assert.equal(error,'Rollout failed; previous image and public settings verified restored');assert.equal(patches.length,2);assert.equal(phase,'old');assert.equal(patches[1].imageDigest,old);assert.equal(patches[1].imageTag,'fixture-old');
    const original=JSON.parse(readFileSync(new URL('./bunny-previous-entrypoint.json',import.meta.url)));
    assert.deepEqual(patches[1].entryPoint,original);
  }
  assert.equal(cancelled,patches.length);assert.equal(resolutions,scenario.startsWith('no-op')?0:1);
  results.push({scenario,pass:true,patchCount:patches.length,patchBodiesCancelled:cancelled,platformReads:reads,publicCalls});
}
console.log(JSON.stringify(results));
