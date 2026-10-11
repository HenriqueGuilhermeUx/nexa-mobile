import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import {
  ActionButton,
  Brand,
  Card,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { config } from '@/config';
import { nexaApi } from '@/lib/api';
import { GLOBAL_JURISDICTIONS } from '@/lib/globalProduct';
import { colors, radius, spacing } from '@/theme';

const BRAZIL_COUNTRIES = [
  { code: 'BR', label: 'Brasil' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'PT', label: 'Portugal' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'ES', label: 'Espanha' },
  { code: 'CA', label: 'Canadá' },
] as const;

const GLOBAL_COUNTRIES = GLOBAL_JURISDICTIONS.map((country) => ({
  code: country.code,
  label: country.label,
}));

export default function SignUpCountryScreen() {
  const [loadingCountry, setLoadingCountry] = useState('');
  const [message, setMessage] = useState('');
  const globalProduct = config.globalProduct;
  const countries = globalProduct ? GLOBAL_COUNTRIES : BRAZIL_COUNTRIES;

  async function selectCountry(countryCode: string, label: string) {
    setLoadingCountry(countryCode);
    setMessage('');

    try {
      const capability = await nexaApi.countryCapabilities(countryCode);

      if (
        countryCode === 'BR' ||
        capability?.onboarding?.registrationEnabled === true
      ) {
        router.push({
          pathname: '/sign-up',
          params: { countryCode },
        } as any);
        return;
      }

      setMessage(
        globalProduct
          ? `Nexa Global for ${label} is being prepared. Registration opens only when KYC and the required compliance policy for that country are enabled.`
          : `A Conta Global Nexa para ${label} está em preparação. O cadastro será liberado quando KYC e os rails locais desse país estiverem habilitados.`,
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : globalProduct
            ? 'We could not confirm availability for this country right now.'
            : 'Não foi possível consultar a disponibilidade neste país.',
      );
    } finally {
      setLoadingCountry('');
    }
  }

  return (
    <Screen>
      <Brand />
      <Title>{globalProduct ? 'Where do you live?' : 'Onde você mora?'}</Title>
      <Paragraph>
        {globalProduct
          ? 'Nexa Global adapts identity verification and supported funding methods to your country of residence. Your Global balance remains USDC-first.'
          : 'A Nexa adapta verificação de identidade, formas de adicionar dinheiro e saques ao país de residência. O Brasil continua disponível normalmente.'}
      </Paragraph>

      <Card>
        {countries.map((country) => (
          <ActionButton
            key={country.code}
            label={country.label}
            variant={(globalProduct ? country.code === 'US' : country.code === 'BR') ? 'primary' : 'secondary'}
            loading={loadingCountry === country.code}
            disabled={Boolean(loadingCountry)}
            onPress={() => selectCountry(country.code, country.label)}
          />
        ))}
      </Card>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <ActionButton
        label={globalProduct ? 'I already have an account' : 'Já tenho conta'}
        variant="secondary"
        disabled={Boolean(loadingCountry)}
        onPress={() => router.replace('/sign-in')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    color: colors.muted,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
