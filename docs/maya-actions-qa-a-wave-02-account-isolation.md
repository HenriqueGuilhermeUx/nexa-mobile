# Maya Actions — QA A: isolamento de contas e persistência (onda 02)

Status inicial: **NOT RUN / NO-GO**. Este roteiro não substitui teste em dispositivo Android v148, runtime 2.0.43. QA A congelado em `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`; este documento **não faz parte** desse bundle.

## Preparação segura
- Instalar um binário de teste compatível com a branch EAS `maya-actions-v148-qa` e verificar o update ID efetivamente recebido no dispositivo (não assumir que production recebeu QA).
- Usar contas fictícias A e B, sem fundos ou dados pessoais reais. Registrar versão do Android, build, runtime, canal, update ID, data e evidência sanitizada.
- Não limpar dados/cache entre as etapas: isso esconderia falhas de persistência e isolamento.

## Casos reproduzíveis
| ID | Passos | Resultado esperado | Estado |
| --- | --- | --- | --- |
| P04-A | Entrar na conta A, criar meta `QA-A-ISOLAMENTO` de R$ 100,00 e registrar R$ 25,00 de progresso | Meta A mostra 25%; nenhum saldo Wallet alterado | NOT RUN |
| P04-B | Sair da conta A e entrar na conta B no mesmo aparelho | Meta da conta A não aparece na conta B | NOT RUN |
| P04-C | Criar na conta B meta `QA-B-ISOLAMENTO` de R$ 200,00 | B mostra apenas sua própria meta | NOT RUN |
| P04-D | Sair de B, entrar novamente em A e reabrir a tela | A mantém a meta de R$ 100,00 e 25%; B não aparece | NOT RUN |
| P03-A | Fechar e reabrir o aplicativo sem limpar armazenamento, mantendo A | Meta e progresso persistem corretamente | NOT RUN |
| P05-A | Tentar registrar valores negativos, zero indevido, texto não numérico e progresso superior ao limite previsto pela UI | Validação explícita, sem corrupção de dados nem impacto em saldo real | NOT RUN |
| R01-A | Repetir logout/login com rede indisponível e depois restabelecida | Sem vazamento entre contas; fluxo de autenticação permanece seguro | NOT RUN |

## Gate de aprovação
Cada caso exige `PASS`, `FAIL` ou `BLOCKED`, com passos observados e evidência sanitizada; `NOT RUN` nunca conta como aprovação. Qualquer vazamento de dados entre contas, alteração de saldo real ou regressão de login é bloqueador imediato. Conferir também o protocolo completo `docs/maya-actions-qa-a-device-protocol.md` e o modelo `docs/maya-actions-qa-a-evidence-template.md` da onda 01.

Sem CI verde no SHA candidato, confirmação do update no dispositivo e regressão de Wallet, Pix, USDC, Didit e Staff, decisão permanece **NO-GO**. Não publicar OTA production nem executar operações externas.
