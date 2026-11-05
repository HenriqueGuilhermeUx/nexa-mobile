# Maya Actions — protocolo de QA em dispositivo (ondas 01 e 02)

Escopo: Android br.com.trynexa.app, versionCode 148, runtime 2.0.43. Documento de teste; **nao** comprova execucao. Nao publicar production a partir desta branch.

## Preparacao e evidencias
- Registrar modelo Android, versao do SO, versao do app, canal/branch EAS, update ID, SHA e data/hora local.
- Confirmar que o dispositivo recebe a branch QA pretendida; aplicativo do canal production nao recebe automaticamente a OTA QA.
- Usar conta de teste sem fundos; nao executar Pix, trade, saque, compra, reserva ou formulario externo.
- Para cada caso anotar PASS/FAIL/BLOCKED, captura sem dados sensiveis, horario e resultado observado. Nenhum caso deve ser marcado PASS apenas por CI verde.

## Onda 01 — lembretes
| Caso | Acao | Resultado esperado | Estado |
| --- | --- | --- | --- |
| A01 | Negar permissao de notificacao e criar lembrete futuro | UI informa limite sem travar; tarefa permanece acessivel | NOT RUN |
| A02 | Conceder permissao e criar lembrete para horario futuro | Horario persistido e notificacao entregue no dispositivo | NOT RUN |
| A03 | Fechar e reabrir app apos criar lembrete | Lembrete persiste sem duplicacao | NOT RUN |
| A04 | Cancelar/excluir lembrete antes do disparo | Nao dispara notificacao cancelada | NOT RUN |
| A05 | Concluir e reabrir tarefa | Estado correto e nenhuma notificacao indevida | NOT RUN |
| A06 | Informar data/hora passada ou invalida | Bloqueio explicito; nenhum agendamento indevido | NOT RUN |

## Onda 02 — metas e planejamento
| Caso | Acao | Resultado esperado | Estado |
| --- | --- | --- | --- |
| P01 | Criar meta com valor BRL valido | Valor e progresso exibidos corretamente, sem tratar como saldo bancario | NOT RUN |
| P02 | Tentar valor vazio, negativo, NaN e formato invalido | Validacao impede dados invalidos | NOT RUN |
| P03 | Fechar/reabrir app e consultar meta | Persistencia local por conta sem perda | NOT RUN |
| P04 | Trocar de conta de teste e voltar | Metas de uma conta nao aparecem em outra | NOT RUN |
| P05 | Atualizar progresso e verificar limites | Calculo consistente; sem operacao financeira | NOT RUN |

## Regressao e decisao
- Login persistente e logout; ativacao; Maya/Staff; Didit/KYC; Wallet, saldo, extrato, QR/Pix/USDC, transferencias **apenas navegacao e preflight, sem confirmar operacoes reais**.
- Registrar erros de runtime, comportamento offline e retorno do app apos segundo plano.
- **NO-GO** se houver regressao, notificacao duplicada, vazamento entre contas, incompatibilidade nativa/runtime ou ausencia de evidencia de aparelho.
- **GO para avaliar promocao** somente apos todos os casos criticos PASS, CI do SHA exato verde, update QA comprovado, rollback documentado e aprovacao explicita. GO nao publica OTA por si.

Referencias: docs/maya-actions-12-branches-execution.md; issues #126 e #128. OTA QA A conhecida: group 1cd78cdf-0535-4a79-b0dc-ff65ffe46178; Android update 01a1a975-d85f-794f-9d67-cf2ac961fbb7; SHA 096c9fd619a551f23ba8c7d9e3e72a7e01605a6e. QA em dispositivo nao comprovado.
