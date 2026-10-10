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
import { nexaApi } from '@/lib/api';
import { GLOBAL_JURISDICTIONS } from '@/lib/globalProduct';
import { colors, radius, spacing } from '@/theme';

const countries = GLOBAL_JURISDICTIONS.map((country) => ({
  code: country.code,
  label: country.label,
  documentHint: country.documentHint,
}));

export default function SignUpCountryScreen() {
  const [loadingCountry, setLoadingCountry] = useState('');
  const [message, setMessage] = useState('');

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
        `Nexa Global for ${label} is being prepared. Registration opens only when KYC and the required compliance policy for that country are enabled.`,
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'We could not confirm availability for this country right now.',
      );
    } finally {
      setLoadingCountry('');
    }
  }

  return (
    <Screen>
      <Brand />
      <Title>Where do you live?</Title>
      <Paragraph>
        Nexa Global adapts identity verification and supported funding methods
        to your country of residence. Your Global balance remains USDC-first.
      </Paragraph>

      <Card>
        {countries.map((country) => (
          <ActionButton
            key={country.code}
            label={country.label}
            variant={country.code === 'US' ? 'primary' : 'secondary'}
            loading={loadingCountry === country.code}
            disabled={Boolean(loadingCountry)}
            onPress={() => selectCountry(country.code, country.label)}
          />
        ))}
      </Card>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <ActionButton
        label="I already have an account"
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
