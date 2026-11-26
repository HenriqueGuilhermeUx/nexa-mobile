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

export default function OnboardingPixScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [legacyReview,setLegacyReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in' as any);
          return;
        }
        const me = await nexaApi.me(session.accessToken);
        if (!mounted) return;
        setProfile(me);

        const currentType = String(me?.pixKeyType || '').toUpperCase();
        if (me?.pixWithdrawEnabled === true && me?.pixKey && currentType === 'CPF') {
          router.replace('/onboarding-wallet' as any);
          return;
        }
        if (me?.pixWithdrawEnabled === true && me?.pixKey && currentType !== 'CPF') {
          // Never replace a legacy provider-bound key from the app.
          setLegacyReview(true);
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível carregar seus dados de resgate.',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function continueOnboarding() {
    setError('');
    if (legacyReview) {
      router.replace('/onboarding-wallet' as any);
      return;
    }
    if (String(profile?.cpf || '').replace(/\D/g,'').length !== 11) {
      setError('CPF do titular indisponível ou incompleto. Conclua a verificação de identidade antes de configurar resgates.');
      return;
    }
    setSaving(true);
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in' as any);
        return;
      }

      await nexaApi.configurePayoutOnboarding(session.accessToken, 'CPF');

      // A subconta é provisionada pelo worker da Nexa em segundo plano. O
      // cliente não precisa esperar a Woovi para continuar o onboarding.
      router.replace('/onboarding-wallet' as any);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível salvar seu Pix de resgate.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Badge tone="info">PASSO 2 DE 4</Badge>
      <Title>Resgates somente para Pix CPF</Title>
      <Paragraph>
        Os resgates da Nexa são enviados exclusivamente para a chave Pix CPF do titular da conta.
        Não é possível utilizar telefone, e-mail ou chave aleatória.
      </Paragraph>
      <Card>
        <Text style={styles.cardTitle}>Seu CPF para receber resgates</Text>
        <Text style={styles.optionValue}>{profile?.cpf ? maskCpf(profile.cpf) : 'CPF não disponível'}</Text>
        <Text style={styles.helper}>
          O CPF precisa estar cadastrado como chave Pix em um banco ou instituição de pagamento
          no seu nome. A Nexa não cria a chave Pix no seu banco.
        </Text>
        {legacyReview ? (
          <Text style={styles.error}>
            Há uma configuração antiga de resgate com outra chave Pix. O resgate fica sujeito
            a revisão pela Nexa. Você pode continuar para a carteira, mas não haverá
            substituição automática da subconta nem pagamento por telefone ou e-mail.
          </Text>
        ) : !profile?.cpf ? (
          <Text style={styles.error}>
            Conclua a verificação de identidade para disponibilizar o CPF nesta etapa.
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Depois disso</Text>
        <Text style={styles.helper}>
          A Nexa prepara a infraestrutura de resgate em segundo plano. Você continua o onboarding sem precisar configurar banco ou provedor.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label={legacyReview ? 'Continuar para a carteira (resgate em revisão)' : 'Confirmar Pix CPF'}
        loading={saving || loading}
        disabled={loading || (!legacyReview && String(profile?.cpf || '').replace(/\D/g,'').length !== 11)}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.md },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  options: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.panelSoft,
  },
  optionActive: {
    borderColor: colors.primary,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  optionValue: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
  },
  recommended: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  check: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
