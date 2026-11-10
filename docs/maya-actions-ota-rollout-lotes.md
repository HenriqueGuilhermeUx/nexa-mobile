# Maya Actions — lançamento cumulativo por lotes (Android 2.0.43 / 148)

## Decisão de produto
A Nexa continua sendo **um único app oficial**: `br.com.trynexa.app`. Todas as entregas de interface JavaScript compatíveis com o binário existente serão promovidas via Expo OTA (EAS Update). Entregas de API exigem seu backend validado e ativo antes da interface. Permissões, dependências nativas, runtime e configurações de Android exigem AAB/Play e não devem ser mascaradas como OTA.

## Cadência e cortes

| Lote | Escopo publicável inicialmente | O que fica bloqueado |
| --- | --- | --- |
| C — comunicação | lembretes, metas, mensagens editáveis e compartilhamento manual; navegação validada em APK C | mensagens enviadas pela Maya, pagamentos |
| D — leitura | consulta autenticada de depósitos, resgates e ordens já disponibilizadas pela API, somente leitura; demais telas cumulativas do C | consulta de saldo bancário inexistente, Open Finance sem consentimento, execução |
| E — cotações | primeira etapa: pesquisa externa iniciada pelo usuário, comparação apenas com cotações reais e verificáveis se houver serviço de cotações aprovado | ranqueamento com dados sintéticos, suposta verificação sem provedor, checkout |
| F — ações web | rascunhos e preenchimento supervisionado de formulários; integração de navegador somente após autenticação, auditoria e consentimento | envio automático, senhas, OTP, CVV, CAPTCHA automatizado |
| G — compras/serviços | recomendações, carrinhos e prévias de reservas, somente com parceiros e políticas verificadas | compra, reserva ou pagamento sem aprovação explícita |

**Unidades pequenas, entregas cumulativas.** No máximo um lote promovido por OTA por ciclo de homologação; se um lote falhar, o anterior permanece em production. Não esperar pelas 12 ondas para disponibilizar C/D. As ondas financeiras 05/06 são uma trilha independente e não entram automaticamente nesses lotes.

## Trilho obrigatório por lote

1. Revisar PRs e obter integração cumulativa em `integration/maya-actions-v148`. O branch/commit de release é congelado em SHA completo, sem cherry-pick de mudanças não homologadas.
2. Compilar QA isolado se necessário e executar testes em aparelho (autenticação, navegação, lembretes, mensagens, leitura). **O APK QA é outro pacote, assinado com chave descartável e tem OTA desabilitado; não prova que OTA chega ao app Play.**
3. Para o canal QA do **app oficial compatível**, publicar via EAS Update na branch QA, usando commit exato revisado e sem tocar o canal production. Confirmar EAS group e Android update IDs e o dispositivo inscrito no canal de QA. Não usar o QA APK isolado para validar distribuição OTA do app Play.
4. Registrar evidências de QA, matriz de regressão e versão de backend/feature flags. Garantir que a mudança não altera fluxo de Wallet, Pix, KYC, login, saldo, extrato e compras.
5. Publicar **um** OTA production pelo workflow central manual e serializado somente após validação e confirmação humana; preservar configurações e capacidades que já existem na versão instalada, sem acionar permissões financeiras novas.
6. Verificar recebimento em dispositivo com binário de produção, telemetria e falhas. Registrar ID do update de produção e SHA; manter snapshot anterior para re-publicação em caso de rollback.

## Critérios de QA por lote
- **C:** confirmar tarefa/agenda e cancelamento de notificação; rascunho, compartilhamento manual, sem envio automático.
- **D:** C continua funcionando; cada API read-only responde ou falha isoladamente, sem dados pessoais em logs, sem execução.
- **E:** fontes de ofertas reais identificadas, preços/frete/tributos/variante e disponibilidade conferidos; sem evidência, exibir indisponibilidade; orçamento opcional.
- **F:** consentimento por domínio, preview de campos, bloqueio de senha/OTP/CVV e confirmação manual.
- **G:** confirmar loja, estoque, preço final, taxa, política de cancelamento e autorização específica; nenhum pagamento nesta trilha.

## Dependências conhecidas em 10/11/2026
- APK C aprovado pelo responsável no dispositivo; não comprova regressão de todas as funções.
- APK D: workflow PR #137 em compilação, artefato ainda precisa ser verificado e testado no aparelho.
- Preços: PR móvel #136 e backend #277 em revisão; **não integrar cotações reais até existir provedor confiável e endpoint autorizado**.
- OTA QA do Android 2.0.43 exige binário inscrito no canal correto; APK isolado D não atende esse requisito.
- O workflow de promoção production já exige confirmação e SHA. Não o invocar antes dos gates.
- Nexa Agentics PR #185, NexOffices e demais frentes seguem independentes.

## Registro obrigatório de cada publicação
| Campo | Informação |
| --- | --- |
| Lote e SHA completo | commit exato de `integration/maya-actions-v148` |
| Runtime/package/canal | 2.0.43, `br.com.trynexa.app`, QA ou production |
| CI | links dos workflows completos |
| QA físico | aparelho, build e casos executados, falhas conhecidas |
| EAS | update group e Android update ID; canal/branch e horário |
| Backend | rotas necessárias, flags, consentimentos e versão realmente ativa |
| Rollback | último update estável, procedimento e verificador |
| Aprovação | confirmação antes de production |

## Regra de segurança operacional
Nenhuma publicação automática da produção em push/merge. Uma OTA altera o bundle JS inteiro — precisa conter tudo que já funcionava, não apenas a função mais recente. Não alterar o canal ou políticas financeiras só para ativar a Maya. O crescimento da Maya usa capacidade incremental, não autorização implícita para movimentar fundos.
