import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHub} from './server.mjs';
import {Store} from './core.mjs';
test('HTTP: autenticação, CSRF, autorização, arquivos privados e sessão',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hub-http-'));const members=join(dir,'members.json');writeFileSync(members,JSON.stringify([{email:'ficticio@usp.br',role:'member',eligible:true}]));
 const env={GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-only-secret',MEMBERS_FILE:members,BALLOT_PUBLIC_KEY_FILE:join(dir,'not-configured.pem')};
 const probe=createHub({env:{...env,APP_ORIGIN:'http://localhost:4173'},store:new Store(':memory:')});
 // Reservar porta de teste; criação do servidor final valida Host/Origin contra essa porta.
 await new Promise(r=>probe.server.listen(0,'127.0.0.1',r));const port=probe.server.address().port;await new Promise(r=>probe.server.close(r));probe.store.close();
 const origin=`http://127.0.0.1:${port}`;let nonce,oidcNonce;
 const {server,store}=createHub({env:{...env,APP_ORIGIN:origin},store:new Store(':memory:'),exchangeCode:async(code,verifier)=>{assert.equal(code,'test-code');assert.ok(verifier.length>=40);return {aud:'test-client',iss:'https://accounts.google.com',exp:Date.now()/1000+300,sub:'synthetic',email:'ficticio@usp.br',email_verified:true,hd:'usp.br',nonce:oidcNonce}},verifyToken:async token=>{if(token!=='valid-test-token')throw new Error('invalid');return {aud:'test-client',iss:'https://accounts.google.com',exp:Date.now()/1000+300,sub:'synthetic',email:'ficticio@usp.br',email_verified:true,hd:'usp.br',nonce}}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 const request=(path,options={})=>fetch(origin+path,options);
 try{
  for(const path of ['/.env','/.private/hub.sqlite','/backend/election.json','/node_modules/google-auth-library/package.json'])assert.equal((await request(path)).status,404);
  assert.equal((await request('/api/me')).status,401);
  let r=await request('/api/auth/challenge');let challenge=await r.json();nonce=challenge.nonce;let cookie=r.headers.getSetCookie()[0].split(';')[0];
  const post={method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({csrf:challenge.csrf,credential:'valid-test-token'})};
  assert.equal((await request('/api/auth/google',{...post,headers:{...post.headers,Origin:'https://externo.example'}})).status,403);
  r=await request('/api/auth/google',post);assert.equal(r.status,200);const session=await r.json();cookie=r.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await request('/api/auth/google',post)).status,403);
  r=await request('/api/me',{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.equal((await r.json()).role,'member');
  assert.equal((await request('/api/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}})).status,403);
  assert.equal((await request('/api/ballots',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:JSON.stringify({choices:[],electionId:'ensaio-diretoria-2027'})})).status,503);
  assert.equal((await request('/api/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':session.csrf}})).status,200);
  assert.equal((await request('/api/me',{headers:{Cookie:cookie}})).status,401);
  r=await request('/api/auth/challenge');challenge=await r.json();cookie=r.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await request('/api/auth/google',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({csrf:challenge.csrf,credential:'forged-token'})})).status,401);

  r=await request('/api/auth/start',{redirect:'manual'});assert.equal(r.status,303);
  const provider=new URL(r.headers.get('location'));assert.equal(provider.hostname,'accounts.google.com');assert.equal(provider.searchParams.get('code_challenge_method'),'S256');
  assert.equal(provider.searchParams.get('scope'),'openid email');oidcNonce=provider.searchParams.get('nonce');const state=provider.searchParams.get('state');cookie=r.headers.getSetCookie()[0].split(';')[0];assert.match(r.headers.getSetCookie()[0],/SameSite=Lax/);
  const callback='/oauth/callback?state='+encodeURIComponent(state)+'&code=test-code';
  assert.equal((await request(callback,{redirect:'manual'})).status,403);
  r=await request(callback,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),origin+'/#home');const oidcSession=r.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await request('/api/me',{headers:{Cookie:oidcSession}})).status,200);
  assert.equal((await request(callback,{headers:{Cookie:cookie},redirect:'manual'})).status,403);
 }finally{await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true})}
});
