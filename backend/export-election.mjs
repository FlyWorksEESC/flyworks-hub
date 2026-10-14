import {readFileSync,writeFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {OAuth2Client} from 'google-auth-library';
import {Store,openBallot,validateBallot,digest} from './core.mjs';
import {ROOT} from './server.mjs';
import {exportClosedElection} from '../server-integrations/sheets-export.mjs';
const read=file=>JSON.parse(readFileSync(resolve(ROOT,file),'utf8'));
const election=read('backend/election.json');
if(election.mode!=='rehearsal'||election.status!=='closed')throw new Error('Encerre o ensaio antes de exportar. Eleição real bloqueada.');
if(!process.env.BALLOT_PRIVATE_KEY_FILE)throw new Error('Forneça a chave privada de custódia offline no ambiente da apuração.');
const lock=resolve(ROOT,'.private/export.lock');let fd;
try{fd=openSync(lock,'wx',0o600)}catch{throw new Error('Outra exportação pode estar em andamento. Reconciliar antes de remover trava.');}
let store;
try{
 store=new Store(resolve(ROOT,'.private/hub.sqlite'));
 const rows=store.db.prepare('SELECT envelope FROM ballots WHERE election=?').all(election.id);
 const participants=store.db.prepare('SELECT COUNT(*) AS n FROM participation WHERE election=?').get(election.id).n;
 if(rows.length!==participants)throw new Error('Contagem de cédulas e participações diverge.');
 const key=readFileSync(process.env.BALLOT_PRIVATE_KEY_FILE,'utf8');
 const choices=rows.flatMap(r=>{const ballot=openBallot(r.envelope,key);if(ballot.electionId!==election.id)throw new Error('Cédula de eleição diferente.');return validateBallot(election,ballot.choices)});
 const target=read(process.env.GOOGLE_SHEET_FILE||'.private/google-sheet.json');
 if(target.owner!=='flyjr.ea@gmail.com')throw new Error('Destino não pertence à conta Fly configurada.');
 const credentials=read(process.env.GOOGLE_TOKEN_FILE||'.private/google-token.json');
 const auth=new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET);auth.setCredentials(credentials);
 const token=(await auth.getAccessToken()).token;
 const result=await exportClosedElection({spreadsheetId:target.spreadsheetId,sheetName:target.sheetName,accessToken:token,batch:{electionId:election.id,choices},allowedOptions:new Map(election.positions.map(p=>[p.id,new Set(p.options)]))});
 const canonical=choices.map(c=>`${c.positionId}:${c.optionId}`).sort().join('\n');
 const report={...result,electionId:election.id,ballots:rows.length,participations:participants,choicesDigest:digest(canonical)};
 writeFileSync(resolve(ROOT,'.private/export-report.json'),JSON.stringify(report,null,2),{mode:0o600});console.log('Exportação conferida:',JSON.stringify(report));
}catch(error){console.error(error?.message?.startsWith('Cargo')?error.message:'Exportação não concluída. Verifique configuração e reconcilie a aba antes de repetir.');process.exitCode=1}
finally{store?.close();closeSync(fd);unlinkSync(lock)}
