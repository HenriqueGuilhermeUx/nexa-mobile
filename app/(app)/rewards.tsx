import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { getRewardsPosition, getRewardsVault } from '@/lib/rewardsV2';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function rawToNumber(value: unknown, decimals = 6) {
  const normalized = String(value ?? '0').trim();
  if (!/^\d+$/.test(normalized)) return 0;
  const divisor = 10 ** Math.max(0, Math.min(decimals, 18));
  return Number(normalized) / divisor;
}

function formatUsdc(value: number) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} USDC`;
}

function formatPercentFromBps(value: unknown) {
  const bps = Number(value || 0);
  if (!Number.isFinite(bps)) return '—';
  return `${(bps / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}% a.a.`;
}

export default function RewardsScreen() {
  const [vault, setVault] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const [vaultResponse, positionResponse] = await Promise.all([
        getRewardsVault(session.accessToken),
        getRewardsPosition(session.accessToken),
      ]);
      setVault(vaultResponse);
      setPosition(positionResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar o Nexa Rewards agora.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = position?.summary || {};
  const decimals = Number(summary.decimals || 6);
  const currentBalance = useMemo(
    () => rawToNumber(summary.assetsInVaultRaw, decimals),
    [summary.assetsInVaultRaw, decimals],
  );
  const earnedYield = useMemo(
    () => rawToNumber(summary.earnedYieldRaw, decimals),
    [summary.earnedYieldRaw, decimals],
  );
  const vaultDetails = vault?.vault || {};

  return (
    <Screen>
      <Brand />
      <Eyebrow>NEXA REWARDS</Eyebrow>
      <Title>Seu USDC trabalhando para você.</Title>
      <Paragraph>
        O saldo aplicado fica em um vault DeFi de terceiro. O rendimento é variável,
        não é garantido e a Nexa não recebe o principal do cliente.
      </Paragraph>

      <Card>
        <Badge tone="info">70% CLIENTE · 30% NEXA</Badge>
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Seu saldo no Rewards</Text>
          <Text
            style={{
              color: colors.text,
              fontWeight: '900',
              fontSize: 30,
              marginTop: spacing.sm,
            }}
          >
            {formatUsdc(currentBalance)}
          </Text>
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Rendimento acumulado</Text>
          <Text
            style={{
              color: earnedYield >= 0 ? colors.success : colors.danger,
              fontWeight: '900',
              fontSize: 22,
              marginTop: spacing.sm,
            }}
          >
            {formatUsdc(earnedYield)}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>
          {vaultDetails.name || 'Steakhouse Prime USDC'}
        </Text>
        <Text style={{ color: colors.muted, marginTop: spacing.sm }}>
          USDC · Base · Morpho
        </Text>
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text style={{ color: colors.text }}>
            APY líquido estimado do cliente: {formatPercentFromBps(vaultDetails.user_apy)}
          </Text>
          <Text style={{ color: colors.muted }}>
            Parcela Nexa configurada no vault: 30% do rendimento gerado.
          </Text>
          {Number.isFinite(Number(vaultDetails.tvl_usd)) ? (
            <Text style={{ color: colors.muted }}>
              TVL do vault: US$ {Number(vaultDetails.tvl_usd).toLocaleString('pt-BR', {
                maximumFractionDigits: 0,
              })}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17 }}>
          Aplicar e resgatar
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 21, marginTop: spacing.sm }}>
          A leitura da posição já usa o vault real da Privy. Depósitos e resgates serão
          liberados somente com autorização explícita da sua carteira e validação final do fluxo.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <ActionButton label="Aplicar USDC · em validação" disabled onPress={() => undefined} />
        </View>
      </Card>

      {error ? (
        <Text
          style={{
            color: colors.danger,
            backgroundColor: colors.dangerSoft,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        >
          {error}
        </Text>
      ) : null}

      <ActionButton label={loading ? 'Atualizando…' : 'Atualizar'} disabled={loading} onPress={load} />
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
