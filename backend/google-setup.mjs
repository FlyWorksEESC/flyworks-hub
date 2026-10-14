// Autorização local da conta Fly. Não publica a aplicação e não solicita senha.
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {OAuth2Client} from 'google-auth-library';
import {ROOT} from './server.mjs';
import {resolve} from 'node:path';
const owner='flyjr.ea@gmail.com';
if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)throw new Error('Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.');
const redirect='http://localhost:4174/oauth/callback', state=randomBytes(32).toString('hex');
const client=new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,redirect);
const {codeVerifier,codeChallenge}=await client.generateCodeVerifierAsync();
const dir=resolve(ROOT,'.private');mkdirSync(dir,{recursive:true,mode:0o700});
if(existsSync(resolve(dir,'google-sheet.json')))throw new Error('Já existe destino configurado. Confira-o antes de criar outra planilha.');
const auth=client.generateAuthUrl({access_type:'offline',prompt:'consent',login_hint:owner,scope:['openid','email','https://www.googleapis.com/auth/drive.file'],state,code_challenge:codeChallenge,code_challenge_method:'S256'});
let handling=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,redirect);if(u.pathname!=='/oauth/callback'){res.writeHead(404);res.end();return}
 if(handling){res.writeHead(409);res.end('Autorização em processamento.');return}
 try{
  if(u.searchParams.get('state')!==state||!u.searchParams.get('code'))throw new Error('Autorização não concluída.');
  handling=true;
  const {tokens}=await client.getToken({code:u.searchParams.get('code'),codeVerifier});
  const identity=(await client.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID})).getPayload();
  if(identity.email!==owner||!identity.email_verified)throw new Error('Selecione a conta institucional da Fly.');
  if(!tokens.refresh_token)throw new Error('Não foi fornecida autorização persistente.');
  client.setCredentials(tokens);
  const result=await client.request({url:'https://sheets.googleapis.com/v4/spreadsheets',method:'POST',data:{properties:{title:'FlyWorks Hub — Ensaio eleitoral 2027'},sheets:[{properties:{title:'votos_ensaio',gridProperties:{rowCount:10000,columnCount:3}}}]}});
  // Save the ID immediately so an uncertain later response cannot create duplicate spreadsheets.
  const id=result.data.spreadsheetId;
  writeFileSync(resolve(dir,'google-sheet.json'),JSON.stringify({spreadsheetId:id,sheetName:'votos_ensaio',owner,url:result.data.spreadsheetUrl},null,2),{mode:0o600});
  writeFileSync(resolve(dir,'google-token.json'),JSON.stringify({refresh_token:tokens.refresh_token}),{mode:0o600});
  await client.request({url:`https://sheets.googleapis.com/v4/spreadsheets/${id}`,params:{fields:'spreadsheetId,properties.title,sheets.properties.title'}});
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('Conta Fly autorizada e planilha de ensaio criada e verificada. Pode fechar esta aba.');
  console.log('Planilha criada e conferida:',result.data.spreadsheetUrl);
 }catch{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Configuração não concluída. Confira conta Fly, consentimento e configuração Google. Não repita sem verificar se a planilha já foi criada.');console.error('Configuração não concluída; nenhum token foi exibido.');}
 finally{server.close()}
});
server.listen(4174,'127.0.0.1',()=>console.log('Abra o endereço abaixo e autorize usando a conta Fly:\n'+auth));
setTimeout(()=>server.close(),10*60*1000).unref();
