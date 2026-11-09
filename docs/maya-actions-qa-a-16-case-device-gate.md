# Maya Actions v148 — QA A: matriz de homologação física (bloqueante)

Referência: `docs/maya-actions-12-branches-execution.md` na branch `integration/maya-actions-v148`.
Candidato A congelado: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`; Android runtime `2.0.43`.
Esta matriz é **roteiro**, não evidência de execução. O retorno "Maya testada e OK" de 06/11/2026 no APK `br.com.trynexa.mayaqa` não aprova os casos abaixo.

## Procedimento
- Executar apenas em dispositivo QA, com conta e dados de teste, sem Pix, swaps, compras ou pagamentos reais.
- Registrar por caso: aparelho/Android, build e canal EAS, SHA/update ID, data, resultado PASS/FAIL/BLOCKED, evidência redigida e issue para falha.
- Nunca testar o canal production como se fosse QA; preservar `br.com.trynexa.app`, a OTA Android v148 e dados existentes.
- Não promover OTA production enquanto houver caso sem evidência, falha, incompatibilidade de runtime ou CI pendente.

## 16 casos obrigatórios — todos PENDENTES de evidência individual

| ID | Área | Verificação objetiva | Estado |
|---|---|---|---|
| A01 | Instalação | APK QA separado instala sem substituir o app Play | PENDENTE |
| A02 | Runtime | Identificar binário 148, runtime 2.0.43 e canal/update QA esperado | PENDENTE |
| A03 | Login | Entrar, sair e reentrar na conta QA sem regressão | PENDENTE |
| A04 | Sessão | Reiniciar o app e confirmar persistência/autorização esperada | PENDENTE |
| A05 | Maya | Abrir a conversa e navegar até lembretes e planejamento | PENDENTE |
| A06 | Notificações | Negar permissão e verificar comportamento sem travamento | PENDENTE |
| A07 | Notificações | Conceder permissão e confirmar lembrete futuro local | PENDENTE |
| A08 | Lembrete | Editar/cancelar e confirmar que notificação cancelada não dispara | PENDENTE |
| A09 | Lembrete | Concluir tarefa e confirmar estado após reinício | PENDENTE |
| A10 | Planejamento | Criar meta/orçamento BRL válido e confirmar persistência | PENDENTE |
| A11 | Planejamento | Rejeitar valor inválido; progresso não é saldo bancário | PENDENTE |
| A12 | Wallet | Abrir carteira/extrato sem executar movimentação | PENDENTE |
| A13 | Pix | Abrir rotas Pix/QR e voltar sem gerar transação | PENDENTE |
| A14 | USDC | Consultar telas de cripto sem swap ou envio | PENDENTE |
| A15 | Didit | Navegar fluxo KYC sem reenviar dados reais | PENDENTE |
| A16 | Staff/PJ | Verificar navegação e isolamento de rotas/perfis existentes | PENDENTE |

## Critério de saída
Somente considerar QA A homologado com 16 evidências individuais PASS, CI do SHA candidato aprovado, runtime/canal confirmados no dispositivo e nenhuma regressão crítica. Qualquer FAIL/BLOCKED mantém **NO-GO**. Esta documentação não autoriza merge, publicação OTA, operação financeira ou envio externo.
