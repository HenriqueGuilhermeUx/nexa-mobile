import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

function Action({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={styles.action}>
      <View style={styles.actionIcon}><Text style={styles.actionEmoji}>{icon}</Text></View>
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
      <Text style={[styles.eyebrow, premium ? styles.eyebrowPremium : null]}>{eyebrow}</Text>
      <Text style={styles.productTitle}>{title}</Text>
      <Text style={styles.productDescription}>{description}</Text>
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>{cta}</Text>
        <Text style={styles.ctaArrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AppleModeHome({
  user,
  username,
  saldoUsdc,
  saldoBrl,
  buyRate,
  marketChange,
  isPremium,
  recurringPlan,
  rewardsTotal,
  onNavigate,
  onRefresh,
}) {
  const firstName = String(user?.fullName || 'Cliente').split(' ')[0];
  const recurringActive = Boolean(
    recurringPlan && String(recurringPlan.status || 'active').toLowerCase() !== 'cancelled',
  );
  const recurringAmount = Number(
    recurringPlan?.amountBrl || recurringPlan?.monthlyAmountBrl || recurringPlan?.amount || 0,
  );
  const day = Number(recurringPlan?.dayOfMonth || recurringPlan?.day || 5);
  const protectedValue = Number(saldoBrl || 0);
  const freedomProgress = Math.min(100, Math.max(4, protectedValue > 0 ? Math.log10(protectedValue + 10) * 18 : 4));

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.hello}>Bom dia, {firstName}</Text>
          <Text style={styles.handle}>{username}</Text>
        </View>
        <TouchableOpacity onPress={() => onNavigate('menuScreen')} style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>SEU SALDO</Text>
        <Text style={styles.heroValue}>
          R$ {Number(saldoBrl || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text style={styles.heroUsdc}>≈ {Number(saldoUsdc || 0).toFixed(6)} USDC</Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroHint}>Patrimônio em dólar, disponível quando você precisar.</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.refresh}>Atualizar</Text></TouchableOpacity>
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
          <Text style={[styles.marketChange, { color: Number(marketChange || 0) >= 0 ? '#34d399' : '#fb7185' }]}>
            {Number(marketChange || 0) >= 0 ? '+' : ''}{Number(marketChange || 0).toFixed(2)}%
          </Text>
          <Text style={styles.marketLabel}>24h</Text>
        </View>
      </View>

      {recurringActive ? (
        <View style={styles.nextBuyCard}>
          <View>
            <Text style={styles.nextBuyEyebrow}>PRÓXIMA COMPRA AUTOMÁTICA</Text>
            <Text style={styles.nextBuyTitle}>Dia {day} · R$ {recurringAmount.toFixed(2)}</Text>
            <Text style={styles.nextBuyHint}>Seu dólar todo mês, no automático.</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('recurringCrypto')}>
            <Text style={styles.manage}>Gerenciar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Faça seu patrimônio crescer</Text>

      <ProductCard
        eyebrow={recurringActive ? 'ASSINATURA ATIVA' : 'SEU DÓLAR AUTOMÁTICO'}
        title={recurringActive ? 'Você já está construindo patrimônio todo mês.' : 'Invista em dólar sem precisar lembrar.'}
        description={recurringActive ? 'Acompanhe sua próxima compra ou ajuste o valor quando quiser.' : 'Escolha um valor mensal e a Nexa transforma disciplina em patrimônio.'}
        cta={recurringActive ? 'Gerenciar assinatura' : 'Ativar meu plano'}
        onPress={() => onNavigate('recurringCrypto')}
        accent
      />

      <ProductCard
        eyebrow={isPremium ? 'VOCÊ É PREMIUM' : 'NEXA PREMIUM'}
        title={isPremium ? 'Sua experiência Nexa completa.' : 'Construa patrimônio mais rápido.'}
        description={isPremium ? 'Ativos exclusivos, melhores condições e atendimento prioritário.' : 'Menores taxas, Ouro Digital, Bitcoin e atendimento prioritário por R$ 19,90/mês.'}
        cta={isPremium ? 'Ver meus benefícios' : 'Quero ser Premium'}
        onPress={() => onNavigate('premium')}
        premium
      />

      <View style={styles.twoCards}>
        <TouchableOpacity style={styles.miniCard} onPress={() => onNavigate('rewards')}>
          <Text style={styles.miniIcon}>✦</Text>
          <Text style={styles.miniTitle}>Rewards</Text>
          <Text style={styles.miniValue}>{Number(rewardsTotal || 0).toFixed(4)} USDC</Text>
          <Text style={styles.miniHint}>Ver rendimento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.miniCard} onPress={() => onNavigate('investments')}>
          <Text style={styles.miniIcon}>◈</Text>
          <Text style={styles.miniTitle}>Expandir</Text>
          <Text style={styles.miniValue}>Ouro & Bitcoin</Text>
          <Text style={styles.miniHint}>Conhecer ativos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.freedomCard}>
        <Text style={styles.freedomEyebrow}>LIBERDADE FINANCEIRA</Text>
        <Text style={styles.freedomTitle}>Você já protegeu R$ {protectedValue.toFixed(2)} em dólar digital.</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${freedomProgress}%` }]} /></View>
        <Text style={styles.freedomHint}>Cada aporte deixa seu patrimônio mais forte.</Text>
      </View>

      <TouchableOpacity style={styles.custodyLine} onPress={() => onNavigate('custody')}>
        <View style={{ flex: 1 }}>
          <Text style={styles.custodyTitle}>Onde guardar seus ativos?</Text>
          <Text style={styles.custodyText}>Modo Nexa para simplicidade. Carteira própria para liberdade total.</Text>
        </View>
        <Text style={styles.custodyArrow}>›</Text>
      </TouchableOpacity>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomItem} onPress={() => onNavigate('home')}>
          <Text style={styles.bottomIconActive}>●</Text><Text style={styles.bottomLabelActive}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomItem} onPress={() => onNavigate('extrato')}>
          <Text style={styles.bottomIcon}>↕</Text><Text style={styles.bottomLabel}>Movimentações</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomItem} onPress={() => onNavigate('profile')}>
          <Text style={styles.bottomIcon}>○</Text><Text style={styles.bottomLabel}>Perfil</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Cripto sem complicação.</Text>
    </ScrollView>
  );
}

const styles = {
  wrap: { paddingBottom: 34 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  hello: { color: '#f8fafc', fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  handle: { color: '#64748b', fontSize: 14, marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#29364d' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  hero: { backgroundColor: '#0a1220', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b', marginBottom: 22, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, elevation: 8 },
  heroEyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  heroValue: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1.7, marginTop: 12 },
  heroUsdc: { color: '#94a3b8', fontSize: 16, marginTop: 6 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  heroHint: { color: '#64748b', fontSize: 12, flex: 1, marginRight: 12 },
  refresh: { color: '#7dd3fc', fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  action: { alignItems: 'center', width: '23%' },
  actionIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#111c2f', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#20304a' },
  actionEmoji: { color: '#fff', fontSize: 21, fontWeight: '500' },
  actionLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginTop: 9 },
  marketStrip: { backgroundColor: '#0b1220', borderRadius: 20, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#18243a', marginBottom: 16 },
  marketLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  marketValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 4 },
  marketRight: { alignItems: 'flex-end' },
  marketChange: { fontSize: 15, fontWeight: '800' },
  nextBuyCard: { backgroundColor: '#0d1b32', borderRadius: 20, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#244980', marginBottom: 24 },
  nextBuyEyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  nextBuyTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 6 },
  nextBuyHint: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  manage: { color: '#7dd3fc', fontSize: 12, fontWeight: '900' },
  sectionTitle: { color: '#f8fafc', fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginBottom: 14 },
  productCard: { backgroundColor: '#0b1220', borderRadius: 25, padding: 21, borderWidth: 1, borderColor: '#1e293b', marginBottom: 14 },
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
  freedomCard: { backgroundColor: '#0b1220', borderRadius: 22, padding: 19, borderWidth: 1, borderColor: '#1e293b', marginBottom: 15 },
  freedomEyebrow: { color: '#34d399', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  freedomTitle: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 8 },
  freedomHint: { color: '#64748b', fontSize: 11, marginTop: 8 },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: '#142033', overflow: 'hidden', marginTop: 15 },
  progressFill: { height: 7, borderRadius: 999, backgroundColor: '#34d399' },
  custodyLine: { backgroundColor: '#0b1220', borderRadius: 20, padding: 17, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  custodyTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '800' },
  custodyText: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 290 },
  custodyArrow: { color: '#64748b', fontSize: 30 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#0b1220', borderRadius: 22, borderWidth: 1, borderColor: '#1e293b', paddingVertical: 13, marginTop: 18 },
  bottomItem: { alignItems: 'center', minWidth: 82 },
  bottomIcon: { color: '#64748b', fontSize: 18 },
  bottomIconActive: { color: '#7dd3fc', fontSize: 18 },
  bottomLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', marginTop: 4 },
  bottomLabelActive: { color: '#e2e8f0', fontSize: 10, fontWeight: '800', marginTop: 4 },
  footer: { color: '#334155', textAlign: 'center', fontSize: 12, fontWeight: '800', marginTop: 22 },
};