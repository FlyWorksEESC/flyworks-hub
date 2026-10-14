(() => {
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  const panel = document.createElement('aside');
  panel.style.cssText='position:fixed;bottom:18px;right:18px;z-index:50;max-width:min(350px,90vw);padding:12px 16px;background:#322E76;color:#F8FBEF;border-radius:14px;font:14px "Lexend Deca",sans-serif;box-shadow:0 4px 24px #0003;display:none';
  const install = document.createElement('button');
  install.textContent='Instalar FlyWorks Hub';
  install.style.cssText='font:inherit;color:inherit;background:transparent;border:1px solid #42A0ED;border-radius:8px;padding:8px;cursor:pointer';
  const close = document.createElement('button');
  close.textContent='×';close.setAttribute('aria-label','Fechar aviso de instalação');
  close.style.cssText='font:inherit;background:transparent;color:inherit;border:0;padding:10px;cursor:pointer';
  close.onclick=()=>{panel.style.display='none';};
  panel.append(install,close);document.body.append(panel);
  let prompt;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();prompt=event;panel.style.display='block';
  });
  install.onclick=async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;panel.style.display='none';}};
  window.addEventListener('appinstalled',()=>{panel.style.display='none';});
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches) {
    install.replaceWith(document.createTextNode('Para instalar: Compartilhar → Adicionar à Tela de Início.'));
    panel.style.display='block';
  }
})();
