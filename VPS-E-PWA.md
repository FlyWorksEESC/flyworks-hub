# Publicação em VPS e aplicativo PWA

## Estado

PWA preparado para GitHub Pages e domínio próprio. VPS ainda não contratada. Eleição real permanece bloqueada pela revisão de sigilo. Os arquivos deploy são modelos, não prova de servidor configurado.

## Instalar o aplicativo

Abra https://flyworkseesc.github.io/flyworks-hub/ em navegador compatível. No Android/Chrome, use Instalar aplicativo no menu ou o botão de instalação quando disponível. No iPhone/Safari, use Compartilhar → Adicionar à Tela de Início. No computador, use a opção de instalação do navegador.

O aplicativo e o link acessam o mesmo serviço. O navegador decide quando oferecer instalação. É necessário confirmar a instalação no dispositivo. Não é uma publicação na App Store ou Play Store.

Sem conexão, aparece somente uma página informativa. Não há armazenamento offline de identidade, respostas da API, votos ou formulários; não há fila de envio. A demonstração não registra voto.

## Servidor a contratar

Definir orçamento, provedor/região, domínio e responsável pela conta. A contratação/pagamento é feita pelo proprietário. Não enviar senha ou chave privada no chat. Autorizar acesso pelo meio seguro do provedor após a criação.

## Implantação planejada (Linux com systemd)

1. Instalar Node 24, pnpm e Caddy pelas fontes oficiais do fornecedor. Criar usuário de serviço flyworks sem login e diretório /opt/flyworks-hub com .private gravável apenas pelo usuário de serviço.
2. Copiar o código sanitizado, instalar dependências com pnpm install --frozen-lockfile. Não copiar banco, sessões, votos de ensaio ou chave privada do computador para o servidor.
3. Criar /etc/flyworks-hub.env protegido (root:flyworks, 0640), com APP_ORIGIN=https://DOMINIO, PORT=4173, GOOGLE_LOGIN_REDIRECT_URI=https://DOMINIO/oauth/callback e credenciais definidas privadamente. Configurar lista de membros privadamente. Sem configuração eleitoral, nenhum envio será aceito.
4. Definir DNS para o IP. Adaptar deploy/Caddyfile com HUB_DOMAIN no ambiente do serviço Caddy. Caddy encerra HTTPS e preserva Host; Node permanece em 127.0.0.1. Liberar apenas portas necessárias; não expor 4173.
5. Instalar deploy/flyworks-hub.service no systemd. Garantir Node em /usr/bin/node ou ajustar ExecStart. Ativar após revisar permissões. Configurar backups protegidos do SQLite usando backup consistente; testar restauração e retenção.
6. Atualizar o cliente OAuth Google com origem HTTPS e retorno exato /oauth/callback; configurar consentimento e autorização da conta Fly. O fluxo de criação da planilha existente continua local; não publicar o utilitário de setup como rota.
7. Testar HTTPS, login/logout USP, domínio permitido, lista de aptos, arquivos privados inacessíveis, reinício, instalação Android/iOS e falha de rede. Autenticação e integração Google não são habilitadas só pela cópia dos arquivos.

O limite atual de requisições considera o proxy local; revisar limitação por cliente no proxy antes da produção. O banco e dados do ensaio exigem persistência/backup. Trocar o domínio muda a identidade de instalação do PWA: instalar de novo pelo endereço definitivo.

## Sigilo

Consultar REVISAO-SIGILO.md. VPS, HTTPS, login e ausência de nomes na planilha não corrigem as falhas eleitorais. Usar plataforma especializada ou protocolo auditado antes de qualquer eleição real.
