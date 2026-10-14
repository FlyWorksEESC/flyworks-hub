# FlyWorks Hub

Interface da FlyWorks e backend local de ensaio. Cargos oficiais: Diretor Presidente, Diretor Administrativo, Diretor Jurídico-Financeiro, Diretor de Projetos e Diretor Comercial. Candidaturas continuam fictícias, claramente sinalizadas.

**Voto real bloqueado. A revisão técnica por outro agente encontrou impedimentos críticos de sigilo. Consulte REVISAO-SIGILO.md. Não remover o bloqueio de ensaio.**

## GitHub Pages

Publique a branch main, pasta /docs, em Settings → Pages → Deploy from a branch. A pasta docs tem apenas interface, fontes licenciadas e logos originais. Não contém credenciais, banco, membros, chaves ou API.

GitHub Pages não executa o backend Node/SQLite. A interface publicada indica que login institucional e envio dependem de um backend online. Nenhum voto é recebido por esta publicação. A demonstração visual pode ser explorada sem login.

## Backend de ensaio local

Node 24+, pnpm install --frozen-lockfile, copiar .env.example para .env e configurar credenciais privadas. pnpm start. O login Google usa redirecionamento oficial com PKCE, validação de token e lista privada de membros. Credenciais e .private nunca devem ser enviados ao GitHub.

A criação da planilha usa backend/google-setup.mjs após configuração Google e consentimento do proprietário. Pare o servidor durante o setup, pois o retorno local usa a porta 4174. O usuário que autoriza precisa ser a conta institucional configurada pelo projeto. Dados eleitorais reais não devem ser coletados nesta versão.

A apuração de ensaio é offline com chave de custódia, somente após encerrar o ensaio, pelo utilitário backend/export-election.mjs. Google Sheets recebe somente eleição, cargo e opção. A ausência de nomes na planilha não resolve os impedimentos da revisão.

## Validação

pnpm test executa os testes de identidade, sessão, PKCE/CSRF, participação única, transações e exportação. node auditoria/prova-sigilo.mjs reproduz duas vulnerabilidades em memória, exclusivamente com identidades fictícias. Esta prova não acessa dados reais.

A revisão técnica não é certificação externa. Antes de eleição real, usar plataforma eleitoral especializada ou protocolo eleitoral verificado por especialistas e auditoria externa, além de definir cargos/candidaturas/edital/eleitorado, custódia, operação e hospedagem com HTTPS e persistência.
