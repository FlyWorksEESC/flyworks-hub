import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,existsSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {OAuth2Client} from 'google-auth-library';
import {Store,HubError,validateIdentity,memberFor} from './core.mjs';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const loadJSON = path => JSON.parse(readFileSync(path,'utf8'));
export function createHub({env=process.env,store,verifyToken,exchangeCode}={}){
 const origin=env.APP_ORIGIN||'http://localhost:4173', url=new URL(origin);
 if(url.origin!==origin||!(url.protocol==='https:'||(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:')))throw new Error('APP_ORIGIN precisa de HTTPS ou localhost.');
 const secure=url.protocol==='https:';
 const privateDir=resolve(ROOT,'.private');mkdirSync(privateDir,{recursive:true,mode:0o700});
 store ||= new Store(resolve(privateDir,'hub.sqlite'));if(existsSync(resolve(privateDir,'hub.sqlite')))chmodSync(resolve(privateDir,'hub.sqlite'),0o600);
 const redirect=env.GOOGLE_LOGIN_REDIRECT_URI||new URL('/oauth/callback',origin).href;
 const callbackURL=new URL(redirect);
 if(!(callbackURL.origin===origin||(!secure&&callbackURL.hostname===url.hostname&&callbackURL.protocol==='http:'))||callbackURL.pathname!=='/oauth/callback'||callbackURL.search||callbackURL.hash)throw new Error('Retorno Google inválido.');
 const google=new OAuth2Client(env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET,redirect);
 exchangeCode ||= async(code,verifier)=>{const {tokens}=await google.getToken({code,codeVerifier:verifier});return (await google.verifyIdToken({idToken:tokens.id_token,audience:env.GOOGLE_CLIENT_ID})).getPayload()};
 verifyToken ||= async credential => (await google.verifyIdToken({idToken:credential,audience:env.GOOGLE_CLIENT_ID})).getPayload();
 const members=()=>{try{return loadJSON(resolve(ROOT,env.MEMBERS_FILE||'.private/members.json'))}catch{return []}};
 const election=()=>loadJSON(resolve(ROOT,'backend/election.json'));
 const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
 const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).filter(x=>x.length===2));
 const limits=new Map();
 function rate(req){const now=Date.now();for(const [k,v] of limits)if(v.reset<now)limits.delete(k);const key=req.socket.remoteAddress;const v=limits.get(key)||{count:0,reset:now+60000};v.count++;limits.set(key,v);if(v.count>60)throw new HubError(429,'Muitas tentativas. Aguarde um minuto.');}
 function user(req){const s=store.session(cookies(req).hub_session);if(!s)throw new HubError(401,'Entre com sua conta USP.');return {...memberFor(s,members()),csrf:s.csrf}}
 const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))};
 async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new HubError(415,'Use JSON.');let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>16384)throw new HubError(413,'Requisição excede o limite.')}try{return JSON.parse(data)}catch{throw new HubError(400,'JSON inválido.')}}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy',secure?'strict-origin-when-cross-origin':'no-referrer-when-downgrade');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; img-src 'self' data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const requestedURL=new URL(req.url,origin),path=requestedURL.pathname;
   if(req.headers.host!==url.host&&!(path==='/oauth/callback'&&req.headers.host===callbackURL.host))throw new HubError(400,'Host não autorizado.');
   if(req.method==='GET'&&path==='/oauth/callback'){
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');rate(req);
    const token=cookies(req).hub_oidc,state=requestedURL.searchParams.get('state');
    if(!token||state!==token)throw new HubError(403,'Estado de autorização inválido. Reabra o Hub.');
    const challenge=store.consumeOAuth(token);
    try{
     const code=requestedURL.searchParams.get('code');if(!code)throw new Error('Consentimento não concluído.');
     const payload=await exchangeCode(code,challenge.verifier);
     const u=memberFor(validateIdentity(payload,env.GOOGLE_CLIENT_ID,challenge.nonce),members());
     const session=store.createSession(u);
     res.writeHead(303,{'Location':origin+'/#home','Set-Cookie':[cookie('hub_session',session.token,3600),cookie('hub_oidc','',0).replace('SameSite=Strict','SameSite=Lax')]});res.end();return;
    }catch{res.writeHead(303,{'Location':origin+'/?auth_error=access_denied','Set-Cookie':cookie('hub_oidc','',0).replace('SameSite=Strict','SameSite=Lax')});res.end();return}
   }
   if(path.startsWith('/api/')){
    res.setHeader('Cache-Control','no-store');
    if(req.method==='POST'&&req.headers.origin!==origin)throw new HubError(403,'Origem não autorizada.');
    if(req.method==='GET'&&path==='/api/config'){
     const ready=!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET;
     return send(res,200,{googleClientId:env.GOOGLE_CLIENT_ID||null,authMode:'redirect',ready,votingMode:'rehearsal',notice:ready?'Entre com sua conta Google USP.':'Aguardando configuração Google da Fly. Login e envio ainda indisponíveis.'});
    }
    if(req.method==='GET'&&path==='/api/auth/start'){
     rate(req);if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new HubError(503,'Login Google ainda não configurado.');
     const {codeVerifier,codeChallenge}=await google.generateCodeVerifierAsync();const nonce=randomBytes(32).toString('hex');
     const state=store.oauthChallenge(nonce,codeVerifier);
     const location=google.generateAuthUrl({scope:['openid','email'],access_type:'online',prompt:'select_account',hd:'usp.br',nonce,state,code_challenge:codeChallenge,code_challenge_method:'S256'});
     res.writeHead(303,{'Location':location,'Set-Cookie':cookie('hub_oidc',state,600).replace('SameSite=Strict','SameSite=Lax')});res.end();return;
    }
    if(req.method==='GET'&&path==='/api/auth/challenge'){
     rate(req);if(!env.GOOGLE_CLIENT_ID)throw new HubError(503,'Login Google ainda não configurado.');
     const c=store.challenge();return send(res,200,{nonce:c.nonce,csrf:c.csrf},{'Set-Cookie':cookie('hub_challenge',c.token,600)});
    }
    if(req.method==='POST'&&path==='/api/auth/google'){
     rate(req);if(!env.GOOGLE_CLIENT_ID)throw new HubError(503,'Login Google ainda não configurado.');
     const b=await body(req),c=store.consumeChallenge(cookies(req).hub_challenge,b.csrf);
     if(typeof b.credential!=='string'||b.credential.length>12000)throw new HubError(400,'Credencial inválida.');
     let payload;try{payload=await verifyToken(b.credential)}catch{throw new HubError(401,'Não foi possível validar a conta Google.');}
     const u=memberFor(validateIdentity(payload,env.GOOGLE_CLIENT_ID,c.nonce),members());
     const s=store.createSession(u);return send(res,200,{role:u.role,eligible:u.eligible,csrf:s.csrf},{'Set-Cookie':[cookie('hub_session',s.token,3600),cookie('hub_challenge','',0)]});
    }
    if(req.method==='GET'&&path==='/api/me'){
     const u=user(req),e=election();return send(res,200,{role:u.role,eligible:u.eligible,email:u.email,csrf:u.csrf,hasVoted:env.VOTER_HASH_SECRET?store.hasVoted(e.id,u.sub,env.VOTER_HASH_SECRET):false,election:{id:e.id,mode:e.mode,status:e.status}});
    }
    if(req.method==='POST'&&['/api/logout','/api/ballots'].includes(path)){
     rate(req);const u=user(req);if(req.headers['x-csrf-token']!==u.csrf)throw new HubError(403,'Sessão inválida. Recarregue a página.');
     if(path==='/api/logout'){store.logout(cookies(req).hub_session);return send(res,200,{ok:true},{'Set-Cookie':cookie('hub_session','',0)})}
     const b=await body(req);if(Object.keys(b).sort().join(',')!=='choices,electionId')throw new HubError(400,'Campos inválidos.');const e=election();if(e.id!==b.electionId)throw new HubError(409,'Eleição mudou. Recarregue.');
     let publicKey;try{publicKey=readFileSync(resolve(ROOT,env.BALLOT_PUBLIC_KEY_FILE||'.private/ballot-public.pem'),'utf8')}catch{throw new HubError(503,'Urna de ensaio ainda não configurada.');}
     return send(res,201,store.cast({election:e,user:u,choices:b.choices,publicKey,secret:env.VOTER_HASH_SECRET}));
    }
    throw new HubError(404,'Serviço não encontrado.');
   }
   if(req.method!=='GET'&&req.method!=='HEAD')throw new HubError(405,'Método não permitido.');
   // Explicit allowlist: never serve backend, configuration secrets, members or database.
   const staticPath=path==='/'?'index.html':path.slice(1);
   if(!['index.html','app.js','auth.js','styles.css','config.js'].includes(staticPath)&&!/^assets\/[A-Za-z0-9_.-]+$/.test(staticPath))throw new HubError(404,'Arquivo não encontrado.');
   let data;try{data=readFileSync(resolve(ROOT,staticPath))}catch{throw new HubError(404,'Arquivo não encontrado.')}
   const ext=staticPath.split('.').pop(),type={html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',ttf:'font/ttf',pdf:'application/pdf',txt:'text/plain'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){send(res,error instanceof HubError?error.status:500,{error:error instanceof HubError?error.message:'Falha interna. Tente novamente ou contate a comissão.'})}
 });
 let callbackServer=null;if(callbackURL.origin!==origin)callbackServer=http.createServer((req,res)=>{if(new URL(req.url,redirect).pathname!=='/oauth/callback'){res.writeHead(404);res.end();return}server.emit('request',req,res)});
 return {server,store,callbackServer,callbackPort:Number(callbackURL.port||443)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {server,callbackServer,callbackPort}=createHub();if(callbackServer)callbackServer.listen(callbackPort,'127.0.0.1');const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`FlyWorks Hub: ${process.env.APP_ORIGIN||'http://localhost:4173'} (eleição real bloqueada)`));}
