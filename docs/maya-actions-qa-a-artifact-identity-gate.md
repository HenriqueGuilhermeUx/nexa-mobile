# Maya Actions QA A — separação verificável entre APK standalone e EAS OTA

**Escopo:** ondas 01 (lembretes) e 02 (planejamento), Android 2.0.43 / build 148. Este protocolo é um incremento de segurança documental; **não representa homologação, aprovação nem publicação**.

## Duas identidades que não podem ser confundidas

| Critério | APK standalone de teste | EAS OTA QA A |
|---|---|---|
| Android applicationId | `br.com.trynexa.mayaqa` | `br.com.trynexa.app` |
| Binário | APK independente de QA, assinatura própria | App compatível com o canal EAS de QA |
| Release JS | Confirmar SHA embutido no artefato e build efetivo | `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e` |
| Update ID | **Não inferir** ID EAS a partir do APK standalone | `01a1a975-d85f-794f-9d67-cf2ac961fbb7` |
| EAS branch | Não presumir | `maya-actions-v148-qa` |
| Evidência existente | Feedback “OK” em 06/11/2026, parcial | Publicação QA registrada no plano; teste completo em dispositivo não demonstrado |
| Production | Não altera | Não altera |

## Gate antes de qualquer GO

1. Registrar no mesmo conjunto de evidências: `applicationId` realmente instalado, versão, build, runtime, modelo físico, Android, timestamp com fuso, SHA de origem e, **somente no caso OTA**, update ID observado no dispositivo.
2. Não atribuir ao APK standalone o update ID da OTA QA A. Não atribuir à OTA um teste executado apenas no APK independente.
3. Executar A01–A06, P01–P05 e R01–R05 **separadamente no artefato que será aprovado**. O retorno “OK” do standalone não substitui o checklist da OTA.
4. Executar `node --test scripts/validate-maya-qa-a-evidence.test.js` e `node scripts/validate-maya-qa-a-evidence.js <manifest.json> <diretorio-de-capturas>`. O validador atual está **fixado à identidade da OTA QA A**; não o utilizar para certificar o APK standalone.
5. Conferir checks do **SHA exato** do candidato, inclusive jobs de push (a consulta de runs associados a PR não cobre necessariamente push). Status vazio **não** equivale a sucesso.
6. Inspecionar manualmente as 16 capturas e regressões de login, Wallet, Pix, USDC, Didit, Staff, navegação e persistência por conta. Não usar credenciais ou dinheiro real em evidências.
7. Obter aprovação humana explícita vinculada ao SHA, artefato, dispositivo e execução de CI. Sem esses elementos, **NO-GO**.

## Isolamento operacional

Nenhuma promoção automática decorre deste documento. Não alterar o canal `production`, não executar ordens financeiras e não mesclar branches divergentes sem CI e revisão. A integração cumulativa e a PR #185 permanecem fora do escopo desta verificação.

## Lacuna de implementação identificada

O manifesto do validador existente exige `releaseSha` e `updateId`, mas ainda **não vincula `applicationId` instalado**. Até existir uma validação automatizada específica para pacote e canal, a identidade do aplicativo precisa de verificação humana documentada. Uma evolução futura deve suportar esquemas distintos para standalone e OTA sem reaproveitar um ID EAS inexistente no standalone.
