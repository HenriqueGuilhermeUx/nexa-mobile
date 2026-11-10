# Maya Actions QA A — registro reproduzivel de evidencias (v148)

Escopo: ondas 01 lembretes e 02 planejamento. Este arquivo e um modelo de execucao, nao uma declaracao de homologacao. Referencia: `docs/maya-actions-12-branches-execution.md` no branch cumulativo. O APK standalone `br.com.trynexa.mayaqa` nao comprova compatibilidade com a OTA do app Play `br.com.trynexa.app`.

## Identidade obrigatoria da sessao
- Data/hora e fuso: PENDENTE
- Responsavel: PENDENTE
- Dispositivo/modelo/Android: PENDENTE
- Package name e origem da instalacao (APK QA ou Play): PENDENTE
- Build/version/runtime: PENDENTE (esperado build 148, runtime 2.0.43)
- Canal/branch EAS e update ID (se aplicavel): PENDENTE
- SHA exato do bundle testado: PENDENTE
- Conta de teste (identificador anonimizado): PENDENTE
- Logs e evidencias sem dados pessoais/financeiros: PENDENTE

## Casos QA A — marcar somente apos teste fisico
| ID | Area | Procedimento e criterio observavel | Resultado | Evidencia |
|---|---|---|---|---|
| A01 | Lembretes | Criar lembrete com horario futuro; confirmar titulo e horario | PENDENTE | — |
| A02 | Lembretes | Recusar horario passado sem agendar notificacao | PENDENTE | — |
| A03 | Lembretes | Permissao concedida: notificacao chega no horario esperado | PENDENTE | — |
| A04 | Lembretes | Permissao negada: interface informa limitacao sem crash | PENDENTE | — |
| A05 | Lembretes | Cancelar lembrete e verificar ausencia de alerta posterior | PENDENTE | — |
| A06 | Lembretes | Concluir lembrete sem duplicar notificacao | PENDENTE | — |
| A07 | Lembretes | Reiniciar app e verificar persistencia dos itens | PENDENTE | — |
| A08 | Planejamento | Criar meta com valor BRL valido e conferir progresso | PENDENTE | — |
| A09 | Planejamento | Recusar valores vazios, negativos ou nao numericos | PENDENTE | — |
| A10 | Planejamento | Reiniciar app e conferir persistencia e isolamento por conta | PENDENTE | — |
| A11 | Login | Encerrar/reabrir sessao e verificar autenticacao normal | PENDENTE | — |
| A12 | Wallet | Abrir saldo/extrato sem alteracoes e sem ordens | PENDENTE | — |
| A13 | Pix | Navegar em rotas Pix/QR sem efetuar pagamento | PENDENTE | — |
| A14 | USDC | Abrir carteira/fluxos informativos sem trade/transferencia | PENDENTE | — |
| A15 | Didit | Abrir fluxo KYC sem alterar estado real do cliente | PENDENTE | — |
| A16 | Staff/PJ | Confirmar fronteiras e ausencia de acesso indevido | PENDENTE | — |

Resultado permitido por caso: PASS / FAIL / BLOCKED / NOT_RUN; PENDENTE equivale a NOT_RUN. Falha exige reproducao, log anonimizado, SHA, dispositivo e issue vinculada. Nao usar credenciais, OTP, dados de clientes ou valores reais nas evidencias.

## Gates de liberacao
- CI do SHA testado: PENDENTE
- 16/16 casos PASS no dispositivo e runtime alvo: PENDENTE
- Compatibilidade EAS com pacote Play e canal QA separado: PENDENTE
- Regressao Wallet/Pix/USDC/Didit/login/Staff/PJ: PENDENTE
- Revisao e aprovacao explicita: PENDENTE
- Decisao: **NO-GO** ate todos os gates passarem. Nao publicar OTA production nem executar transacoes.

## Reprodutibilidade e triagem de falhas
- Executar A01–A16 no mesmo binario identificado acima; se trocar APK, conta, dispositivo, runtime ou update ID, abrir nova sessao de evidencias. Nao combinar resultados de builds diferentes para obter 16/16.
- Para A03 e A05, registrar horario programado, horario efetivo e fuso, sem dados pessoais. Confirmar notificacao no Android, nao apenas mensagem de sucesso na UI.
- Para A04, revogar permissao nas configuracoes do Android e retornar ao app; restaurar somente apos registrar o resultado.
- Para A07 e A10, encerrar processo e reabrir; distinguir persistencia local de sincronizacao entre contas. Nao usar contas reais de clientes.
- Para A12–A16, usar apenas navegacao read-only, sem QR pago, KYC submetido, trade, transferencias ou mudanca de perfil Staff/PJ.
- Em FAIL/BLOCKED, registrar passo minimo, comportamento esperado/observado, log anonimizado, SHA e issue; nao repetir teste com fundos ou credenciais reais.
- Nao promover a production com qualquer caso NOT_RUN/BLOCKED/FAIL, mesmo se CI estiver verde ou APK standalone tiver recebido avaliacao positiva.
