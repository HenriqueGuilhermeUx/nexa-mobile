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

function nextAfterKyc() {
  return config.walletV15PilotMode
    ? ('/onboarding-wallet' as any)
    : ('/legacy' as any);
}

export default function KycScreen() {
  const [status, setStatus] = useState<BrazilKycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const refreshStatus = useCallback(async () => {
    const session = await loadNexaSession();
    if (!session) {
      router.replace('/sign-in' as any);
      return;
    }

    try {
      const next = await nexaApi.getMyKycStatus(session.accessToken);
      setStatus(next);
      setError('');
      if (next.kycStatus === 'approved' || next.nextAction === 'approved') {
        router.replace(nextAfterKyc());
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
      const next = await nexaApi.startBrazilKyc(session.accessToken, true);
      setStatus(next);

      if (next.kycStatus === 'approved' || next.nextAction === 'approved') {
        router.replace(nextAfterKyc());
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
      <Title>Verifique sua identidade</Title>
      <Paragraph>
        Para liberar as movimentações da Nexa, confirme que o CPF pertence a
        você. No fluxo brasileiro, a verificação normalmente usa apenas CPF e
        uma selfie com prova de vida.
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
        </View>
      </Card>

      {manualReview ? (
        <Card>
          <Text style={styles.warningTitle}>Verificação em análise</Text>
          <Text style={styles.helper}>
            Encontramos um resultado que precisa de revisão. Não é necessário
            repetir o processo nem enviar outro documento por conta própria.
          </Text>
          <ActionButton
            label="Entrar na Nexa"
            variant="secondary"
            onPress={() => router.replace('/legacy' as any)}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.consentTitle}>Consentimento biométrico</Text>
          <Text style={styles.helper}>
            Ao tocar em “{actionLabel(status)}”, você autoriza o tratamento dos
            dados necessários para a verificação de identidade e prova de vida
            pela Nexa e por seu provedor de verificação. A Nexa não precisa
            receber a imagem da selfie neste fluxo hospedado.
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

      {!approved && !config.walletV15PilotMode ? (
        <ActionButton
          label="Entrar na Nexa e verificar depois"
          variant="secondary"
          disabled={starting}
          onPress={() => router.replace('/legacy' as any)}
        />
      ) : null}

      {config.walletV15PilotMode ? (
        <Text style={styles.code}>Piloto Wallet V1.5 • KYC obrigatório</Text>
      ) : status?.outcomeCode ? (
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
