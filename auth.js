/* Google Identity Services. Nunca recebe senha ou guarda ID token no navegador. */
window.HubIdentity = (() => {
 let config=null,me=null,loading=null;
 async function api(path,{method='GET',body,csrf}={}){
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível concluir a solicitação.');return result;
 }
 function notify(){window.dispatchEvent(new Event('hubidentityready'))}
 async function boot(){
  if(window.HUB_CONFIG.hostingMode==='github-pages'){config={ready:false,notice:'Interface demonstrativa no GitHub Pages. Login USP e votação precisam de backend online; eleição real bloqueada após revisão de sigilo.'};notify();return}
  if(location.protocol==='file:'){config={ready:false,notice:'Prévia local. Execute o servidor para configurar o acesso Google.'};notify();return}
  try{config=await api('/api/config');try{me=await api('/api/me')}catch{me=null}}catch{config={ready:false,notice:'Servidor de autenticação indisponível. A demonstração continua acessível.'}}
  notify();
 }
 async function mount(){
  const target=document.getElementById('google-signin'),note=document.getElementById('google-note');if(!target)return;
  note.textContent=config?.notice||'Verificando conexão com Google…';if(!config?.ready)return;
  if(new URLSearchParams(location.search).get('auth_error'))note.textContent='Acesso não concluído. Use a conta Google USP habilitada para o ensaio e autorize o login no Google.';
  if(config.authMode==='redirect'){target.replaceChildren();const link=document.createElement('a');link.href='/api/auth/start';link.className='btn primary';link.textContent='Entrar com Google USP';target.append(link);return}
  try{
   const challenge=await api('/api/auth/challenge');
   if(!window.google?.accounts?.id){
    loading ||= new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o acesso Google.'));document.head.append(s)});
    await loading;
   }
   if(!target.isConnected)return;
   google.accounts.id.initialize({client_id:config.googleClientId,nonce:challenge.nonce,hd:'usp.br',auto_select:false,callback:async response=>{
    note.textContent='Validando sua conta institucional…';
    try{await api('/api/auth/google',{method:'POST',body:{credential:response.credential,csrf:challenge.csrf}});me=await api('/api/me');window.dispatchEvent(new CustomEvent('hublogin',{detail:me}))}
    catch(error){note.textContent=error.message;const retry=document.createElement('button');retry.textContent='Tentar novamente';retry.onclick=()=>{retry.remove();mount()};note.after(retry)}
   }});
   google.accounts.id.renderButton(target,{type:'standard',theme:'outline',size:'large',text:'signin_with',locale:'pt-BR',width:300});
  }catch(error){note.textContent=error.message}
 }
 async function logout(){if(me)await api('/api/logout',{method:'POST',csrf:me.csrf});me=null;window.google?.accounts?.id?.disableAutoSelect()}
 async function cast(choices){if(!me)throw new Error('Entre com sua conta USP.');const result=await api('/api/ballots',{method:'POST',csrf:me.csrf,body:{electionId:me.election.id,choices}});me=await api('/api/me');return result}
 const out={boot,mount,logout,cast,api,get user(){return me},get config(){return config}};return out;
})();
