import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRows, exportClosedElection } from './sheets-export.mjs';
const catalog = new Map([['cargo-1',new Set(['exemplo-a','blank'])]]);
const batch = {electionId:'ensaio-2027',choices:[{positionId:'cargo-1',optionId:'exemplo-a'}]};
test('apenas três campos eleitorais; recusa identidade, metadados e opções fora do catálogo',()=>{
  assert.deepEqual(prepareRows(batch,catalog),[['eleicao','cargo','opcao'],['ensaio-2027','cargo-1','exemplo-a']]);
  for (const key of ['email','memberId','timestamp','token']) {
    assert.throws(()=>prepareRows({...batch,choices:[{...batch.choices[0],[key]:'privado'}]},catalog));
  }
  assert.throws(()=>prepareRows({...batch,email:'privado'},catalog));
  assert.throws(()=>prepareRows({...batch,choices:[{positionId:'cargo-1',optionId:'nao-aprovado'}]},catalog));
  assert.throws(()=>prepareRows({...batch,electionId:'=IMPORTXML(...)'},catalog));
});
test('exporta com RAW e confirma leitura sem colocar token no corpo',async()=>{
  const calls=[];let stored;
  const request=async(url,options)=>{
    calls.push({url,options});
    if(options.method==='PUT')stored=JSON.parse(options.body).values;
    return {ok:true,json:async()=>({values:stored||[]})};
  };
  const result=await exportClosedElection({spreadsheetId:'planilha-exemplo',sheetName:'votos_ensaio',accessToken:'token-ficticio',batch,allowedOptions:catalog,request});
  assert.deepEqual(result,{verified:true,exportedChoices:1});
  assert.equal(calls.length,3);
  assert.match(calls[1].url,/valueInputOption=RAW/);
  assert.ok(!calls[1].options.body.includes('token-ficticio'));
});
test('não sobrescreve aba ocupada nem repete após falha de conferência',async()=>{
  let calls=0;
  const config={spreadsheetId:'planilha-exemplo',sheetName:'votos_ensaio',accessToken:'token-ficticio',batch,allowedOptions:catalog};
  await assert.rejects(exportClosedElection({...config,request:async()=>{calls++;return{ok:true,json:async()=>({values:[['existente']]})}}}),/não está vazia/);
  assert.equal(calls,1);
  calls=0;
  await assert.rejects(exportClosedElection({...config,request:async()=>{calls++;return {ok:true,json:async()=>({values:calls===1?[]:[['diferente']]})}}}),/diverge/);
  assert.equal(calls,3);
});
test('recusa escrita quando conferência inicial não autorizada',async()=>{
  let calls=0;
  await assert.rejects(exportClosedElection({spreadsheetId:'planilha-exemplo',sheetName:'votos_ensaio',accessToken:'token-ficticio',batch,allowedOptions:catalog,request:async()=>{calls++;return{ok:false,status:403}}}),/403/);
  assert.equal(calls,1);
});
