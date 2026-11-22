import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function maskCpf(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11) return 'CPF cadastrado';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

/**
 * Nexa Brazil cash-out uses the customer's own CPF through Woovi D+1.
 * No alternate email/phone Pix selection: the server already enforces CPF.
 * This screen is a fallback for missing payout setup, not an extra consent
 * step. Once KYC is approved we configure idempotently, then continue.
 */
export default function OnboardingPixScreen() {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function ensureOwnCpfPayout() {
    setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in' as any);
        return;
      }

      const profile = await nexaApi.me(session.accessToken);
      const country = String(profile?.residenceCountry || 'BR').toUpperCase();
      if (country !== 'BR') {
        router.replace('/onboarding-wallet' as any);
        return;
      }

      if (String(profile?.kycStatus || '').toLowerCase() !== 'approved') {
        // The Woovi D+1 beneficiary cannot be configured before verified KYC.
        router.replace('/kyc' as any);
        return;
      }

      const digits = String(profile?.cpf || '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
        setError('Seu CPF precisa estar confirmado no cadastro antes de ativar resgates Pix.');
        return;
      }
      setCpf(digits);

      const currentPixType = String(profile?.pixKeyType || '').toUpperCase();
      const currentPix = String(profile?.pixKey || '').replace(/\D/g, '');
      const alreadyConfigured =
        profile?.pixWithdrawEnabled === true &&
        currentPixType === 'CPF' &&
        currentPix === digits;

      if (!alreadyConfigured) {
        // The backend verifies KYC and refuses to overwrite preexisting
        // non-CPF provider profiles without explicit provider reconciliation.
        await nexaApi.configurePayoutOnboarding(session.accessToken, 'CPF');
      }

      // D+1 provider activation is asynchronous; no duplicate subaccount
      // creation is attempted by this screen. The backend must fail closed
      // for withdrawal until the subaccount is confirmed.
      router.replace('/onboarding-wallet' as any);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não conseguimos preparar o Pix de resgate agora. Seus fundos permanecem na carteira.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void ensureOwnCpfPayout();
  }, []);

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Badge tone="info">RESGATE PIX</Badge>
      <Title>Resgates pelo seu CPF</Title>
      <Paragraph>
        A Nexa usa o CPF confirmado na sua identidade para preparar os
        resgates em reais pela Woovi. Você não precisa escolher nem digitar
        uma chave Pix.
      </Paragraph>

      <Card>
        <Text style={styles.heading}>Chave Pix do titular</Text>
        <Text style={styles.value}>{maskCpf(cpf)}</Text>
        <Text style={styles.helper}>
          {loading
            ? 'Conferindo sua configuração de resgate…'
            : error
              ? 'Nenhuma conta adicional foi criada automaticamente.'
              : 'Configuração confirmada.'}
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {error ? (
        <ActionButton
          label="Tentar novamente"
          loading={loading}
          disabled={loading}
          onPress={() => { void ensureOwnCpfPayout(); }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.md },
  heading: { color: colors.text, fontSize: 16, fontWeight: '900' },
  value: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: spacing.sm },
  helper: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
