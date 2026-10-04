import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  AppState,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { BrazilKycStatus, nexaApi } from '@/lib/api';
import { resolveAuthenticatedRoute } from '@/lib/onboarding';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function statusLabel(status?: BrazilKycStatus | null) {
  if (status?.kycStatus === 'approved') return 'Identidade verificada';
  if (status?.nextAction === 'manual_review') return 'Em revisão';
  if (status?.nextAction === 'document_fallback') {
    return 'Verificação adicional necessária';
  }
  if (status?.nextAction === 'retry_selfie') return 'Nova selfie necessária';
  if (status?.diditSessionStatus) return status.diditSessionStatus;
  return 'Pendente';
}

function actionLabel(status?: BrazilKycStatus | null) {
  if (status?.nextAction === 'resume_verification') return 'Continuar verificação';
  if (status?.nextAction === 'document_fallback') {
    return 'Continuar verificação com documento';
  }
  if (status?.nextAction === 'retry_selfie') return 'Refazer selfie';
  return 'Concordo e verificar identidade';
}

export default function KycScreen() {
  const [status, setStatus] = useState<BrazilKycStatus | null>(null);
  const [countryCode, setCountryCode] = useState('BR');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function continueAfterApproval(accessToken: string) {
    const profile = await nexaApi.me(accessToken);
    const target = await resolveAuthenticatedRoute(profile, accessToken);
    router.replace(target as any);
  }

  const refreshStatus = useCallback(async () => {
    const session = await loadNexaSession();
    if (!session) {
      router.replace('/sign-in' as any);
      return;
    }

    try {
      const profile = await nexaApi.me(session.accessToken);
      const country = String(profile?.residenceCountry || 'BR')
        .trim()
        .toUpperCase();
      setCountryCode(country);

      const next =
        country === 'BR'
          ? await nexaApi.getMyKycStatus(session.accessToken)
          : await nexaApi.getMyGlobalKycStatus(session.accessToken);
      setStatus(next);
      setError('');
      if (next.kycStatus === 'approved' || next.nextAction === 'approved') {
        await continueAfterApproval(session.accessToken);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível atualizar a verificação.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshStatus();
    });
    return () => subscription.remove();
  }, [refreshStatus]);

  async function startVerification() {
    const session = await loadNexaSession();
    if (!session) {
      router.replace('/sign-in' as any);
      return;
    }

    setStarting(true);
    setError('');
    try {
      // O toque neste botão representa consentimento explícito informado para
      // iniciar a verificação de identidade descrita na própria tela.
      const profile = await nexaApi.me(session.accessToken);
      const country = String(profile?.residenceCountry || countryCode || 'BR')
        .trim()
        .toUpperCase();
      setCountryCode(country);

      const next =
        country === 'BR'
          ? await nexaApi.startBrazilKyc(session.accessToken, true)
          : await nexaApi.startGlobalKyc(session.accessToken, true);
      setStatus(next);

      if (next.kycStatus === 'approved' || next.nextAction === 'approved') {
        await continueAfterApproval(session.accessToken);
        return;
      }

      if (next.nextAction === 'manual_review') return;

      if (!next.verificationUrl) {
        throw new Error('A Didit não retornou o link de verificação.');
      }

      await Linking.openURL(next.verificationUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível iniciar a verificação.',
      );
    } finally {
      setStarting(false);
    }
  }

  const manualReview = status?.nextAction === 'manual_review';
  const approved = status?.kycStatus === 'approved';

  return (
    <Screen>
      <Brand />
      <Badge tone="info">PASSO 1 DE 4</Badge>
      <Title>Verifique sua identidade</Title>
      <Paragraph>
        {countryCode === 'BR'
          ? 'Para liberar as movimentações da Nexa, confirme que o CPF pertence a você. No fluxo brasileiro, a verificação normalmente usa CPF e selfie com prova de vida.'
          : 'Para liberar as movimentações da Nexa, confirme sua identidade com um documento aceito no seu país de residência e a prova de vida solicitada pelo provedor.'}
      </Paragraph>

      <Card>
        <Badge
          tone={
            approved
              ? 'success'
              : manualReview
                ? 'warning'
                : 'info'
          }
        >
          {loading ? 'Consultando...' : statusLabel(status)}
        </Badge>

        <View style={styles.steps}>
          {countryCode === 'BR' ? (
            <>
              <Text style={styles.step}>1. Seu CPF já está cadastrado na Nexa.</Text>
              <Text style={styles.step}>
                2. A Didit faz uma selfie com prova de vida.
              </Text>
              <Text style={styles.step}>
                3. A identidade é comparada com a base biométrica disponível para o
                CPF no Brasil.
              </Text>
              <Text style={styles.step}>
                4. Documento só é solicitado quando a validação não consegue dar
                uma resposta conclusiva.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.step}>
                1. A Nexa usa seu país de residência para selecionar o fluxo correto.
              </Text>
              <Text style={styles.step}>
                2. Você apresenta um documento aceito pelo provedor nesse país.
              </Text>
              <Text style={styles.step}>
                3. A prova de vida confirma que o documento pertence a você.
              </Text>
              <Text style={styles.step}>
                4. A Nexa continua o onboarding somente depois da aprovação.
              </Text>
            </>
          )}
        </View>
      </Card>

      {manualReview ? (
        <Card>
          <Text style={styles.warningTitle}>Verificação em análise</Text>
          <Text style={styles.helper}>
            Encontramos um resultado que precisa de revisão. Não é necessário
            repetir o processo nem enviar outro documento por conta própria.
          </Text>
          <Text style={styles.helper}>
            Você pode fechar o app. Quando voltar, a Nexa consulta o resultado
            automaticamente e continua o onboarding do ponto certo.
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.consentTitle}>Consentimento biométrico</Text>
          <Text style={styles.helper}>
            Ao tocar em “{actionLabel(status)}”, você autoriza o tratamento dos
            dados necessários para a verificação de identidade e prova de vida
            pela Nexa e por seu provedor de verificação. A Nexa evita armazenar
            imagens de documento ou selfie quando o fluxo hospedado do provedor
            permite manter esses artefatos fora da infraestrutura da Nexa.
          </Text>
          <ActionButton
            label={actionLabel(status)}
            loading={starting}
            disabled={loading || approved}
            onPress={startVerification}
          />
        </Card>
      )}

      <ActionButton
        label="Atualizar status"
        variant="secondary"
        disabled={starting}
        onPress={refreshStatus}
      />

      {status?.outcomeCode ? (
        <Text style={styles.code}>Referência: {status.outcomeCode}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { marginTop: spacing.md, gap: spacing.sm },
  step: { color: colors.text, fontSize: 15, lineHeight: 22 },
  consentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  helper: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  code: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
