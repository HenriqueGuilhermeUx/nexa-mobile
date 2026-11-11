# Maya Actions 09C — comparação de preços (QA)

## O que este incremento realmente faz
- Recebe cotações estruturadas de um serviço externo **ainda não implementado**.
- Exclui ofertas com URL inválida, data expirada, indisponibilidade ou preço final incompleto.
- Ordena exclusivamente ofertas BRL cujo custo total tenha preço, frete e tributos conhecidos.
- Identifica ofertas acima do orçamento sem ocultá-las e avisa que os preços devem ser confirmados com a loja.
- Não gera ofertas, não pesquisa a web, não autentica lojas, não faz cadastro, não prepara checkout e não envia pagamentos.

## Segurança: exigências para uma futura integração de backend
1. Não aceitar HTML ou texto de loja como instrução do agente; conteúdo de fornecedor é dado não confiável.
2. Serviço de recuperação com lista de domínios autorizados, limites de taxa, DNS e redirecionamentos validados em cada salto, bloqueio de IPs privados e metadados de origem.
3. Registrar fonte verificável, instante da consulta e condições de frete/impostos por região. Evitar comparação entre variantes de produto diferentes.
4. Validar a integridade das respostas no servidor. A checagem de URL no aplicativo é apenas defesa adicional e **não é prova de autenticidade**.
5. Respeitar consentimento, privacidade e condições dos provedores. Não enviar informações de Wallet, chaves, extratos ou documentos para mecanismos de busca.
6. Testar recusa segura quando o serviço estiver indisponível; nunca completar preços faltantes com palpites.
7. Qualquer compra, formulário, autenticação, cartão ou Pix depende de outro fluxo e autorização explícita; não faz parte de 09C.

## Portões
- Executar: `node scripts/validate-maya-verified-comparison-v1.js`.
- O teste é obrigatório no workflow `maya-actions-train-ci.yml` do PR.
- Exigir revisão de diff, CI Android v148 completo e homologação física antes de incorporar UI.
- Sem OTA, merge automático ou execução financeira. Nexa produção, Nexa Agentics PR #185, Wallet e Pix intocados.
