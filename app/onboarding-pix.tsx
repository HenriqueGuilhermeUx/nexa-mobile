import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

type PixType = 'CPF' | 'EMAIL' | 'PHONE';

function maskCpf(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11) return 'CPF cadastrado';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

function maskEmail(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  const [name, domain] = raw.split('@');
  if (!name || !domain) return raw || 'E-mail cadastrado';
  return `${name.slice(0, Math.min(2, name.length))}***@${domain}`;
}

function maskPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return 'Telefone cadastrado';
  return `(**) *****-${digits.slice(-4)}`;
}

export default function OnboardingPixScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [selected, setSelected] = useState<PixType>('CPF');
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
        if (me?.kycStatus !== 'approved') {
          router.replace('/kyc' as any);
          return;
        }
        if (me?.pixWithdrawEnabled === true && me?.pixKey && currentType === 'CPF') {
          router.replace('/legacy' as any);
          return;
        }
        setSelected('CPF');
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

  // Woovi D+1 only accepts the customer's own CPF as payout Pix key.
  const options = useMemo(() =>
    profile?.cpf
      ? [{type:'CPF' as const,title:'Usar meu CPF',value:maskCpf(profile.cpf),recommended:true}]
      : [],
    [profile?.cpf],
  );

  async function continueOnboarding() {
    setError('');
    setSaving(true);
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in' as any);
        return;
      }

      await nexaApi.configurePayoutOnboarding(
        session.accessToken,
        'CPF',
      );

      // A subconta é provisionada pelo worker da Nexa em segundo plano. O
      // cliente não precisa esperar a Woovi para continuar o onboarding.
      router.replace('/legacy' as any);
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
      <Title>Escolha seu Pix para resgates</Title>
      <Paragraph>
        Para resgatar valores em reais, a Nexa utiliza exclusivamente o CPF vinculado à sua identidade verificada. Esta etapa não é necessária para adicionar reais.
      </Paragraph>

      <Card>
        <Text style={styles.cardTitle}>Qual chave você quer usar?</Text>
        <Text style={styles.helper}>
          Você não precisa digitar nenhuma chave. Utilizaremos somente o CPF já confirmado em sua conta.
        </Text>

        <View style={styles.options}>
          {options.map((option) => {
            const active = selected === option.type;
            return (
              <TouchableOpacity
                key={option.type}
                activeOpacity={0.84}
                onPress={() => setSelected(option.type)}
                style={[
                  styles.option,
                  active ? styles.optionActive : null,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    {option.recommended ? (
                      <Text style={styles.recommended}>RECOMENDADO</Text>
                    ) : null}
                  </View>
                  <Text style={styles.optionValue}>{option.value}</Text>
                </View>
                <Text style={styles.check}>{active ? '✓' : '○'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Depois disso</Text>
        <Text style={styles.helper}>
          A Nexa solicita e reconcilia a subconta com o provedor. A confirmação pode levar algum tempo e não altera o acesso à carteira nem aos depósitos. Caso não haja CPF verificado, procure a Central Nexa.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label="Configurar CPF para resgates"
        loading={saving || loading}
        disabled={loading || options.length === 0}
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
