# Maya Actions — protocolo de QA em dispositivo (ondas 01 e 02)

Escopo: Android br.com.trynexa.app, versionCode 148, runtime 2.0.43. Documento de teste; **nao** comprova execucao. Nao publicar production a partir desta branch.

## Preparacao e evidencias
- Registrar modelo Android, versao do SO, versao do app, canal/branch EAS, update ID, SHA e data/hora local.
- Confirmar que o dispositivo recebe a branch QA pretendida; aplicativo do canal production nao recebe automaticamente a OTA QA.
- Usar conta de teste sem fundos; nao executar Pix, trade, saque, compra, reserva ou formulario externo.
- Para cada caso anotar PASS/FAIL/BLOCKED, captura sem dados sensiveis, horario e resultado observado. Nenhum caso deve ser marcado PASS apenas por CI verde.

## Matriz unica de casos A01–A16 (alinhada ao registro e validador)
Os identificadores abaixo sao os mesmos de `docs/maya-actions-qa-a-evidence-record-v148.md` e `scripts/maya-qa-a-evidence-check.cjs`. Nao usar codigos P01–P05 ou R01–R05 na coleta: o validador aceita apenas A01–A16.

| Caso | Acao em dispositivo | Resultado esperado | Estado |
| --- | --- | --- | --- |
| A01 | Criar lembrete futuro | Titulo e horario corretos | NOT RUN |
| A02 | Informar horario passado | Bloqueio sem agendamento | NOT RUN |
| A03 | Conceder permissao e aguardar disparo | Notificacao efetivamente recebida | NOT RUN |
| A04 | Negar permissao | Aviso sem travamento | NOT RUN |
| A05 | Cancelar antes do disparo | Nenhuma notificacao posterior | NOT RUN |
| A06 | Concluir lembrete | Nenhuma notificacao duplicada | NOT RUN |
| A07 | Reiniciar app | Lembretes persistem | NOT RUN |
| A08 | Criar meta em BRL | Progresso correto, nao confundido com saldo | NOT RUN |
| A09 | Testar valores vazios, negativos e invalidos | Dados recusados | NOT RUN |
| A10 | Reiniciar e alternar duas contas de teste | Persistencia e isolamento por conta | NOT RUN |
| A11 | Fechar/reabrir sessao | Login preservado conforme regras do app | NOT RUN |
| A12 | Abrir Wallet e extrato | Apenas leitura, sem alteracoes | NOT RUN |
| A13 | Navegar Pix/QR | Sem efetuar pagamento | NOT RUN |
| A14 | Abrir informacoes USDC | Sem trade ou transferencia | NOT RUN |
| A15 | Abrir Didit/KYC | Sem submeter dados nem mudar estado real | NOT RUN |
| A16 | Conferir Staff/PJ com perfis de teste | Fronteiras de acesso preservadas | NOT RUN |

Para A03/A05/A06, registrar horario previsto, horario observado e fuso; para A10, usar duas contas de teste autorizadas ou marcar BLOCKED. Uma captura do APK standalone nao substitui a prova da OTA QA A no app Play.

## Regressao e decisao
- Login persistente e logout; ativacao; Maya/Staff; Didit/KYC; Wallet, saldo, extrato, QR/Pix/USDC, transferencias **apenas navegacao e preflight, sem confirmar operacoes reais**.
- Registrar erros de runtime, comportamento offline e retorno do app apos segundo plano.
- **NO-GO** se houver regressao, notificacao duplicada, vazamento entre contas, incompatibilidade nativa/runtime ou ausencia de evidencia de aparelho.
- **GO para avaliar promocao** somente apos todos os casos criticos PASS, CI do SHA exato verde, update QA comprovado, rollback documentado e aprovacao explicita. GO nao publica OTA por si.

Referencias: docs/maya-actions-12-branches-execution.md; issues #126 e #128. OTA QA A conhecida: group 1cd78cdf-0535-4a79-b0dc-ff65ffe46178; Android update 01a1a975-d85f-794f-9d67-cf2ac961fbb7; SHA 096c9fd619a551f23ba8c7d9e3e72a7e01605a6e. QA em dispositivo nao comprovado.
