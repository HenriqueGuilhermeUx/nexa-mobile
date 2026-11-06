# Maya Actions · onda 04 — roteiro de homologação

Escopo: comunicação assistida no app Android v148, sem envio automático. O teste em dispositivo do lote A foi relatado pelo responsável como **OK** em 06/11, mas a nova onda 04 ainda não passou por QA físico nem está publicada no EAS.

## Critérios mínimos (usar apenas destinatários de teste)
- Entrar com conta de teste e abrir Maya → Actions → **Preparar mensagem ou e-mail**. Sem login válido, a tela não permite compartilhar.
- Trocar entre Mensagem, E-mail e Solicitação. Conferir os modelos editáveis e a exigência de assunto nos dois últimos.
- Digitar texto, gerar prévia, alterar o texto e confirmar que a prévia antiga some.
- Testar mensagem vazia, assunto ausente, mensagem superior ao limite e caracteres de controle. Nenhum deles deve abrir a folha de compartilhamento.
- Com o texto revisado, tocar em **Compartilhar após revisar**; selecionar um aplicativo de teste e cancelar. A Maya não afirma entrega, não escolhe destinatário e não envia nada sem ação humana.
- Pela conversa da Maya, pedir "escreva uma mensagem para minha irmã": a tela abre mostrando o pedido, mas a mensagem não é enviada nem apresentada como conteúdo gerado por IA.
- Pela conversa, pedir "envie USDC" ou "prepare um e-mail sobre Pix": o roteador de comunicação não captura intenção financeira.
- Regressão obrigatória: lembretes, metas, login, KYC, Staff, Wallet, Pix e histórico. Não executar transações financeiras reais.
- Abrir/fechar tela: não reter rascunhos em servidor ou no AsyncStorage; não pedir acesso aos contatos ou permissões novas.

## CI e publicação
- Rodar `node scripts/validate-maya-comunicacao-v1.js`, `node scripts/validate-maya-chat-routing-v1.js`, `npm run typecheck`, Expo Doctor e export Android cumulativos.
- PR alvo: `integration/maya-actions-v148`. Nenhuma publicação production automática.
- Após PR verde e merge, congelar SHA cumulativo e publicar primeiro no EAS **QA isolado**, com runtime `2.0.43`. A onda 04 não depende de build nativo novo, pois usa `Share` do React Native.
- O APK standalone de testes (pacote `br.com.trynexa.mayaqa`) não comprova OTA nem substitui teste do canal EAS em dispositivo real.
- Receber aceite do usuário e evidências sanitizadas por caso antes de liberar production. Não registrar nomes, telefones, endereços, mensagens privadas ou códigos de autenticação nos artefatos de QA.
