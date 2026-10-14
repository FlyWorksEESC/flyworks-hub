import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {Store,validateIdentity,memberFor,openBallot,sealBallot,validateBallot} from './core.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const election={id:'ensaio',mode:'rehearsal',status:'open',positions:[{id:'cargo',options:['a','b']}]};
const user={sub:'synthetic-id',email:'ficticio@usp.br',role:'member',eligible:true},secret='x'.repeat(64),choices=[{positionId:'cargo',optionId:'a'}];
test('domínio institucional, nonce, audiência, emissor, expiração e e-mail verificado obrigatórios',()=>{
 const good={aud:'client',iss:'https://accounts.google.com',exp:Date.now()/1000+600,sub:'123',nonce:'nonce',email:'ficticio@usp.br',email_verified:true,hd:'usp.br'};
 assert.equal(validateIdentity(good,'client','nonce').email,'ficticio@usp.br');
 for(const patch of [{exp:undefined},{hd:undefined},{hd:'outro.br'},{nonce:'wrong'},{aud:'wrong'},{iss:'https://malicioso.example'},{exp:0},{email_verified:false},{email:'externo@gmail.com'}])assert.throws(()=>validateIdentity({...good,...patch},'client','nonce'));
 assert.throws(()=>memberFor(user,[]));assert.throws(()=>memberFor(user,[{email:user.email,role:'admin',sub:'another-id'}]));
});
test('cédula cifrada abre com chave correta e rejeita adulteração',()=>{
 const envelope=sealBallot({electionId:'ensaio',choices},publicKey);assert.ok(!envelope.includes('cargo'));assert.deepEqual(openBallot(envelope,privateKey).choices,choices);
 const tampered=JSON.parse(envelope);const data=Buffer.from(tampered.data,'base64');data[0]^=1;tampered.data=data.toString('base64');assert.throws(()=>openBallot(JSON.stringify(tampered),privateKey));
});
test('validação rejeita cargos duplicados, escolhas extras e campos pessoais',()=>{
 assert.throws(()=>validateBallot(election,[...choices,...choices]));assert.throws(()=>validateBallot(election,[{...choices[0],email:user.email}]));assert.throws(()=>validateBallot(election,[{positionId:'cargo',optionId:'intruso'}]));
});
test('voto único persiste, sem identidade ou horários na tabela de cédulas',()=>{
 const s=new Store(':memory:');try{
  s.cast({election,user,choices,publicKey,secret});assert.throws(()=>s.cast({election,user,choices,publicKey,secret}),e=>e.status===409);
  const rows=s.db.prepare('SELECT * FROM ballots').all();assert.equal(rows.length,1);assert.ok(!JSON.stringify(rows).includes(user.email));assert.ok(!JSON.stringify(rows).includes(user.sub));
  assert.deepEqual(s.db.prepare('PRAGMA table_info(ballots)').all().map(c=>c.name),['id','election','envelope']);assert.equal(openBallot(rows[0].envelope,privateKey).choices[0].optionId,'a');
 }finally{s.close()}
});
test('recusa inaptos, eleição fechada e modo real',()=>{
 const s=new Store(':memory:');try{for(const config of [{user:{...user,eligible:false}},{election:{...election,status:'closed'}},{election:{...election,mode:'real'}}])assert.throws(()=>s.cast({election,user,choices,publicKey,secret,...config}));assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM ballots').get().n,0)}finally{s.close()}
});
test('falha de gravação desfaz também o controle de participação',()=>{
 const s=new Store(':memory:');try{s.db.exec("CREATE TRIGGER fail BEFORE INSERT ON ballots BEGIN SELECT RAISE(ABORT,'failed'); END;");assert.throws(()=>s.cast({election,user,choices,publicKey,secret}));assert.equal(s.hasVoted(election.id,user.sub,secret),false)}finally{s.close()}
});
test('sessão expira, logout revoga e desafio não pode ser reutilizado',()=>{
 const s=new Store(':memory:');try{const c=s.challenge();assert.throws(()=>s.consumeChallenge(c.token,'wrong'));s.consumeChallenge(c.token,c.csrf);assert.throws(()=>s.consumeChallenge(c.token,c.csrf));const session=s.createSession(user);assert.equal(s.session(session.token).sub,user.sub);s.logout(session.token);assert.equal(s.session(session.token),null);const expired=s.createSession(user);s.db.exec('UPDATE sessions SET expires=0');assert.equal(s.session(expired.token),null)}finally{s.close()}
});
test('quatro submissões simultâneas em processos de execução independentes: apenas uma aceita',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hub-concurrency-')),path=join(dir,'test.sqlite');const initial=new Store(path);initial.close();
 try{
  const statuses=await Promise.all(Array.from({length:4},()=>new Promise((resolve,reject)=>{const worker=new Worker(new URL('./cast-worker.mjs',import.meta.url),{workerData:{path,election,user,choices,publicKey,secret}});worker.once('message',resolve);worker.once('error',reject)})));
  assert.equal(statuses.filter(s=>s===201).length,1);assert.equal(statuses.filter(s=>s===409).length,3);
  const s=new Store(path);assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM ballots').get().n,1);s.close();
 }finally{rmSync(dir,{recursive:true,force:true})}
});
