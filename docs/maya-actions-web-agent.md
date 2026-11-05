# Maya Web Actions — escopo, permissoes e entregas 09–12

## Produto
A Maya deve **realizar tarefas na web** para o cliente com clareza, consentimento e comprovacao. Exemplos:
- "Encontre o mesmo celular por menos de R$ 2.000, incluindo frete e garantia" -> buscar opcoes, comparar ofertas reais por CEP autorizado, devolver fontes, data e preco final.
- "Inscreva-me nesse curso" -> abrir formulario autorizado, preparar campos, sinalizar documentos e declaracoes, exibir resumo e pedir permissao antes de enviar.
- "Compre os tres itens da minha lista" -> montar carrinho, demonstrar disponibilidade, frete, prazo, devolucao, taxa e total; concluir apenas apos confirmacao explicita e fluxo seguro do comerciante.
- "Encontre e reserve hotel para sexta" -> comparar cancelamento/tributos e disponibilidadade real, preparar reserva e pedir confirmacao antes de efetivar.

## Modelo de ferramenta
Fluxo: cliente no app/PWA -> Maya interpreta a intencao -> `WebActionService` com auth e escopo -> pesquisar por APIs de comparacao/parceiros ou navegador remoto **isolado por usuario e tarefa** -> registrar evidencias e plano -> pedir aprovacao -> executar etapa autorizada -> conferir recibo/protocolo -> informar resultado.

**Nao tentar executar browser automation no bundle Expo.** Navegador/credenciais/dados devem ficar em backend seguro. OTA pode liberar telas e fluxos ja homologados, mas so quando o backend e conectores estiverem prontos e liberados por flag.

Preferir APIs de provedores com contratos e APIs oficiais; usar browser remoto para os sites que permitirem, com limites por dominio, URLs e acao. Sem contornar CAPTCHA, MFA, bloqueios, paywalls, limites de taxa ou termos do site. Sites que exigirem controles interativos devem transbordar ao usuario.

## Permissoes e limites
- Pesquisa de ofertas: autorizacao geral de pesquisa, sem movimentacao e sem login em lojas.
- Preenchimento: consentimento granular por site, dados/campos, documentos, finalidade e prazo. Nunca inserir RG/CPF, dados bancarios ou outros documentos sem escopo justificado. O usuario verifica quaisquer declaracoes.
- Envio de formulario, criacao de conta, reserva e alteracao de cadastro: aprovacao por submissao, com previsualizacao do destino e conteudo.
- Carrinho: pode preparar sem finalizar, de acordo com acesso consentido. Compra: usuario confirma loja, produto, variacoes, quantidade, frete, tributos, prazo, valor total, moeda, endereco, politica de cancelamento e metodo. Reautenticacao/3DS/passkey no fluxo do comerciante/parceiro. Sem armazenar senha, CVV, OTP ou dados completos de cartao na Maya.
- Despesas recorrentes, termos de contrato, cancelamentos e servicos regulados: revisao explicita com aviso de compromisso/recorrencia. Nenhuma compra automatica sem limites e consentimento especifico ja homologados; V1 mantem compra assistida.
- O LLM **nunca** tem poder irrestrito de clicar/enviar/pagar; propõe chamadas estruturadas que uma camada deterministica valida e audita.
- Defesa contra prompt injection: paginas, anuncios, mensagens e documentos de terceiros sao dados nao confiaveis; nunca redefinem politica, destino de pagamento ou permissoes. Protecao SSRF, bloqueio de rede interna, isolamento de cookies, credenciais efemeras, logs com redacao e politica de retencao.
- Transacoes idempotentes: antes da acao externa definitiva, gerar `approvalId`, `idempotencyKey`, expirar se o preco mudou; reconfirmar em divergencia. Lidar com timeout/ambiguidade consultando o pedido antes de tentar de novo.

## Contrato minimo (planejado; NAO implementado na API)
- `POST /maya/web-actions`: criar tarefa com `intentType`, `userText`, `allowedDomains` e escopos (o backend deriva o userId do token).
- `GET /maya/web-actions/:id`: progresso, evidencias, ofertas, valores, redacoes e links.
- `POST /maya/web-actions/:id/approve`: ato de consentimento para passo final, com resumo de parametros congelados.
- `POST /maya/web-actions/:id/cancel`: cancelar tarefa pendente, sem desfazer operacoes ja efetivadas.
- `GET /maya/web-actions/:id/receipt`: recibo, protocolo, pedido, status ou justificativa de falha verificada.

Estados: `draft`, `researching`, `options_ready`, `awaiting_approval`, `executing`, `completed`, `blocked`, `failed`, `cancelled`. O backend pode requerer `requires_human_handoff` sem fingir sucesso.

## Etapas de homologacao
09. Busca e cotacao somente leitura: provar evidencias de URLs, timestamp, variacoes, frete e disponibilidade. SEM checkout.
10. Inscricoes: preencher sem enviar, revisar campos e permitir submissao site a site apos consentimento; MFA/CAPTCHA na mao do cliente.
11. Comercio: montar carrinho e revisar checkout; concluir compra apenas em piloto validado por merchant/PSP, recibo e antifraude.
12. Reservas: confirmar inventario real, politicas, aprovacao do cliente e comprovantes; diferenciar reserva gratis de compra nao reembolsavel.

## Politica de publicacao
PR de feature -> CI e security checks -> testes de integracao com sites/parceiros homologados em sandbox -> merge na `integration/maya-actions-v148` -> EAS update acumulativo e controlado. Nenhum dos 4 modulos fica disponivel por ser apenas uma branch existente. Browser remoto e backend devem ser implantados e autorizados em processo separado. Preservar Wallet/Privy, Pix/USDC, KYC, Staff e funcionalidades atuais; nao fazer merge de PR #185 Agentics por essa via.
