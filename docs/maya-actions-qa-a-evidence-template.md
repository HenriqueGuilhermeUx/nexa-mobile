# Maya Actions QA A — registro de evidencias (modelo, nao executado)

Release congelado: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`; runtime `2.0.43`; EAS QA A group `1cd78cdf-0535-4a79-b0dc-ff65ffe46178`.

Preencher antes dos testes: aparelho/Android ___; build/versionCode ___; canal EAS ___; update ID efetivamente instalado ___; data/hora ___; testador ___.

**Importante:** o app production nao recebe automaticamente a branch QA. Nao confundir sucesso do workflow com instalacao ou homologacao no aparelho. Nao usar conta com saldo real.

| Caso | Resultado | Evidencia sem dados sensiveis | Observacao |
| --- | --- | --- | --- |
| A01 permissao negada | NOT RUN | — | |
| A02 notificacao entregue | NOT RUN | — | |
| A03 persistencia sem duplicar | NOT RUN | — | |
| A04 cancelamento antes do disparo | NOT RUN | — | |
| A05 conclusao e reabertura | NOT RUN | — | |
| A06 data invalida/passada | NOT RUN | — | |
| P01 meta BRL valida | NOT RUN | — | |
| P02 valores invalidos | NOT RUN | — | |
| P03 persistencia | NOT RUN | — | |
| P04 isolamento entre contas | NOT RUN | — | |
| P05 progresso e limites | NOT RUN | — | |
| R01 login/logout | NOT RUN | — | |
| R02 Maya e Staff | NOT RUN | — | |
| R03 Didit/KYC (navegacao) | NOT RUN | — | |
| R04 Wallet/extrato/QR/Pix/USDC (somente leitura/preflight) | NOT RUN | — | |
| R05 offline/segundo plano/runtime | NOT RUN | — | |

Valores permitidos: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`. Cada PASS exige evidencia observada em aparelho. Para falha, registrar passos de reproducao e impacto; nao anexar segredos, tokens, saldos ou dados pessoais.

Decisao: **NO-GO (nao homologado)** ate que todos os casos criticos estejam comprovados, CI do SHA de promocao esteja verde e haja aprovacao explicita. Nao executar Pix, compras, reservas, pagamentos, cadastros externos ou qualquer operacao financeira. Nao publicar OTA production.

Protocolo detalhado: `docs/maya-actions-qa-a-device-protocol.md`.
