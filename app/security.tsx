import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { config } from '@/config';
import {
  authenticateDevice,
  disableAppLock,
  enableAppLock,
  getAppLockCapability,
  isAppLockEnabled,
  type AppLockCapability,
} from '@/lib/appLock';
import {
  ActionButton,
  Badge,
  Brand,
  Card,
  KeyValue,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

const EMPTY_CAPABILITY: AppLockCapability = {
  available: false,
  enrolledLevel: 0,
  strongBiometric: false,
  deviceCredential: false,
  authenticationTypes: [],
};

export default function SecurityScreen() {
  const [enabled, setEnabled] = useState(false);
  const [capability, setCapability] = useState<AppLockCapability>(EMPTY_CAPABILITY);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [nextEnabled, nextCapability] = await Promise.all([
      isAppLockEnabled(),
      getAppLockCapability(),
    ]);
    setEnabled(nextEnabled);
    setCapability(nextCapability);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await refresh();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  async function toggleProtection() {
    setLoading(true);
    setMessage('');
    try {
      const result = enabled ? await disableAppLock() : await enableAppLock();
      if (!result.success) {
        setMessage(
          result.error === 'device_authentication_unavailable'
            ? 'Cadastre biometria, PIN, padrão ou senha de bloqueio no aparelho para usar esta proteção.'
            : 'A confirmação foi cancelada ou não pôde ser concluída.',
        );
        return;
      }

      await refresh();
      setMessage(
        enabled
          ? 'Proteção local desativada neste aparelho.'
          : 'Proteção local ativada. A Nexa será bloqueada ao abrir e após 30 segundos em segundo plano.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function testProtection() {
    setLoading(true);
    setMessage('');
    try {
      const result = await authenticateDevice('Confirmar identidade na Nexa');
      setMessage(
        result.success
          ? 'Identidade confirmada com segurança pelo aparelho.'
          : result.error === 'device_authentication_unavailable'
            ? 'Nenhum método seguro de desbloqueio está disponível neste aparelho.'
            : 'A confirmação não foi concluída.',
      );
    } finally {
      setLoading(false);
    }
  }

  const methodLabel = capability.strongBiometric
    ? 'Biometria forte + credencial do aparelho'
    : capability.deviceCredential
      ? 'PIN, padrão ou senha do aparelho'
      : 'Não configurado';

  return (
    <Screen>
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerBrand}>
          <Brand />
        </View>
      </View>

      <Badge tone={enabled ? 'success' : 'warning'}>
        {enabled ? 'PROTEÇÃO ATIVA' : 'PROTEÇÃO OPCIONAL'}
      </Badge>
      <View style={styles.titleGap} />
      <Title>Segurança da Nexa</Title>
      <Paragraph>
        Controle a proteção local deste aparelho sem enviar sua biometria para a Nexa.
      </Paragraph>

      <Card>
        <Text style={styles.cardTitle}>Bloqueio do aplicativo</Text>
        <Text style={styles.cardText}>
          Quando ativo, a Nexa exige confirmação do aparelho ao abrir e novamente depois de 30 segundos em segundo plano.
        </Text>
        <KeyValue label="Status" value={enabled ? 'Ativo' : 'Desativado'} />
        <KeyValue label="Método disponível" value={methodLabel} />
        <KeyValue
          label="Biometria forte"
          value={capability.strongBiometric ? 'Disponível' : 'Não detectada'}
        />
        <ActionButton
          label={enabled ? 'Desativar proteção' : 'Ativar proteção'}
          variant={enabled ? 'secondary' : 'primary'}
          loading={loading}
          disabled={!capability.available && !enabled}
          onPress={toggleProtection}
        />
        <ActionButton
          label="Testar autenticação do aparelho"
          variant="secondary"
          loading={loading}
          disabled={!capability.available}
          onPress={testProtection}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Como seus dados ficam protegidos</Text>
        <Text style={styles.securityItem}>✓ A senha Nexa nunca é armazenada pelo aplicativo.</Text>
        <Text style={styles.securityItem}>✓ A sessão fica no armazenamento seguro do aparelho.</Text>
        <Text style={styles.securityItem}>✓ Digital e reconhecimento facial são validados pelo sistema operacional.</Text>
        <Text style={styles.securityItem}>✓ A Nexa não recebe imagem facial, digital ou template biométrico.</Text>
        <Text style={styles.securityItem}>✓ Senha Nexa continua disponível como recuperação de acesso.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Versão instalada</Text>
        <KeyValue label="Nexa" value={config.appVersion} />
        <KeyValue label="Build Android" value={config.appBuild} />
        <KeyValue label="Android alvo" value={`API ${config.androidTargetApi}`} />
        <Text style={styles.releaseNote}>
          Este build mantém execução financeira global e recorrência Open Finance sob os gates de segurança da Nexa.
        </Text>
      </Card>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerBrand: { flex: 1 },
  backButton: {
    width: 42,
    height: 42,
    marginRight: spacing.md,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 31, lineHeight: 32 },
  titleGap: { height: spacing.md },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  securityItem: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  releaseNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panelSoft,
    padding: spacing.md,
  },
  message: {
    color: colors.text,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
});
