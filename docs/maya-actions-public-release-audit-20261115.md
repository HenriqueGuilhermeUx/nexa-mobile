# Auditoria de liberação — Maya Actions 12 ondas — 15/11/2026

## Fonte, escopo e critérios
- Fonte cumulativa: `integration/maya-actions-v148`, SHA `6f1c9fd1bf16fc0046228993a83118390da62760`, Android 2.0.43/v148.
- Teste físico positivo do APK D2 pelo responsável e confirmação de recebimento da atualização OTA no aplicativo OTA QA sem reinstalação (marcador de 13/11).
- QA OTA 13/11: Android update `01a1d695-57d6-7f91-bd03-8498cf5c2da9`, runtime 2.0.43, EAS branch `maya-actions-v148-qa`, **com marcador de QA que não pode chegar a production**.
- O APK de QA separado tem package `br.com.trynexa.mayaotaqa`, não equivale ao APK Play Store `br.com.trynexa.app`. A OTA JS foi comprovada para o canal QA, não para production.
- A branch `main` declara 2.0.42/code145; não assumir que reflita a última OTA ou instalação Android atual. Confirmar no EAS/Play quais runtimes reais estão em uso e qual atualização está no canal `production` antes de substituir o bundle.
- Auditar todo fluxo de Pix, Wallet, KYC/Didit, Staff, login persistente, voz e Open Finance; corrigir qualquer erro real de KYC antes de expandir onboarding.

## Matriz de capacidades vs. implementação
| Onda | Diagnóstico técnico | Habilitar para clientes agora? |
|---|---|---|
| 01 | Lembretes, calendário, tarefas e notificações: código integrado e homologado no QA D2 | Só após validação do binário Play/runtime e regressão de produção |
| 02 | Metas e planejamento local integrado | Mesma condição; não confundir com saldo real |
| 03 | Consulta autenticada de movimentações Nexa (read-only). Não há integração de Open Finance externo pela Maya | Mesma condição; checar valores e sessão |
| 04 | Mensagens e compartilhamento manuais (sem envio autônomo) integrados | Mesma condição |
| 05 | Branch antiga/sem implementação nova à frente de integration | Não; requisitos pré-execução financeira pendentes |
| 06 | Branch antiga/sem implementação nova; execução financeira condicionada a controles | Não habilitar execução por IA |
| 07 | Branch antiga/sem scheduler/backend de automações homologado | Não |
| 08 | Branch antiga/sem integrações autenticadas homologadas | Não |
| 09 | Pesquisa externa manual já integrada. Comparação 09C: validadores read-only e ordenação com evidência importados nesta PR, **sem serviço que entregue ofertas reais** | Preservar pesquisa existente; não anunciar comparação automática |
| 10 | Contratos e validação de formulário para revisão, sem submissão real | Não habilitar envio autônomo |
| 11 | Apenas escopo/branch; checkout sem backend e consentimento | Não |
| 12 | Apenas escopo/branch; reservas sem disponibilidade e comprovantes reais | Não |

## Modificações desta PR
- `src/maya-actions/verifiedQuoteComparison.ts`: ranking somente de ofertas completas e atuais em BRL; rejeita total indefinido.
- `src/maya-actions/quoteEvidence.ts`: guard de evidência de fonte, URLs seguras, relógio, limite por lote, variantes de produtos diferentes.
- Testes de entradas adversariais e integração com `maya-actions-train-ci.yml`.
- Nenhuma tela nova, nenhuma API externa, nenhum backend, nenhuma feature flag de execução alterada.

## Portões de release público pendentes
1. CI final cumulativo e testes de segurança e regressão em Android v148 (não inferir aprovação do CI enquanto em andamento).
2. Reconstruir estado **real** do canal EAS `production` com dados do Expo, verificar `runtimeVersion`, channel mapping e última OTA; comparar assets e flags com SHA da release candidata; validar paridade com binário Play instalado.
3. Confirmar não regressão de login, Maya voz, Pix QR e chave, ledger, KYC Didit, Wallet, Staff e Open Finance no aplicativo **oficial**.
4. Confirmar se há contratos de novas versões de backend necessários e se são de fato disponibilizados; não executar operações reais em conta de clientes durante teste.
5. Verificar matriz QA: D2 testado e OTA QA recebida; evidências QA A offline têm alguns workflows falhos e outros mais recentes bem-sucedidos, investigar causas e confirmar baseline atual.
6. Garantir controle de rollback da última OTA íntegra; distribuir SHA cumulativo **sem marcador canary**, com canais e flags de produção explicitamente revisados.
7. Publicar pelo único workflow manual protegido para production; registrar group ID, Android update ID, versão, canal e resultado em aparelho oficial.

**Condição de parada:** se qualquer gate de produção falhar ou permanecer desconhecido, manter canal production inalterado. Não transformar teste de código, build APK QA ou recebimento de OTA QA em afirmação de disponibilidade pública.
