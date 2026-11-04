# Nexa — mensagens de ativação (rascunho para SmartBots)

Estas mensagens **não devem ser enviadas automaticamente** sem confirmação de consentimento para marketing, identificação do CRM/WhatsApp oficial, aprovação de templates e deduplicação. Mensagens transacionais e promocionais devem ser distinguidas.

## Cadastro criado, KYC não concluído
Olá! Sua conta Nexa está quase pronta. Para utilizar os serviços financeiros disponíveis, conclua a verificação de identidade com a Didit pelo app ou site oficial da Nexa. A etapa ajuda a proteger sua conta e prevenir fraudes. Precisa de ajuda? Responda por aqui. Nunca envie senhas ou códigos de acesso.

## KYC aprovado, sem primeiro depósito
Sua identidade foi verificada! Agora você pode conhecer as opções de depósito disponíveis na Nexa, incluindo PIX e Open Finance, conforme exibidas no seu aplicativo. Confira as condições e os dados do destinatário antes de confirmar. Precisa de orientação? Estamos aqui.

## Primeiro depósito confirmado
Seu primeiro depósito foi confirmado na Nexa! Acompanhe o histórico e o saldo no aplicativo. Lembre-se: valores de criptoativos variam e não há garantia de retorno.

## Conteúdo educativo para clientes com consentimento
Quer entender melhor como dólar, USDC e criptoativos funcionam? A Nexa pode ajudar com informações sobre riscos, custos e funcionalidades. Não é necessário depositar para receber informações educativas.

## Regras mínimas de automação
- Gatilhos: cadastro criado; KYC aprovado; primeiro depósito confirmado (confirmar pelo ledger, não pelo saldo atual).
- Parar lembretes de KYC quando aprovado, rejeitado, bloqueado ou opt-out.
- Parar lembretes de primeiro depósito após confirmação; não enviar a clientes bloqueados, arquivados ou sem consentimento.
- Frequência inicial: boas-vindas, 24h, 72h; depois no máximo uma tentativa de reativação com consentimento. Para depositantes, conteúdo educativo opt-in, com limite de frequência.
- Não usar urgência artificial, promessas de valorização, recomendações personalizadas de investimento ou mensagens diárias indefinidas.
- Sem links com tokens ou dados pessoais em texto; registrar idempotência e descadastro.
