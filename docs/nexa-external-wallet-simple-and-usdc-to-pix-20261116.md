# Nexa Wallet — carteira externa simples e rota USDC → Pix

## Objetivo comercial

Um cliente habituado a MetaMask, Trust Wallet, Coinbase Wallet ou outra carteira EVM deve conseguir entrar na Nexa, acompanhar o seu USDC na Polygon e descobrir o endereço de recebimento Nexa **sem instalar uma segunda wallet, importar chaves ou depender de WalletConnect**.

Fase posterior: uma pessoa elegível no exterior poderá usar cripto para solicitar um pagamento Pix no Brasil **por infraestrutura regulada**, sem que a Nexa prometa execução financeira antes de cotação, compliance e liquidação verificadas.

## O que a primeira etapa faz

- Conecta no sentido de **acompanhar por endereço público**: não é uma sessão de autorização nem prova de propriedade.
- Consulta saldo de USDC nativo Polygon por `balanceOf` (`0x3c499c542cef5e3811e1192ce70d8cc03d5c3359`), somente leitura.
- Aceita até cinco endereços públicos por identidade Nexa no aparelho, em armazenamento seguro segregado; o servidor Nexa não recebe uma lista de endereços cadastrados.
- Exibe QR e endereço Nexa **apenas quando recebidos do endpoint autenticado existente `/wallet-v15/me`**.
- Oferece abrir a Nexa Web dentro do navegador integrado da MetaMask.
- Não transaciona, não cria assinatura, não pede seed phrase e não credita ledger.

### Não confundir

1. **Observar** um endereço: qualquer endereço público pode ser acompanhado. Isso não prova titularidade.
2. **Comprovar titularidade**: futura prova opcional por mensagem de posse (assinatura controlada pelo usuário) ou por fluxo de verificação equivalente, sem transferências.
3. **Transferir**: a carteira de origem assina e transmite no próprio aplicativo. Destino Nexa e rede/ativo devem ser conferidos, a entrada só aparece como confirmada quando a blockchain e a conciliação concordarem.
4. **Pagar Pix**: não ocorre no protocolo blockchain. Requer parceiro com autorização/arranjo aplicável, conversão/liquidez em BRL e participante Pix para executar.

## USDC de cliente estrangeiro para Pix brasileiro — fluxo-alvo

1. Cliente acessa Nexa, confirma identidade, residência fiscal e elegibilidade geográfica para o produto. KYC/AML/PEP/sanções e avaliação de riscos aprovados.
2. Cliente informa Pix Copia e Cola/chave ou QR e a Nexa verifica titularidade/beneficiário, instituição, destino, limites, riscos e eventual documentação do corredor.
3. O parceiro regulado oferece cotação **real, datada, expirá​vel**, com USDC necessário, BRL líquido, câmbio, taxas, rede, slippage, limites e condições.
4. Com autorização explícita do usuário, a carteira externa executa o funding para **endereço verificado indicado pelo parceiro**, sem ser inferido de QR desconhecido ou capturado manualmente.
5. A liquidação reconhece depósitos on-chain com identificadores de intenção únicos e número de confirmações exigido, com checagem de rede/contrato, AML e proteção contra duplicidade.
6. O parceiro de câmbio/ativos virtuais efetua conversão autorizada e entrega os BRL ao participante Pix; este paga beneficiário confirmado. A Nexa apenas apresenta e acompanha o fluxo conforme o contrato B2B2C.
7. Somente webhook autenticado e conciliação de provider + Pix + ledger alteram o status para **pago**; falhas entram em revisão, sem reenvio cego e sem saldo fictício.
8. Comprovante, taxas finais, status e referência verificável ficam disponíveis ao cliente.

## Dependências que NÃO estão prontas

- Nexa Rails US→BR e PT→BR continuam em modo `preview` e `financialExecutionAllowed=false`, conforme documentação atual do backend.
- Não há parceiro contratado + API homologada + responsabilidade cambial + emissão Pix totalmente verificados nesta branch.
- O app não deve prometer pagamento Pix de carteira estrangeira nem usar env flag para contornar controles financeiros.
- Verificar com parceiro (incluindo a conversa Travelex) se aceita origem em USDC autocustodiado, países/perfis elegíveis, câmbio/cripto, Pix payout, limites, SLAs, chargebacks, Travel Rule e suporte a devolução/erro.
- Revisão regulatória conforme normas BCB vigentes, eFX e cripto, políticas de prevenção a lavagem e sanções, e retenções cautelares aplicáveis.

## Gatilhos para liberação

- Somente a funcionalidade de **watch-only** pode entrar em piloto isolado após testes de integração, RPC, segurança, autenticação e UX. Feature flag default `false`.
- Transferência Nexa → carteira externa: somente pelos fluxos de custódia existentes e habilitados, sem acrescentar executor nesta PR.
- Cripto → Pix: provider ready + corredor ready + cliente KYC/AML ready + quote real + funding/FX/Pix + conciliação ready, validados de ponta a ponta. Não pode depender de aprovação manual enganosa nem ser inferido de mera conexão de endereço.

## Integração com Nexa

- PWA: PR #86 `HenriqueGuilhermeUx/nexa-site` contém a experiência de endereço público e MetaMask browser, ainda isolada.
- App: nova rota `/(app)/external-wallets` da release v148, gated por `EXPO_PUBLIC_NEXA_EXTERNAL_WALLET_WATCH_ENABLED=true` em build específico.
- Reown WalletConnect experimentado anteriormente permanece na própria branch QA separada; **não importar o Reown/AppKit nesta solução**.
- Evitar alteração em Nexa PF/PJ, Nexa Global, Tesouraria, ledger, Privy e backends em produção até revisão.
