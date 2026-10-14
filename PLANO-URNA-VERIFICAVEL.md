# Urna especializada — proposta para ensaio

Estado: integração autorizada pelo usuário; nenhuma eleição externa criada ou aberta. Nova revisão da urna local: NÃO LIBERAR. A escolha abaixo é uma proposta técnica sujeita ao ensaio e à conferência das regras pela comissão.

## Plataforma candidata: Belenios

Usar uma urna externa ligada ao Hub por endereço público fixo, sem parâmetros de identidade ou sessão. A autenticação da urna é própria. A FAQ documenta suporte a Google/OpenID Connect; verificar sua disponibilidade na instância usada e correspondência exata com a lista USP. Login no Hub não substitui a elegibilidade na urna.

## Perfil proposto

- Cinco perguntas: Diretor Presidente; Diretor Administrativo; Diretor Jurídico-Financeiro; Diretor de Projetos; Diretor Comercial.
- Uma escolha por cargo, candidaturas oficiais ainda pendentes. Não importar Pessoa exemplo A/B como candidaturas reais. Branco e mínimo/máximo de escolhas dependem do edital.
- Autoridade externa de credenciais, separada do administrador da urna. Não escolher geração de credenciais pelo servidor apenas por conveniência.
- Proposta de três custodiante(s) independentes, com limiar 2 de 3 se suportado pela configuração escolhida. Cada responsável gera e protege sua chave em seu dispositivo; nenhuma chave deve ser enviada ao chat, ao Hub ou ao repositório.
- Auditor independente verifica configuração, credenciais públicas, evolução da urna, provas e apuração. Custodiantes e autoridade de credenciais não bastam se não houver verificação independente.
- A configuração exata e as hipóteses de conluio precisam de revisão: nem Belenios nem criptografia eliminam todos os riscos do dispositivo do eleitor ou coerção.

## Divergência a resolver no edital

Belenios admite novo envio até o encerramento e contabiliza apenas a última cédula válida. Isso não multiplica votos, mas difere da regra original de bloquear todo segundo envio. Confirmar compatibilidade antes de escolher definitivamente a plataforma. Não prometer que o comportamento pode ser desabilitado sem verificar.

## Ensaio obrigatório

Criar uma eleição separada e explicitamente intitulada ENSAIO, somente após confirmar participantes de teste e autorização de envio de credenciais. Não abrir a eleição oficial nem enviar e-mails automaticamente neste estágio.

Verificar: conta não elegível recusada; acesso Google USP ou método aprovado; rastreador de inclusão conferível; comportamento de revoto; provas válidas e inválidas; exclusão/inserção/alteração de cédulas detectadas; participação dos custodiante(s), perda de um custodiante conforme limiar; restauração; apuração recalculada pelo auditor. Conferir todos os cargos em Android/iOS e computador.

## Planilha

Proposta: receber somente totais por cargo/opção após verificação da apuração, com identificação da eleição e referência pública das provas. Não exportar escolhas individuais, rastreadores individuais ou lista de participação para a mesma planilha. A planilha é uma cópia de divulgação, nunca a urna ou prova primária. Ajustar exportador somente depois de definir formato real da plataforma.

## Pendências do usuário/comissão

Eleitorado e quantidade; candidaturas por cargo; edital e revoto; período e fuso; quórum e empates; autoridade de credenciais; três custodiante(s); auditor independente; confirmação de instância, seus termos e disponibilidade. A hospedagem do Hub também segue pendente e não é pré-requisito para ensaiar uma urna externa.

## Fontes oficiais verificadas em 14/10/2026

- https://www.belenios.org/setup.html — cifra, credenciais e custódia.
- https://www.belenios.org/faq.html — revoto, Google, limiar e limites de segurança.
- https://www.belenios.org/instructions.html — verificações independentes.

Esta proposta não é homologação da plataforma, da eleição ou da configuração.
