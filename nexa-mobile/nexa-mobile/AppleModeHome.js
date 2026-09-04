import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

function Action({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={styles.action}>
      <View style={styles.actionIcon}>
        <Text style={styles.actionEmoji}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ eyebrow, title, description, cta, onPress, accent, premium }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.productCard,
        accent ? styles.productCardAccent : null,
        premium ? styles.productCardPremium : null,
      ]}
    >
      <Text style={[styles.eyebrow, premium ? styles.eyebrowPremium : null]}>
        {eyebrow}
      </Text>
      <Text style={styles.productTitle}>{title}</Text>
      <Text style={styles.productDescription}>{description}</Text>
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>{cta}</Text>
        <Text style={styles.ctaArrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

function AssetChip({ icon, symbol, name, onPress }) {
  return (
    <TouchableOpacity style={styles.assetChip} onPress={onPress} activeOpacity={0.84}>
      <Text style={styles.assetIcon}>{icon}</Text>
      <Text style={styles.assetSymbol}>{symbol}</Text>
      <Text style={styles.assetName}>{name}</Text>
    </TouchableOpacity>
  );
}

export default function AppleModeHome({
  user,
  username,
  saldoUsdc,
  buyRate,
  marketChange,
  isPremium,
  hasWallet,
  recurringPlan,
  rewardsTotal,
  onNavigate,
  onRefresh,
}) {
  const firstName = String(user?.fullName || 'Cliente').split(' ')[0];
  const recurringActive = Boolean(
    recurringPlan &&
      String(recurringPlan.status || 'active').toLowerCase() !== 'cancelled',
  );
  const recurringAmount = Number(
    recurringPlan?.amountBrl ||
      recurringPlan?.monthlyAmountBrl ||
      recurringPlan?.amount ||
      0,
  );
  const day = Number(recurringPlan?.dayOfMonth || recurringPlan?.day || 5);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.hello}>Olá, {firstName}</Text>
          <Text style={styles.handle}>{username}</Text>
        </View>
        <TouchableOpacity onPress={() => onNavigate('menuScreen')} style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>SALDO NEXA</Text>
        <Text style={styles.heroValue}>{Number(saldoUsdc || 0).toFixed(4)}</Text>
        <Text style={styles.heroUsdc}>USDC</Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroHint}>
            Seu saldo operacional para Pix, transferências e conversões.
          </Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.refresh}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Action icon="＋" label="Comprar" onPress={() => onNavigate('deposit')} />
        <Action icon="↑" label="Enviar" onPress={() => onNavigate('send')} />
        <Action icon="↓" label="Receber" onPress={() => onNavigate('receive')} />
        <Action icon="•••" label="Mais" onPress={() => onNavigate('menuScreen')} />
      </View>

      <View style={styles.marketStrip}>
        <View>
          <Text style={styles.marketLabel}>USDC hoje</Text>
          <Text style={styles.marketValue}>R$ {Number(buyRate || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.marketRight}>
          <Text
            style={[
              styles.marketChange,
              { color: Number(marketChange || 0) >= 0 ? '#34d399' : '#fb7185' },
            ]}
          >
            {Number(marketChange || 0) >= 0 ? '+' : ''}
            {Number(marketChange || 0).toFixed(2)}%
          </Text>
          <Text style={styles.marketLabel}>24h</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Ativos na Nexa</Text>
      <View style={styles.assetGrid}>
        <AssetChip icon="💵" symbol="USDC" name="Dólar digital" onPress={() => onNavigate('investments')} />
        <AssetChip icon="₿" symbol="BTC" name="Bitcoin" onPress={() => onNavigate('investments')} />
        <AssetChip icon="◆" symbol="ETH" name="Ethereum" onPress={() => onNavigate('investments')} />
        <AssetChip icon="🥇" symbol="XAUT" name="Ouro digital" onPress={() => onNavigate('investments')} />
      </View>

      {recurringActive ? (
        <View style={styles.nextBuyCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextBuyEyebrow}>USDC POR ASSINATURA ATIVO</Text>
            <Text style={styles.nextBuyTitle}>
              Dia {day} · R$ {recurringAmount.toFixed(2)}
            </Text>
            <Text style={styles.nextBuyHint}>
              Sua compra mensal de USDC está configurada.
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('recurringCrypto')}>
            <Text style={styles.manage}>Gerenciar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ProductCard
          eyebrow="USDC POR ASSINATURA"
          title="Automatize sua compra mensal de USDC."
          description="Escolha o valor e o dia. A Nexa organiza a recorrência com Pix Automático."
          cta="Configurar assinatura"
          onPress={() => onNavigate('recurringCrypto')}
          accent
        />
      )}

      <ProductCard
        eyebrow={isPremium ? 'PREMIUM ATIVO' : 'NEXA PREMIUM'}
        title={isPremium ? 'Sua experiência Premium está ativa.' : 'Mais autonomia e melhores condições.'}
        description={
          isPremium
            ? 'Taxa de entrada reduzida, carteira individual e recursos on-chain.'
            : 'Entrada de 4%, carteira individual, envio e recebimento on-chain e atendimento prioritário.'
        }
        cta={isPremium ? 'Ver benefícios' : 'Conhecer Premium'}
        onPress={() => onNavigate('premium')}
        premium
      />

      <View style={styles.twoCards}>
        <TouchableOpacity style={styles.miniCard} onPress={() => onNavigate('rewards')}>
          <Text style={styles.miniIcon}>✦</Text>
          <Text style={styles.miniTitle}>Rewards</Text>
          <Text style={styles.miniValue}>
            {isPremium ? Number(rewardsTotal || 0).toFixed(4) + ' USDC' : 'Premium'}
          </Text>
          <Text style={styles.miniHint}>
            {isPremium ? 'Ver benefícios' : 'Conhecer benefício'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.miniCard} onPress={() => onNavigate('investments')}>
          <Text style={styles.miniIcon}>◈</Text>
          <Text style={styles.miniTitle}>Ativos</Text>
          <Text style={styles.miniValue}>BTC · ETH · XAUT</Text>
          <Text style={styles.miniHint}>Ver cotações</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.custodyLine, !isPremium && !hasWallet ? styles.custodyLinePremium : null]}
        onPress={() => onNavigate(isPremium || hasWallet ? 'custody' : 'premium')}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.custodyTitle}>
            {isPremium || hasWallet ? 'Minha Carteira' : 'Carteira individual Premium'}
          </Text>
          <Text style={styles.custodyText}>
            {isPremium || hasWallet
              ? 'Consulte sua carteira, receba USDC externo e movimente entre a Nexa e a rede Polygon.'
              : 'Clientes Premium podem ter carteira individual para enviar e receber USDC on-chain.'}
          </Text>
        </View>
        <Text style={styles.custodyArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Cripto sem complicação.</Text>
    </View>
  );
}

