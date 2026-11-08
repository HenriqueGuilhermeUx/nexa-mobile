# QA A — roteiro de captura física e matriz de aceite (16 casos)

Escopo exclusivo: ondas 01 (lembretes) e 02 (planejamento local). **Estado inicial: PENDENTE; nenhuma linha abaixo comprova teste.** Este roteiro não é aprovação, não executa ações financeiras e não autoriza OTA production.

## Identidade obrigatória antes de capturar

- Aplicativo QA A: `br.com.trynexa.app`; versionCode `148`; runtime `2.0.43`.
- SHA congelado: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`.
- Android EAS update: `01a1a975-d85f-794f-9d67-cf2ac961fbb7`; branch `maya-actions-v148-qa`.
- Registrar modelo, versão Android, data/hora com fuso e prova da identidade *instalada*, não somente do arquivo de build.
- Se o APK standalone `br.com.trynexa.mayaqa` for usado, registrar como teste standalone **separado**: não marcar como evidência da OTA QA A `br.com.trynexa.app`.

## Casos e evidências a coletar

| Caso | Passo observável no aparelho | Estado | Evidência |
| --- | --- | --- | --- |
| A01 | Abrir Maya e iniciar criação de lembrete | PENDENTE | — |
| A02 | Informar título e data futura válida; revisar antes de salvar | PENDENTE | — |
| A03 | Confirmar persistência do lembrete ao sair e voltar | PENDENTE | — |
| A04 | Verificar notificação após permissão explícita | PENDENTE | — |
| A05 | Cancelar lembrete e confirmar ausência de disparo posterior | PENDENTE | — |
| A06 | Concluir lembrete e verificar estado persistido | PENDENTE | — |
| P01 | Abrir planejamento a partir da Maya autenticada | PENDENTE | — |
| P02 | Criar meta com valor BRL válido e confirmar persistência | PENDENTE | — |
| P03 | Rejeitar valores inválidos, negativos e progresso fora do limite | PENDENTE | — |
| P04 | Atualizar progresso e reabrir tela sem perda de dados | PENDENTE | — |
| P05 | Alternar contas e verificar isolamento; sem tratar metas como saldo | PENDENTE | — |
| R01 | Login, logout e retorno ao app sem perda de sessão indevida | PENDENTE | — |
| R02 | Didit/KYC e navegação de ativação sem regressões | PENDENTE | — |
| R03 | Wallet, extrato e USDC somente leitura; sem movimentar fundos | PENDENTE | — |
| R04 | Pix, QR e transferência: navegação/visualização, sem confirmar operação | PENDENTE | — |
| R05 | Staff, Nexa PJ e retorno à Maya sem regressão | PENDENTE | — |

Os IDs são os 16 IDs exigidos por `scripts/validate-maya-qa-a-evidence.js`. O roteiro orienta captura; **não substitui** o validador, o inventário de arquivos nem a revisão humana. Para cada caso, anotar observação concreta, caminho de captura local independente, resultado PASS/FAIL e responsável. Não usar screenshots fictícios ou reutilizar o mesmo arquivo para vários casos.

## Portão de liberação

1. Identidade da instalação confirmada e compatível com o update QA A.
2. Todos os 16 casos executados em dispositivo físico com arquivos reais, verificáveis e revisão humana.
3. CI e export Android do SHA exato de release comprovados; verificar regressões de Wallet, Pix, USDC, Didit, login, Staff e Nexa PJ.
4. Revisar diferenças entre o SHA de QA A e qualquer novo candidato cumulativo; nunca promover HEAD da feature branch por equivalência presumida.
5. Sem todos os itens: **NO-GO**. Sem merge, sem EAS production, sem pagamentos, compras, reservas ou envios externos.

Checkpoint técnico anterior: `docs/maya-actions-qa-a-ci-checkpoint-20261108.md`; CI da onda 02 não equivale à homologação física do release.
