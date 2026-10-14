import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {Store,sealBallot,openBallot,validateBallot} from '../backend/core.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const store=new Store(':memory:');
const election={id:'PROVA-SINTETICA',mode:'rehearsal',status:'open',positions:[{id:'cargo',options:['a','b','blank']}]};
const secret='segredo-exclusivo-desta-prova-sintetica';
const samples=[['ELEITOR-FICTICIO-1','a'],['ELEITOR-FICTICIO-2','b'],['ELEITOR-FICTICIO-3','blank']];
try{
 for(const [sub,optionId] of samples)store.cast({election,user:{sub,email:'ficticio@usp.br',eligible:true},choices:[{positionId:'cargo',optionId}],publicKey,secret});
 const rows=store.db.prepare('SELECT p.voter_hash,b.id,b.envelope FROM participation p JOIN ballots b ON p.rowid=b.rowid AND p.election=b.election ORDER BY p.rowid').all();
 const recovered=rows.map(r=>({eleitor:samples.find(([sub])=>store.voterKey(election.id,sub,secret)===r.voter_hash)[0],escolha:openBallot(r.envelope,privateKey).choices[0].optionId}));
 assert.deepEqual(recovered,samples.map(([eleitor,escolha])=>({eleitor,escolha})));
 const forged=sealBallot({electionId:election.id,choices:[{positionId:'cargo',optionId:'b'}]},publicKey);
 store.db.prepare('UPDATE ballots SET envelope=? WHERE id=?').run(forged,rows[0].id);
 const now=store.db.prepare('SELECT envelope FROM ballots WHERE id=?').get(rows[0].id);
 validateBallot(election,openBallot(now.envelope,privateKey).choices);
 assert.equal(openBallot(now.envelope,privateKey).choices[0].optionId,'b');
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM ballots').get().n,3);
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM participation').get().n,3);
 console.log(JSON.stringify({base:'temporaria em memoria; sem dados reais',correlacoesRecuperadas:recovered,cedulaSubstituidaSemFalharValidacao:true,contagensPermanecemIguais:true},null,2));
}finally{store.close()}