const styles = {
  wrap: { paddingBottom: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  hello: { color: '#f8fafc', fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  handle: { color: '#64748b', fontSize: 14, marginTop: 4 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#29364d',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  hero: {
    backgroundColor: '#0a1220',
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  heroEyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  heroValue: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1.7, marginTop: 12 },
  heroUsdc: { color: '#94a3b8', fontSize: 16, marginTop: 6 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  heroHint: { color: '#64748b', fontSize: 12, flex: 1, marginRight: 12 },
  refresh: { color: '#7dd3fc', fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  action: { alignItems: 'center', width: '23%' },
  actionIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#111c2f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#20304a',
  },
  actionEmoji: { color: '#fff', fontSize: 21, fontWeight: '500' },
  actionLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginTop: 9 },
  marketStrip: {
    backgroundColor: '#0b1220',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#18243a',
    marginBottom: 22,
  },
  marketLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  marketValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 4 },
  marketRight: { alignItems: 'flex-end' },
  marketChange: { fontSize: 15, fontWeight: '800' },
  sectionTitle: { color: '#f8fafc', fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginBottom: 12 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  assetChip: {
    width: '48.3%',
    backgroundColor: '#0b1220',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  assetIcon: { color: '#7dd3fc', fontSize: 22 },
  assetSymbol: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 9 },
  assetName: { color: '#64748b', fontSize: 11, marginTop: 4 },
  nextBuyCard: {
    backgroundColor: '#0d1b32',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#244980',
    marginBottom: 14,
  },
  nextBuyEyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  nextBuyTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 6 },
  nextBuyHint: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  manage: { color: '#7dd3fc', fontSize: 12, fontWeight: '900' },
  productCard: {
    backgroundColor: '#0b1220',
    borderRadius: 25,
    padding: 21,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  productCardAccent: { backgroundColor: '#12213e', borderColor: '#244980' },
  productCardPremium: { backgroundColor: '#171225', borderColor: '#5b3f88' },
  eyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  eyebrowPremium: { color: '#c4b5fd' },
  productTitle: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 9 },
  productDescription: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginTop: 9 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ctaArrow: { color: '#7dd3fc', fontSize: 19, marginLeft: 8 },
  twoCards: { flexDirection: 'row', gap: 12, marginTop: 2, marginBottom: 15 },
  miniCard: { flex: 1, backgroundColor: '#0b1220', borderRadius: 22, padding: 17, borderWidth: 1, borderColor: '#1e293b' },
  miniIcon: { color: '#7dd3fc', fontSize: 20 },
  miniTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 13 },
  miniValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 5 },
  miniHint: { color: '#64748b', fontSize: 11, marginTop: 7 },
  custodyLine: {
    backgroundColor: '#0b1220',
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  custodyLinePremium: { backgroundColor: '#171225', borderColor: '#5b3f88' },
  custodyTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '800' },
  custodyText: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 290 },
  custodyArrow: { color: '#64748b', fontSize: 30 },
  footer: { color: '#334155', textAlign: 'center', fontSize: 12, fontWeight: '800', marginTop: 22 },
};
