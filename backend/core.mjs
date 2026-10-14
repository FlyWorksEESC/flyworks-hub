import {createHash,createHmac,randomBytes,randomUUID,publicEncrypt,privateDecrypt,createCipheriv,createDecipheriv,constants} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
export class HubError extends Error { constructor(status,message){super(message);this.status=status;} }
export const digest = value => createHash('sha256').update(value).digest('hex');
export function validateIdentity(payload,clientId,nonce){
  if(!payload||payload.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||!Number.isFinite(payload.exp)||payload.exp<=Date.now()/1000||typeof payload.sub!=='string'||!payload.sub||payload.nonce!==nonce||payload.email_verified!==true)throw new HubError(401,'Identidade Google inválida.');
  if(payload.hd!=='usp.br'||typeof payload.email!=='string'||!payload.email.toLowerCase().endsWith('@usp.br'))throw new HubError(403,'Entre com uma conta Google institucional USP.');
  return {sub:payload.sub,email:payload.email.toLowerCase()};
}
export function memberFor(identity,members){
  const member=members.find(m=>m.email?.toLowerCase()===identity.email);
  if(!member||(member.sub&&member.sub!==identity.sub)||!['member','commission','admin'].includes(member.role))throw new HubError(403,'Conta não consta na lista de membros autorizados.');
  return {email:identity.email,sub:identity.sub,role:member.role,eligible:member.eligible===true};
}
export function validateBallot(election,choices){
  if(!Array.isArray(choices)||choices.length!==election.positions.length)throw new HubError(400,'Selecione uma opção para cada cargo.');
  const seen=new Set();
  for(const choice of choices){
    if(!choice||Object.keys(choice).sort().join(',')!=='optionId,positionId')throw new HubError(400,'Campos de cédula inválidos.');
    const position=election.positions.find(p=>p.id===choice.positionId);
    if(!position||seen.has(choice.positionId)||!position.options.includes(choice.optionId))throw new HubError(400,'Cargo repetido ou opção inválida.');
    seen.add(choice.positionId);
  }
  return choices.map(c=>({positionId:c.positionId,optionId:c.optionId}));
}
export function sealBallot(value,publicKey){
  const key=randomBytes(32), iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
  return JSON.stringify({v:1,key:publicEncrypt({key:publicKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
}
export function openBallot(envelope,privateKey){
  const b=JSON.parse(envelope);if(b.v!==1)throw new Error('Cédula inválida.');
  const key=privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(b.key,'base64'));
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(b.iv,'base64'));decipher.setAuthTag(Buffer.from(b.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(b.data,'base64')),decipher.final()]).toString());
}
export class Store {
 constructor(path){
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS oauth_challenges (token_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_json TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS challenges (token_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS participation (election TEXT NOT NULL, voter_hash TEXT NOT NULL, PRIMARY KEY(election,voter_hash));
  CREATE TABLE IF NOT EXISTS ballots (id TEXT PRIMARY KEY, election TEXT NOT NULL, envelope TEXT NOT NULL);`);
 }
 cleanup(){const now=Date.now();this.db.prepare('DELETE FROM oauth_challenges WHERE expires < ?').run(now);this.db.prepare('DELETE FROM challenges WHERE expires < ?').run(now);this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(now)}
 challenge(){this.cleanup();const token=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO challenges VALUES(?,?,?,?)').run(digest(token),nonce,csrf,Date.now()+600000);return {token,nonce,csrf}}
 consumeChallenge(token,csrf){const c=this.db.prepare('SELECT * FROM challenges WHERE token_hash=? AND expires>?').get(digest(token||''),Date.now());if(!c||c.csrf!==csrf)throw new HubError(403,'Acesso expirado. Recarregue a página.');this.db.prepare('DELETE FROM challenges WHERE token_hash=?').run(c.token_hash);return c}
 oauthChallenge(nonce,verifier){this.cleanup();const token=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO oauth_challenges VALUES(?,?,?,?)').run(digest(token),nonce,verifier,Date.now()+600000);return token}
 consumeOAuth(token){const c=this.db.prepare('SELECT * FROM oauth_challenges WHERE token_hash=? AND expires>?').get(digest(token||''),Date.now());if(!c)throw new HubError(403,'Autorização expirada. Tente entrar novamente.');this.db.prepare('DELETE FROM oauth_challenges WHERE token_hash=?').run(c.token_hash);return c}
 createSession(user){const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),JSON.stringify(user),csrf,Date.now()+3600000);return {token,csrf}}
 session(token){const row=this.db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(digest(token||''),Date.now());return row?{...JSON.parse(row.user_json),csrf:row.csrf}:null}
 logout(token){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token||''))}
 voterKey(election,sub,secret){return createHmac('sha256',secret).update(JSON.stringify([election,sub])).digest('hex')}
 hasVoted(election,sub,secret){return !!this.db.prepare('SELECT 1 FROM participation WHERE election=? AND voter_hash=?').get(election,this.voterKey(election,sub,secret))}
 cast({election,user,choices,publicKey,secret}){
  // Real election intentionally cannot be enabled by changing a flag: independent review still required.
  if(election.mode!=='rehearsal')throw new HubError(423,'Eleição real exige homologação independente.');
  if(election.status!=='open')throw new HubError(423,'Ensaio encerrado ou ainda não aberto.');
  if(!user.eligible)throw new HubError(403,'Membro não habilitado nesta eleição.');
  if(!secret||secret.length<32||!publicKey)throw new HubError(503,'Configuração eleitoral incompleta.');
  const clean=validateBallot(election,choices);
  const envelope=sealBallot({electionId:election.id,choices:clean},publicKey);
  this.db.exec('BEGIN IMMEDIATE');
  try{
   if(this.hasVoted(election.id,user.sub,secret))throw new HubError(409,'Participação já registrada.');
   this.db.prepare('INSERT INTO participation VALUES(?,?)').run(election.id,this.voterKey(election.id,user.sub,secret));
   this.db.prepare('INSERT INTO ballots VALUES(?,?,?)').run(randomUUID(),election.id,envelope);
   this.db.exec('COMMIT');return {accepted:true,mode:'rehearsal'};
  }catch(error){this.db.exec('ROLLBACK');throw error}
 }
 close(){this.db.close()}
}
