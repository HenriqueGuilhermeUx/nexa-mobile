import {
  getEmbeddedConnectedWallet,
  useCreateWallet,
  useLoginWithEmail,
  usePrivy,
  useSignMessage,
  useWallets,
} from '@privy-io/react-auth';

import type { NexaPrivyWallet } from './privyBridge';

export function useNexaPrivy() {
  const privy = usePrivy();
  const emailLogin = useLoginWithEmail();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signMessage } = useSignMessage();

  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const normalizedWallets: NexaPrivyWallet[] = embeddedWallet
    ? [
        {
          address: embeddedWallet.address,
          id: (embeddedWallet as any).id || embeddedWallet.address,
          walletId: (embeddedWallet as any).id || null,
          wallet_id: (embeddedWallet as any).id || null,
        },
      ]
    : [];

  return {
    ready: Boolean(privy.ready && walletsReady),
    wallets: normalizedWallets,
    async getAccessToken() {
      return String((await privy.getAccessToken()) || '').trim();
    },
    async sendEmailCode(input: { email: string; disableSignup?: boolean }) {
      await emailLogin.sendCode(input);
    },
    async loginWithEmailCode(input: { email: string; code: string }) {
      // The React SDK keeps the email flow state after sendCode, so only the
      // OTP is passed at verification time.
      await emailLogin.loginWithCode({ code: input.code });
    },
    async createWallet() {
      const wallet = await createWallet();
      return {
        ...wallet,
        id: (wallet as any).id || wallet.address,
      };
    },
    async signMessage(wallet: NexaPrivyWallet, message: string) {
      const result = await signMessage(
        { message },
        {
          address: wallet.address,
          uiOptions: {
            showWalletUIs: false,
          },
        },
      );
      return String(result.signature || '');
    },
  };
}
