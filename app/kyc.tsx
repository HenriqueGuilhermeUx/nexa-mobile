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
    return 'Continuar com documento';
  }
  if (status?.nextAction === 'retry_selfie') return 'Refazer selfie';
  return 'Começar verificação';
}

function friendlyKycError(caught: unknown) {
  const raw = caught instanceof Error ? caught.message : '';
  if (!raw) return 'Não conseguimos atualizar sua verificação agora.';
  if (/Didit|request|fetch|500|502|503|504/i.test(raw)) {
    return 'Não conseguimos concluir esta etapa agora. Seus dados enviados não foram apagados; tente novamente em alguns instantes.';
  }
  return raw;
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
      setError(friendlyKycError(caught));
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
      <Badge tone="info">PASSO 1 DE 4</Badge>
      <Title>Vamos confirmar que é você</Title>
      <Paragraph>
        A verificação ajuda a proteger sua conta e libera as funcionalidades da Nexa. A etapa é feita em ambiente seguro do provedor de identidade.
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
          <View style={styles.stepRow}>
            <Text style={styles.stepIndex}>1</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Identificação</Text>
              <Text style={styles.step}>Confirmamos os dados básicos do seu cadastro.</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepIndex}>2</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>
                {countryCode === 'BR' ? 'Selfie e documento quando necessário' : 'Documento e prova de vida'}
              </Text>
              <Text style={styles.step}>
                O provedor solicita apenas o necessário para validar sua identidade.
              </Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepIndex}>3</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Validação</Text>
              <Text style={styles.step}>A Nexa continua o onboarding somente depois da aprovação.</Text>
            </View>
          </View>
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
          <Text style={styles.consentTitle}>Antes de continuar</Text>
          <Text style={styles.helper}>
            Ao tocar em “{actionLabel(status)}”, você autoriza o tratamento dos dados necessários para confirmar sua identidade e prova de vida. A Nexa usa o fluxo hospedado do provedor para manter essa etapa separada da experiência financeira sempre que possível.
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
