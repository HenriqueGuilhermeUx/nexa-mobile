// Rota isolada do piloto Wallet-First.
// Reutiliza exatamente o fluxo de ownership já validado no main para evitar
// uma segunda implementação de assinatura Privy/EIP-191.
export { default } from './wallet-ownership';
