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

## Protocolo reproduzível — ondas 01 e 02 (sem operações financeiras)

Executar **somente** no binário QA compatível e com conta de teste. Antes de iniciar, registrar em armazenamento privado o package instalado, versionCode 148, runtime 2.0.43, canal EAS e update ID observado no aparelho. Não deduzir esses dados do workflow de publicação. Se não for possível observar o update ID, marcar A02 como BLOCKED, não PASS.

1. **A06 — permissão**: em instalação limpa de QA, recusar notificações, abrir lembretes e confirmar ausência de crash; depois habilitar nas configurações Android e repetir. Guardar registro redigido dos dois resultados.
2. **A07–A08 — criação e disparo**: criar lembrete para 3–5 minutos no futuro, fechar/reabrir app, confirmar persistência, deixar app em segundo plano e observar disparo no horário local. Anotar horário previsto/real e fuso; não inferir disparo a partir de tela de confirmação.
3. **A09–A10 — cancelamento e conclusão**: criar segundo lembrete, cancelar antes do horário, aguardar além do horário e comprovar ausência de disparo; concluir e reabrir outro lembrete, reiniciar app e verificar persistência. Não usar a mesma captura como evidência independente de casos distintos.
4. **A11–A12 — planejamento**: criar meta/orçamento com valor BRL válido, registrar progresso, reiniciar app e verificar persistência; testar entrada inválida e confirmar rejeição. Verificar que o valor de planejamento não aparece como saldo Wallet ou saldo bancário.
5. **A13–A16 — regressão sem efeitos externos**: navegar por Wallet/extrato, Pix/QR/USDC (somente visualização), Didit/onboarding e Staff/Nexa PJ; registrar comportamento sem realizar transações, iniciar KYC real ou alterar dados de clientes.

Para cada caso, registrar esperado versus observado, horário com offset, modelo/Android, versão, identificador privado **único** de evidência e responsável. Um teste BLOCKED ou FAIL impede promoção. A execução da suíte sintética offline valida apenas a estrutura do manifesto; **não** atesta execução física, aprovação de release ou recebimento de OTA. Nenhum segredo ou captura sensível deve ser commitado.

### Checkpoint de engenharia — 13/11/2026
- Integração cumulativa observada: `6f1c9fd1bf16fc0046228993a83118390da62760` (não alterada neste checkpoint).
- Branch QA A anterior a este protocolo: `db0395244320f6b35513bf3a475a81971dc2272b`; comparação: 70 commits à frente, 7 atrás da integração.
- Para `db039524`, consulta de runs vinculados à PR retornou lista vazia e status combinados vazios; **não** equivale a comprovação de CI verde nem de CI inexistente em todos os eventos.
- Ondas 01/02: QA físico A01–A16 pendente. Onda 09: backend de cotação real não homologado. Onda 10: somente revisão sem envio. Ondas 03–08 e 11–12: sem nova promoção autorizada neste checkpoint.
- PR #142 e demais aprovações precisam de rechecagem antes de qualquer merge; produção continua NO-GO.
