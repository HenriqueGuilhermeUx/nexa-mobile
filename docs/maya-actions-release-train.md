# Maya Actions — trilha Android v148 (OTA 2.0.43)

## Regra de release
Este branch `integration/maya-actions-v148` e a base cumulativa de homologacao, **nao e o canal production**. Ele parte do mesmo codigo-fonte `feat/aave-v148-internal-apk-20261102` usado no ultimo OTA Android e recompõe as quatro telas aprovadas da entrega "Nexa activation and Maya OTA" (ativacao de `main` + Maya) e o Actions V1 (PR #120). Preservar Wallet, Staff, KYC, Pix e USDC.

**Uma OTA de producao por vez.** Feature branches nao fazem `eas update --channel production`. Cada incremento: PR -> revisao -> merge na `integration/maya-actions-v148` -> CI verde -> QA no Android v148 -> aprovacao -> update EAS de um commit exato do branch de integracao -> verificar dispositivo real -> proxima onda. A OTA mais recente no canal `production` substitui o bundle anterior e deve incluir TODAS as entregas anteriores. Evitar publicaçao direta de feature branches no mesmo canal.

## Entregas e branches
| Ordem | Branch | Primeira capacidade a entregar | Limite de seguranca |
|---|---|---|---|
| Base/0 | `feat/maya-actions-v1-20261104` (PR #120, fonte) | tarefas locais: salvar, concluir, reabrir e excluir | sem chamadas financeiras ou agendamento |
| 1 | `feat/maya-actions-01-agenda-v148` | lembretes reais, notificacoes e compromissos | permissao explicita; sem calendario externo sem consentimento |
| 2 | `feat/maya-actions-02-planejamento-v148` | orcamentos, metas, planos e progresso | dados locais/consentidos, sem recomendacao de investimento automatizada |
| 3 | `feat/maya-actions-03-financas-leitura-v148` | analise transacional e Open Finance somente leitura | Premium, auth e escopos de consentimento no backend; sem bypass |
| 4 | `feat/maya-actions-04-documentos-comunicacao-v148` | redigir mensagens, organizar documentos, criar solicitacoes | rascunho antes de enviar; aprovacoes para compartilhamento |
| 5 | `feat/maya-actions-05-wallet-preflight-v148` | preparar cotacoes, Pix, transferencias e trocas sem executar | valor, taxas, destino e risco visiveis; execucao desligada |
| 6 | `feat/maya-actions-06-wallet-execucao-v148` | executar operacoes ja suportadas pela Nexa apos confirmacao forte | auth adicional, limites, idempotencia, auditoria e regra do provedor; nunca pelo LLM diretamente |
| 7 | `feat/maya-actions-07-automacoes-v148` | monitoramentos, rotinas e gatilhos programados | consentimento granular, opt-out, limites, logs, antifraude |
| 8 | `feat/maya-actions-08-integracoes-v148` | integracoes NexOffices, SmartBots, agentes e parceiros | ferramentas somente por escopo e permissao; preservacao de produtos externos |

**Dependencias:** 3 depende de APIs de dados e consentimento em producao; 5 depende de catalogo de ferramentas validado; 6 depende dos fluxos financeiros transacionais e verificacao humana; 7 depende de backend de tarefas e fila. Nao prometer OTA so com frontend quando a funcionalidade depende de backend. Nexa Agentics PR #185 continua separada e nunca deve ser mergeada implicitamente.

## Compatibilidade Android
App `br.com.trynexa.app`, Android `versionCode=148`, app/runtime `2.0.43`, EAS project `b3faabec-283a-4ba2-88b5-f096304e68aa`. A compatibilidade OTA requer o mesmo runtime e apenas JS/recursos disponiveis no binario instalado. Mudanca de modulo nativo, manifest, permissao nativa ou runtime requer novo AAB e teste na Play Store, NAO OTA. Testar toda a matriz de versoes ativas; nao depender de limpar cache.

## Portoes obrigatorios antes de cada OTA
1. PR pequeno com escopo e rollback; review de diff contra o ultimo commit publicado.
2. `npm ci`, `npm run typecheck`, `npx expo-doctor`, `node scripts/validate-mobile-safety-v123.js`, `node scripts/validate-maya-actions-v1.js`, `npm run export:android` verdes; CI que tenha `action_required` nao e aprovado.
3. Verificar contrato de seguranca, KYC Didit e onboarding, Wallet, saldo/extrato, QR/Pix/USDC e login persistente; conferir que a Maya gratuita continua funcionando.
4. Preview/QA validado em dispositivo v148; verificar flags e eventuais endpoints e webhooks.
5. Registrar EAS update id, SHA, mensagem, runtime e etapa; confirmar recebimento em dispositivo; medir erros e ter plano de rollback do bundle anterior.
6. Somente um publicador central e manual, serializado, para `production`; nunca automatizar a publicacao em push de uma feature.

## Estado inicial
O branch de integracao esta **em construcao/homologacao**. A PR #120 fornece apenas Actions V1 locais. Nao confundir criacao de branch ou CI com release publicado. O workflow de producao existente, `.github/workflows/activation-v148-ota.yml`, foi a ultima fonte conhecida da composicao da OTA; nao substitui o novo processo de promocao ate validacao.
