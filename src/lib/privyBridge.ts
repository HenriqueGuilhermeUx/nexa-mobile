import { useEmbeddedEthereumWallet, useLoginWithEmail, usePrivy } from '@privy-io/expo';

export type NexaPrivyWallet = {
  address: string;
  id?: string | null;
  walletId?: string | null;
  wallet_id?: string | null;
  [key: string]: unknown;
};

function messageToHex(message: string) {
  const bytes = new TextEncoder().encode(message);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function providerFor(wallet: any) {
  if (typeof wallet?.getProvider === 'function') return wallet.getProvider();
  if (typeof wallet?.getEthereumProvider === 'function') {
    return wallet.getEthereumProvider();
  }
  throw new Error('Your wallet is not ready for ownership verification.');
}

export function useNexaPrivy() {
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const emailLogin = useLoginWithEmail() as any;
  const wallets = (embedded.wallets || []) as NexaPrivyWallet[];

  return {
    ready: Boolean(privy?.isReady),
    wallets,
    async getAccessToken() {
      if (typeof privy?.getAccessToken !== 'function') return '';
      return String((await privy.getAccessToken()) || '').trim();
    },
    async sendEmailCode(input: { email: string; disableSignup?: boolean }) {
      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('Email confirmation is not available in this version.');
      }
      await emailLogin.sendCode(input);
    },
    async loginWithEmailCode(input: { email: string; code: string }) {
      if (typeof emailLogin?.loginWithCode !== 'function') {
        throw new Error('Code verification is not available in this version.');
      }
      await emailLogin.loginWithCode(input);
    },
    async createWallet() {
      if (typeof embedded?.create !== 'function') {
        throw new Error('Wallet creation is not available on this device.');
      }
      return embedded.create({ createAdditional: false });
    },
    async signMessage(wallet: NexaPrivyWallet, message: string) {
      const provider = await providerFor(wallet);
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('Your wallet is not ready for ownership verification.');
      }
      return String(
        (await provider.request({
          method: 'personal_sign',
          params: [messageToHex(message), wallet.address],
        })) || '',
      );
    },
  };
}
