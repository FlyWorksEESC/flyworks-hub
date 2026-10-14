# Reavaliação independente para liberação — 14/10/2026

## Decisão: NÃO LIBERAR

Nova revisão técnica por outro agente, somente em leitura, sem acesso a credenciais ou dados reais. Não constitui auditoria externa certificada. Foram examinados backend/core.mjs, backend/server.mjs, backend/export-election.mjs, auditoria/prova-sigilo.mjs e o relatório anterior. O módulo Sheets não foi reavaliado nesta rodada.

Os votos do ensaio já são cifrados com AES-256-GCM e chave AES protegida por RSA-OAEP/SHA-256. Não se adicionou criptografia própria nem se removeu o bloqueio: o problema remanescente é de protocolo e operação, não a ausência de cifra.

## Evidências confirmadas

1. server.mjs:81–85 recebe identidade e escolhas juntas; core.mjs:62–63 cifra depois. O operador pode capturar a associação antes da cifra.
2. core.mjs:43–44,54,67–68 conserva sequência correlacionável. A prova recuperou os três pares fictícios. Recuperar as escolhas dessa forma exige segredo HMAC e chave de apuração, não apenas leitura isolada do banco. O acesso ao servidor durante a votação também expõe escolhas em claro, independentemente da chave de apuração.
3. A prova substituiu uma cédula por envelope válido gerado com a chave pública. A validação e as quantidades permaneceram corretas. export-election.mjs:16–20 não demonstra a originalidade das cédulas aceitas.
4. core.mjs:69 não entrega prova independente de inclusão; o resumo de export-election.mjs:27–29 é calculado sobre a base já controlada pelo operador.
5. Os bloqueios de modo real em core.mjs:57–58 e export-election.mjs:9 permanecem necessários.

Reprodução: `node auditoria/prova-sigilo.mjs`, Node 24+. Usa somente SQLite em memória e identidades fictícias. Não há evidência de manipulação dos ensaios anteriores; o teste demonstra possibilidade estrutural.

## Critérios para uma nova candidatura à homologação

- Substituir a urna de ensaio por implementação de protocolo eleitoral especializado e previamente analisado. Cifrar no navegador isoladamente não resolve adulteração do cliente, correlação, conluio ou apuração.
- Separar elegibilidade e conteúdo, com modelo de ameaça explícito, custódia independente e limiar de participantes; configurar e congelar edital, eleitorado e candidaturas.
- Produzir provas verificáveis de inclusão e apuração, com verificadores independentes e procedimentos documentados.
- Testar inserção, exclusão, substituição, duplicação e concorrência; divergência entre exibição e cifra; provas inválidas; correlação por logs/ordem/backups; comprometimento de custodiante; interrupção e recuperação.
- Revisar a versão exata a publicar, além de hospedagem, backups, credenciais, operação e governança, por especialista externo independente. Só então decidir sobre liberação.

## Caminho de integração a avaliar

O Hub pode manter login Google USP e navegação. Uma urna especializada deve administrar sua própria elegibilidade, cifra, evidências e apuração; o login no Hub, sozinho, não autoriza um voto externo. Não enviar e-mail, token de sessão ou identificador de cédula por parâmetros de redirecionamento. Integração depende dos recursos e da configuração da plataforma escolhida; não foi implementada nem aprovada nesta rodada.

A documentação Belenios descreve autoridade externa de credenciais, custodiante(s) de apuração e auditor verificando provas e consistência. Isso é uma referência de requisitos, não aprovação automática de uma instalação: https://www.belenios.org/instructions.html e https://www.belenios.org/setup.html.

Preferir exportar resultados agregados já verificados para a planilha da Fly. A planilha não deve ser a urna nem a fonte única da apuração. A mudança de formato precisa ser acordada com a comissão.
