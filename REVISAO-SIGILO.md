# Revisão técnica independente do autor — 14/10/2026

**Resultado: NÃO APTO para eleição real com voto secreto ou apuração verificável.**

Outro agente, que não participou da implementação, examinou o código somente em leitura. Não acessou credenciais, dados privados ou o banco real. O autor reproduziu dois achados em uma base descartável, exclusivamente com identidades e escolhas sintéticas. Essa separação melhora a revisão, mas não é certificação externa, auditoria institucional ou parecer assinado por especialista eleitoral.

## Achados

| Gravidade | Achado | Evidência e efeito |
|---|---|---|
| Crítica | Identidade e escolhas chegam juntas ao servidor | backend/server.mjs:81–85 chama Store.cast com usuário autenticado e escolhas; backend/core.mjs:62–68 cifra depois do recebimento. O operador pode capturar a associação antes da criptografia. |
| Crítica | Ordem no banco preserva a associação | backend/core.mjs:43–44 cria tabelas com rowid implícito; :67–68 grava participação e cédula na mesma sequência. O operador conhece os identificadores Google e pode recalcular o HMAC (:54). UUID aleatório não remove a ordem física/lógica. |
| Alta | Cédula pode ser substituída por outro envelope válido | Quem possui a chave pública pode produzir um envelope novo. backend/export-election.mjs:16–20 verifica contagens e opções, não prova que o envelope é aquele originalmente aceito. Substituição pode manter todas as contagens. |
| Alta | Apuração não tem evidência independente de inclusão/correção | Aceitação em backend/core.mjs:69 não traz prova de inclusão. O digest em backend/export-election.mjs:27–29 nasce depois da apuração e pode ser produzido para uma base manipulada. |
| Média | Conferência Sheets não garante imutabilidade | server-integrations/sheets-export.mjs:56–70 verifica um momento. Edição posterior por proprietário/editor pode alterar resultados. A configuração local do proprietário não é consulta das permissões atuais. |

## Demonstração reproduzida

Execute `node auditoria/prova-sigilo.mjs` (Node 24+). A prova usa SQLite em memória e chaves geradas somente para o teste; nunca abre .env, .private ou dados reais.

1. Três eleitores fictícios escolheram a, b e blank.
2. A ordem de participação foi relacionada à ordem das cédulas; os três pares eleitor–escolha foram recuperados corretamente.
3. A primeira cédula foi substituída por outro envelope válido produzido com a chave pública.
4. Descriptografia e validação de opções continuaram passando; participação e cédulas continuaram com a mesma quantidade.

Portanto, a ausência de e-mail nas células e a criptografia em repouso não demonstram voto secreto, integridade eleitoral ou apuração verificável. A prova não indica que houve manipulação do ensaio realizado; demonstra uma possibilidade estrutural contra o modelo de ameaça.

## Proteções presentes

O modo real é bloqueado no servidor. Há validação institucional Google, lista de membros, sessões/CSRF, participação única em transação, validação de escolhas, RSA-OAEP/AES-GCM e exportação sem identificadores explícitos. São úteis para ensaio e prevenção de erros, mas insuficientes para os requisitos eleitorais.

## Condições antes de operação real

Adotar plataforma eleitoral especializada ou protocolo analisado por especialista que separe autenticação e cédulas, trate correlação e conluio, produza evidências verificáveis de inclusão/mistura/apuração e defina custódia independente. Revisar implementação e operação externamente; ensaiar falhas, recuperação, logs, backups e governança. Não corrigir simplesmente removendo rowid, adicionando outra tabela ou embaralhando linhas ao final: o servidor ainda recebe eleitor e escolhas juntos.

A eleição real permanece bloqueada. Publicar a interface demonstrativa no GitHub Pages não homologa o backend nem remove estes impedimentos.
