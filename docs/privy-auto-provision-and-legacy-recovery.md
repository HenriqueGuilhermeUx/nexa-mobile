# Nexa — Privy automática como regra de produto

## Contrato de experiência
- A Nexa cria, localiza e vincula a embedded wallet automaticamente; o cliente não escolhe rede, gerencia chave nem executa passos de infraestrutura.
- A autenticação da própria conta permanece necessária (não significa consentimento para transferências). Autorização de transações é distinta de provisionamento.
- KYC obrigatório para depósito e operações financeiras. A ausência de chave Pix CPF para **resgate** não bloqueia a carteira Privy.
- Nenhuma conta `nexa-managed` é apresentada como Privy; nenhum depósito pode ser feito para endereço antigo apenas porque parece uma carteira vinculada.

## Dois grupos atendidos pelo mesmo fluxo idempotente
1. **Novos:** logo após login autenticado, se a Privy não existe, criar embedded wallet não-custodial no contexto de autenticação do próprio cliente; resolver ID/endereços canônicos da Privy e vincular com token verificado pelo backend; apresentar saldo somente após confirmação de vínculo.
2. **Clientes existentes:** ao abrir a Nexa, pesquisar vínculo Privy já existente; reutilizá-lo, nunca criar segunda wallet se já existir. Se cadastro tem `nexa-managed`, preservar chave criptografada/endereço anterior e mapear ambos em auditoria antes de trocar a wallet ativa. Se houver fundos legados, nenhuma migração/assinatura pelo serviço sem processo segregado e autorizado.

## Eliminar o segundo login
Avaliar **Privy Custom JWT Authentication** ou migração antecipada **Import Users API** + pregeneration de wallets **user-controlled**. Não reutilizar JWT Nexa arbitrariamente: Privy precisa estar configurado com a chave pública/JWKS, claim `sub` estável e autenticação comprovada. Nunca criar wallets controladas pela Nexa fingindo serem autocustódia. Configuração dashboard Privy, titularidade, login e recuperação entre dispositivos precisam ser homologadas antes da ativação. Integração web e Expo deve usar o mesmo mapeamento de identidade, sem vincular duas pessoas por similaridade de e-mail.

## Segurança / observabilidade
- Endpoint autenticado `/user/me` é fonte de verdade do booleano `wallet.privyLinked`; exigir DID Privy e wallet ID reais, endereço válido e vínculo verificado pelo provedor.
- Instrumentar eventos sem CPF, tokens, chaves nem endereço completo: `wallet_activation_attempted`, `privy_session_verified`, `wallet_reused`, `wallet_created`, `wallet_linked`, `ownership_confirmed`, `activation_blocked`, erro normalizado e versão do cliente.
- Duplicação: falhas de rede são estado desconhecido; consultar Privy antes de repetir criação.
- Liberação de depósitos só após KYC aprovado, carteira Privy verificada, prova de titularidade e gates Wallet-First/tesouraria; sem criação de Pix se indisponível.
- OTA: preservar runtime e versão base atuais do Android, validar canário e expansão por telemetria; iOS e PWA com homologação separada.

## Critérios de aceite verificáveis
- Novo cadastro, KYC aprovado, 1ª sessão: carteira Privy criada e vinculada sem botão técnico, sem Pix CPF prévio.
- Cadastro legado `nexa-managed`: auto-resume, Privy nova ou reutilizada com vínculo correto, sem apagar material criptografado anterior.
- Segundo aparelho: mesma carteira/DID, não duplicar.
- Sessão expirada/timeout: fail-closed com reautenticação normal e retry idempotente.
- Distinção entre carteira criada, vínculo Privy confirmado, prova EIP-191 e capacidade de depósito; painel agregado por etapa.
- Teste de pagamento: simular pré-checagem e emissão de cobrança sem efetuar PIX real; produção só depois do fluxo comprovado.

## Estado nesta PR
Corrige rota mobile: wallet Privy primeiro, Pix CPF somente para saques depois; inclui regressões. **Não significa** que 226 usuários já estejam vinculados. Custom auth/Import Users/pregeneration dependem de validação do dashboard/API Privy e integração backend adicional.
