# Maya Actions v148 — QA A: evidências físicas A01–A16

Data de preparação: 2026-11-11. **Este arquivo é um roteiro de homologação, não um atestado de testes executados.** Todos os casos abaixo permanecem `PENDENTE` até anexar evidência verificável de execução no aparelho. Não usar contas ou capital de clientes em testes transacionais.

## Referências congeladas
- Integração de partida: `integration/maya-actions-v148` @ `f341f01787f50eaa13b363dc8a57b17da1fe5044`.
- Release candidate QA A: `release/maya-actions-v148-wave-a-20261104` @ `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`.
- QA A EAS branch `maya-actions-v148-qa`, runtime `2.0.43`, Android v148; grupo `1cd78cdf-0535-4a79-b0dc-ff65ffe46178` (registro anterior no plano oficial, não revalidado no aparelho nesta execução).
- APK isolado `br.com.trynexa.mayaqa` teve retorno geral "OK" em 06/11, **sem evidência individual** dos casos abaixo. APK QA isolado não demonstra recebimento OTA no app Play.
- Produção: **NO-GO**. Este branch de documentação não publica OTA nem modifica aplicativo.

## Preencher em cada caso
Para cada caso registrar: data/hora com fuso, modelo/Android, package, versionCode, runtime, canal EAS, SHA/update ID observado, conta de teste anonimizada, passos realizados, resultado esperado/observado, evidência (link privado seguro), responsável e decisão PASS/FAIL/BLOCKED. Nunca armazenar tokens, OTP, CPF, dados bancários, saldo pessoal ou screenshots sensíveis neste repositório.

| Caso | Verificação manual em dispositivo | Estado | Evidência |
|---|---|---|---|
| A01 | Instalar/abrir QA A sem substituir Nexa Play; confirmar package, v148 e runtime 2.0.43 | PENDENTE | — |
| A02 | Confirmar canal/update ID QA A recebido no binário compatível; não confundir APK standalone com OTA | PENDENTE | — |
| A03 | Login e sessão persistente após fechar/reabrir, sem limpeza de cache | PENDENTE | — |
| A04 | App lock/retomada de sessão e navegação principal | PENDENTE | — |
| A05 | Maya abre e funcionalidades anteriores permanecem acessíveis | PENDENTE | — |
| A06 | Solicitar permissão de notificação: aceitar e recusar, sem travamento | PENDENTE | — |
| A07 | Criar lembrete com horário futuro; conferir persistência e confirmação | PENDENTE | — |
| A08 | Disparo de notificação no horário em aparelho real; fuso e app em segundo plano | PENDENTE | — |
| A09 | Editar/cancelar lembrete e verificar ausência de notificação cancelada | PENDENTE | — |
| A10 | Concluir/reabrir lembrete e validar estado persistido | PENDENTE | — |
| A11 | Criar meta/orçamento local em BRL válido, verificar progresso e persistência | PENDENTE | — |
| A12 | Rejeitar valores inválidos e garantir que orçamento não seja apresentado como saldo real | PENDENTE | — |
| A13 | Wallet e extrato somente leitura: rotas e dados existentes sem regressão | PENDENTE | — |
| A14 | Pix/QR/USDC: telas e pré-visualizações sem efetuar transferência, swap ou pagamento | PENDENTE | — |
| A15 | Didit/KYC e onboarding: navegação/estados sem reiniciar verificação real | PENDENTE | — |
| A16 | Staff, Nexa PJ, logout/relogin, retorno à Nexa Play e ausência de regressões | PENDENTE | — |

## Gate de decisão
- `PASS` somente com 16/16 casos evidenciados, sem falha crítica, CI do SHA candidato confirmado, verificação de compatibilidade nativa e canal/runtime, e aprovação explícita do responsável.
- `BLOCKED` se não houver dispositivo QA compatível, credenciais de teste, acesso ao EAS ou evidência individual.
- Não promover nada à integração apenas por criar esta matriz. Não publicar OTA production. Staged OTA apenas por workflow QA autorizado, com SHA imutável e controles do plano.
- Onda 09 (`7d247f3c7f82278761b6f7141bc28309d60ae2b2`): três workflows SUCCESS consultados em 11/11, PR #136 draft, sem revisão registrada e sem backend de preços reais homologado; não promover.
- PRs #137, #139, #140: drafts sem revisões registradas na consulta de 11/11. PR #185 e outros repositórios ficam fora de escopo.
