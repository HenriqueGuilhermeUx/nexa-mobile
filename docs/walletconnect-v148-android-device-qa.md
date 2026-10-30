# Nexa Wallet Connect — homologação Android em dispositivo real

Escopo: PR #103, somente a variante `br.com.trynexa.walletconnectqa` (`wallet-inbound-lab`). Este documento **não autoriza ativação financeira**, merge, EAS production, OTA ou Play Store.

## Gate anterior à conexão Reown

- [ ] GitHub Mobile CI, Assistant/Open Finance CI e Wallet Connect forward-port QA completos no mesmo HEAD.
- [ ] Validar projeto Reown, domínio permitido, bundle QA, termos e limites diretamente no painel do provedor.
- [ ] Confirmar configuração do retorno `nexa-walletconnect-qa://` em aparelho (não reutilizar scheme/package da versão 148).
- [ ] Compilar APK interno autônomo com o package QA, OTA desativada, backend staging, `EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED=false` e `ledgerOperationsEnabled=false`.
- [ ] Somente após os gates acima: habilitar Reown na variante QA, com ID de projeto válido e aprovações verificadas. Nunca copiar essas flags para produção.

## Matriz de aparelho (sem transações)

- [ ] Instalar junto da Nexa Play Store 2.0.43 (148), sem sobrescrever a versão dos clientes.
- [ ] Efetuar login QA válido, fechar/reabrir o app, testar logout e login com outro usuário. A carteira externa do primeiro usuário **não** pode permanecer conectada para o segundo.
- [ ] Conectar MetaMask na rede Polygon; confirmar retorno pelo deep link, endereço EVM e chain ID 137.
- [ ] Repetir com Trust Wallet e Coinbase Wallet, quando disponíveis no aparelho; registrar suporte real, não presumido.
- [ ] Recusar ou sinalizar rede Ethereum/Base e carteira não-EVM. Trocar contas dentro da carteira deve invalidar saldo/validação anterior.
- [ ] Validar que fechar modal, cancelar conexão, negar permissão, perder rede, reabrir app e desconectar não deixam estado autenticado antigo.
- [ ] Verificar USDC nativo da Polygon (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) por leitura e distinguir saldo externo do saldo Nexa.
- [ ] Abrir prévia de entrada: endereço destinatário deve ser confirmado pelo backend/Privy autenticado; nenhum `sendTransaction` deve ocorrer.
- [ ] Abrir prévia de saída: destino conectado só preenche a tela Custody existente e a execução deve permanecer bloqueada.
- [ ] Regressão da Wallet atual: login, Pix entrada, Pix saída, QR Privy, extrato, envio existente, saldo, perfil e navegação, usando QA/mocks, sem fundos reais.
- [ ] Registrar evidências: modelo Android, versão OS, carteira e versão, endereço mascarado, chain, captura, resultado e bug reproduzível (sem seed, chave, token, CPF ou segredo).

## Critérios para não liberar

Não preparar AAB Play Store até haver evidência de conexão/retorno real, assinatura/autorização revisada, entrada USDC confirmada on-chain e reconciliada sem duplicidade, saída USDC via fluxo Privy existente com autorização, testes de regressão e segurança. Consultas de saldo, previews e CIs verdes **não** comprovam transferência funcional.

Release, transferência de fundos de clientes, alteração de tesouraria, merge e deploy permanecem fora do escopo desta PR.
