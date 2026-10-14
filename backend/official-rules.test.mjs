import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateOfficialResult} from './official-rules.mjs';
const config=JSON.parse(readFileSync(new URL('../eleicao-2027-oficial.json',import.meta.url)));
const sample=(n,yes)=>({closed:true,participants:n,positions:config.positions.map(p=>({id:p.id,candidateVotes:yes,blankVotes:n-yes}))});
test('todas as 595 combinações possíveis de participação e votos entre 0 e 33',()=>{
  let cases=0;
  for(let n=0;n<=33;n++)for(let yes=0;yes<=n;yes++){
    const result=evaluateOfficialResult(config,sample(n,yes));
    assert.equal(result.quorumMet,n>=2);
    const threshold=Math.ceil(n/2);
    for(const p of result.positions)assert.equal(p.outcome,n<2?'sem-quorum':yes>=threshold?'eleito':'nao-eleito');
    assert.equal(result.requiresIndependentCryptographicVerification,true);cases++;
  }
  assert.equal(cases,595);
});
test('1 candidato + 1 branco elege; maioria de brancos reprova; 33 exigem 17',()=>{
  assert.equal(evaluateOfficialResult(config,sample(2,1)).positions[0].outcome,'eleito');
  assert.equal(evaluateOfficialResult(config,sample(3,1)).positions[0].outcome,'nao-eleito');
  assert.equal(evaluateOfficialResult(config,sample(33,16)).positions[0].outcome,'nao-eleito');
  assert.equal(evaluateOfficialResult(config,sample(33,17)).positions[0].outcome,'eleito');
});
test('recusa urna aberta, totais inconsistentes, excesso, negativos e frações',()=>{
  const open=sample(2,1);open.closed=false;assert.throws(()=>evaluateOfficialResult(config,open));
  for(const n of [34,-1,2.5,NaN,Infinity])assert.throws(()=>evaluateOfficialResult(config,sample(n,1)));
  const wrong=sample(2,1);wrong.positions[0].blankVotes=2;assert.throws(()=>evaluateOfficialResult(config,wrong));
  const negative=sample(2,1);negative.positions[0].candidateVotes=-1;negative.positions[0].blankVotes=3;assert.throws(()=>evaluateOfficialResult(config,negative));
});
test('recusa cargos omitidos, repetidos, desconhecidos e campos de identidade',()=>{
  const cases=[sample(2,1),sample(2,1),sample(2,1),sample(2,1)];
  cases[0].positions.pop();cases[1].positions[1]=cases[1].positions[0];cases[2].positions[0].id='outro';cases[3].positions[0].email='ficticio@example.invalid';
  for(const c of cases)assert.throws(()=>evaluateOfficialResult(config,c));
});
test('interpreta cada cargo independentemente e não transforma totais em certificado',()=>{
  const data=sample(2,1);data.positions[1].candidateVotes=0;data.positions[1].blankVotes=2;
  const r=evaluateOfficialResult(config,data);assert.equal(r.positions[0].outcome,'eleito');assert.equal(r.positions[1].outcome,'nao-eleito');
  assert.equal(config.votingEnabled,false);
});
