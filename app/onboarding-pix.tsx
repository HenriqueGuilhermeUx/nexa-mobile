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
        if (
          me?.pixWithdrawEnabled === true &&
          me?.pixKey &&
          ['CPF', 'EMAIL', 'PHONE'].includes(currentType)
        ) {
          router.replace('/onboarding-wallet' as any);
          return;
        }

        if (!me?.cpf && me?.email) setSelected('EMAIL');
        else setSelected('CPF');
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

  const options = useMemo(
    () =>
      [
        profile?.cpf
          ? {
              type: 'CPF' as const,
              title: 'Usar meu CPF',
              value: maskCpf(profile.cpf),
              recommended: true,
            }
          : null,
        profile?.email
          ? {
              type: 'EMAIL' as const,
              title: 'Usar meu e-mail',
              value: maskEmail(profile.email),
              recommended: false,
            }
          : null,
        profile?.phone
          ? {
              type: 'PHONE' as const,
              title: 'Usar meu telefone',
              value: maskPhone(profile.phone),
              recommended: false,
            }
          : null,
      ].filter(Boolean) as Array<{
        type: PixType;
        title: string;
        value: string;
        recommended: boolean;
      }>,
    [profile],
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
        selected,
      );

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
      <Title>Onde você quer receber seus resgates?</Title>
      <Paragraph>
        Quando você transformar USDC em reais, a Nexa enviará o Pix para esta
        chave. Recomendamos seu CPF por ser o caminho mais simples e seguro.
      </Paragraph>

      <Card>
        <Text style={styles.cardTitle}>Escolha uma chave sua</Text>
        <Text style={styles.helper}>
          Para sua segurança, usamos apenas CPF, e-mail ou telefone que já
          pertencem ao seu cadastro Nexa verificado.
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
        <Text style={styles.cardTitle}>Sua conta de resgate</Text>
        <Text style={styles.helper}>
          Depois da confirmação, a Nexa prepara sua subconta de resgate em
          segundo plano. Você pode continuar usando o app sem esperar.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label="Confirmar Pix e continuar"
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
