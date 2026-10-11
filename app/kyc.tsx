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
import { config } from '@/config';
import { BrazilKycStatus, nexaApi } from '@/lib/api';
import { shouldShowEcosystemWelcome } from '@/lib/ecosystemOnboarding';
import { resolveAuthenticatedRoute } from '@/lib/onboarding';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function statusLabel(
  status: BrazilKycStatus | null | undefined,
  globalProduct: boolean,
) {
  if (status?.kycStatus === 'approved') {
    return globalProduct ? 'Identity verified' : 'Identidade verificada';
  }
  if (status?.nextAction === 'manual_review') {
    return globalProduct ? 'Under review' : 'Em revisão';
  }
  if (status?.nextAction === 'document_fallback') {
    return globalProduct
      ? 'Additional verification required'
      : 'Verificação adicional necessária';
  }
  if (status?.nextAction === 'retry_selfie') {
    return globalProduct ? 'New selfie required' : 'Nova selfie necessária';
  }
  if (status?.diditSessionStatus) return status.diditSessionStatus;
  return globalProduct ? 'Pending' : 'Pendente';
}

function actionLabel(
  status: BrazilKycStatus | null | undefined,
  globalProduct: boolean,
) {
  if (status?.nextAction === 'resume_verification') {
    return globalProduct ? 'Continue verification' : 'Continuar verificação';
  }
  if (status?.nextAction === 'document_fallback') {
    return globalProduct ? 'Continue with document' : 'Continuar com documento';
  }
  if (status?.nextAction === 'retry_selfie') {
    return globalProduct ? 'Retake selfie' : 'Refazer selfie';
  }
  return globalProduct ? 'Start verification' : 'Começar verificação';
}

function friendlyKycError(caught: unknown, globalProduct: boolean) {
  const raw = caught instanceof Error ? caught.message : '';
  if (!raw) {
    return globalProduct
      ? 'We could not refresh your verification right now.'
      : 'Não conseguimos atualizar sua verificação agora.';
  }
  if (/Didit|request|fetch|500|502|503|504/i.test(raw)) {
    return globalProduct
      ? 'We could not complete this step right now. Your submitted data was not deleted; try again shortly.'
      : 'Não conseguimos concluir esta etapa agora. Seus dados enviados não foram apagados; tente novamente em alguns instantes.';
  }
  return raw;
}

export default function KycScreen() {
  const [status, setStatus] = useState<BrazilKycStatus | null>(null);
  const [countryCode, setCountryCode] = useState('BR');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const globalProduct = config.globalProduct;

  async function continueAfterApproval(accessToken: string) {
    const profile = await nexaApi.me(accessToken);

    if (await shouldShowEcosystemWelcome(profile)) {
      router.replace('/ecosystem-welcome' as any);
      return;
    }

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
      setError(friendlyKycError(caught, globalProduct));
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
        throw new Error(globalProduct ? 'The identity provider did not return a verification link.' : 'A Didit não retornou o link de verificação.');
      }

      await Linking.openURL(next.verificationUrl);
    } catch (caught) {
      setError(friendlyKycError(caught));
    } finally {
      setStarting(false);
    }
  }

  const manualReview = status?.nextAction === 'manual_review';
  const approved = status?.kycStatus === 'approved';

  return (
    <Screen>
      <Brand />
      <Badge tone="info">{globalProduct ? 'STEP 1 OF 4' : 'PASSO 1 DE 4'}</Badge>
      <Title>
        {globalProduct ? "Let's confirm it's you" : 'Vamos confirmar que é você'}
      </Title>
      <Paragraph>
        {globalProduct
          ? 'Identity verification protects your account and unlocks eligible Nexa Global features. This step runs in the identity provider’s secure flow.'
          : 'A verificação ajuda a proteger sua conta e libera as funcionalidades da Nexa. A etapa é feita em ambiente seguro do provedor de identidade.'}
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
          {loading ? (globalProduct ? 'Checking…' : 'Consultando...') : statusLabel(status, globalProduct)}
        </Badge>

        <View style={styles.steps}>
          <View style={styles.stepRow}>
            <Text style={styles.stepIndex}>1</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{globalProduct ? 'Identity' : 'Identificação'}</Text>
              <Text style={styles.step}>{globalProduct ? 'We confirm the basic details from your registration.' : 'Confirmamos os dados básicos do seu cadastro.'}</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepIndex}>2</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>
                {globalProduct
                  ? 'Document and liveness'
                  : countryCode === 'BR'
                    ? 'Selfie e documento quando necessário'
                    : 'Documento e prova de vida'}
              </Text>
              <Text style={styles.step}>
                {globalProduct
                  ? 'The provider requests only what is needed to verify your identity.'
                  : 'O provedor solicita apenas o necessário para validar sua identidade.'}
              </Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepIndex}>3</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{globalProduct ? 'Validation' : 'Validação'}</Text>
              <Text style={styles.step}>{globalProduct ? 'Nexa continues onboarding only after approval.' : 'A Nexa continua o onboarding somente depois da aprovação.'}</Text>
            </View>
          </View>
        </View>
      </Card>

      {manualReview ? (
        <Card>
          <Text style={styles.warningTitle}>{globalProduct ? 'Verification under review' : 'Verificação em análise'}</Text>
          <Text style={styles.helper}>
            {globalProduct
              ? 'Your verification needs review. Do not restart the process or send another document unless the provider asks you to.'
              : 'Encontramos um resultado que precisa de revisão. Não é necessário repetir o processo nem enviar outro documento por conta própria.'}
          </Text>
          <Text style={styles.helper}>
            {globalProduct
              ? 'You can close the app. When you return, Nexa checks the latest result and continues onboarding from the correct step.'
              : 'Você pode fechar o app. Quando voltar, a Nexa consulta o resultado automaticamente e continua o onboarding do ponto certo.'}
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.consentTitle}>{globalProduct ? 'Before you continue' : 'Antes de continuar'}</Text>
          <Text style={styles.helper}>
            {globalProduct
              ? `By tapping “${actionLabel(status, globalProduct)}”, you authorize the processing needed to verify your identity and liveness. Nexa uses the provider-hosted flow to keep identity verification separate from the financial experience whenever possible.`
              : `Ao tocar em “${actionLabel(status, globalProduct)}”, você autoriza o tratamento dos dados necessários para confirmar sua identidade e prova de vida. A Nexa usa o fluxo hospedado do provedor para manter essa etapa separada da experiência financeira sempre que possível.`}
          </Text>
          <ActionButton
            label={actionLabel(status, globalProduct)}
            loading={starting}
            disabled={loading || approved}
            onPress={startVerification}
          />
        </Card>
      )}

      <ActionButton
        label={globalProduct ? 'Refresh status' : 'Atualizar status'}
        variant="secondary"
        disabled={starting}
        onPress={refreshStatus}
      />

      {status?.outcomeCode ? (
        <Text style={styles.code}>
          {globalProduct ? 'Reference' : 'Referência'}: {status.outcomeCode}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { marginTop: spacing.md, gap: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.primarySoft,
    color: colors.cyan,
    fontWeight: '900',
    marginRight: spacing.sm,
  },
  stepBody: { flex: 1 },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  step: { color: colors.muted, fontSize: 13, lineHeight: 20 },
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
