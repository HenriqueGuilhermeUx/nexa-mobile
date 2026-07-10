import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

function Action({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.action}>
      <View style={styles.actionIcon}><Text style={styles.actionEmoji}>{icon}</Text></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ eyebrow, title, description, cta, onPress, accent }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[styles.productCard, accent ? styles.productCardAccent : null]}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.productTitle}>{title}</Text>
      <Text style={styles.productDescription}>{description}</Text>
      <View style={styles.ctaRow}><Text style={styles.ctaText}>{cta}</Text><Text style={styles.ctaArrow}>→</Text></View>
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
  const recurringActive = Boolean(recurringPlan && String(recurringPlan.status || 'active').toLowerCase() !== 'cancelled');

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wrap}>
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
        <Text style={styles.heroEyebrow}>SEU PATRIMÔNIO</Text>
        <Text style={styles.heroValue}>R$ {Number(saldoBrl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        <Text style={styles.heroUsdc}>≈ {Number(saldoUsdc || 0).toFixed(6)} USDC</Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroHint}>Dólar digital, simples e disponível.</Text>
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
        <View><Text style={styles.marketLabel}>USDC hoje</Text><Text style={styles.marketValue}>R$ {Number(buyRate || 0).toFixed(2)}</Text></View>
        <View style={styles.marketRight}><Text style={[styles.marketChange, { color: Number(marketChange || 0) >= 0 ? '#34d399' : '#fb7185' }]}>{Number(marketChange || 0) >= 0 ? '+' : ''}{Number(marketChange || 0).toFixed(2)}%</Text><Text style={styles.marketLabel}>24h</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Faça seu dinheiro trabalhar</Text>

      <ProductCard
        eyebrow={recurringActive ? 'ASSINATURA ATIVA' : 'CRIPTO POR ASSINATURA'}
        title={recurringActive ? 'Seu dólar todo mês, no automático.' : 'Construa patrimônio em dólar sem precisar lembrar.'}
        description={recurringActive ? 'Sua compra recorrente está configurada. Acompanhe ou ajuste quando quiser.' : 'Escolha um valor mensal. A Nexa cuida do restante.'}
        cta={recurringActive ? 'Gerenciar assinatura' : 'Começar agora'}
        onPress={() => onNavigate('recurringCrypto')}
        accent
      />

      <ProductCard
        eyebrow={isPremium ? 'VOCÊ É PREMIUM' : 'NEXA PREMIUM'}
        title={isPremium ? 'Sua experiência Nexa completa.' : 'Mais patrimônio. Menos taxas.'}
        description={isPremium ? 'Acesse benefícios, ativos exclusivos e atendimento prioritário.' : 'Ouro digital, Bitcoin, taxas menores e atendimento prioritário por R$ 19,90/mês.'}
        cta={isPremium ? 'Ver benefícios' : 'Conhecer Premium'}
        onPress={() => onNavigate('premium')}
      />

      <View style={styles.twoCards}>
        <TouchableOpacity style={styles.miniCard} onPress={() => onNavigate('rewards')}>
          <Text style={styles.miniIcon}>✦</Text><Text style={styles.miniTitle}>Rewards</Text><Text style={styles.miniValue}>{Number(rewardsTotal || 0).toFixed(4)} USDC</Text><Text style={styles.miniHint}>Ver rendimento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.miniCard} onPress={() => onNavigate('investments')}>
          <Text style={styles.miniIcon}>◈</Text><Text style={styles.miniTitle}>Expandir</Text><Text style={styles.miniValue}>Ouro & Bitcoin</Text><Text style={styles.miniHint}>Conhecer ativos</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.custodyLine} onPress={() => onNavigate('wallet')}>
        <View><Text style={styles.custodyTitle}>Custódia Inteligente Nexa™</Text><Text style={styles.custodyText}>Simplicidade no Modo Nexa. Liberdade na sua carteira.</Text></View><Text style={styles.custodyArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Cripto sem complicação.</Text>
    </ScrollView>
  );
}

const styles = {
  wrap: { paddingBottom: 42 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  hello: { color: '#f8fafc', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  handle: { color: '#64748b', fontSize: 14, marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#29364d' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  hero: { backgroundColor: '#0b1220', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b', marginBottom: 22 },
  heroEyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  heroValue: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1.5, marginTop: 12 },
  heroUsdc: { color: '#94a3b8', fontSize: 16, marginTop: 6 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  heroHint: { color: '#64748b', fontSize: 12 },
  refresh: { color: '#7dd3fc', fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  action: { alignItems: 'center', width: '23%' },
  actionIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#111c2f', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#20304a' },
  actionEmoji: { color: '#fff', fontSize: 21, fontWeight: '500' },
  actionLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginTop: 9 },
  marketStrip: { backgroundColor: '#0b1220', borderRadius: 20, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#18243a', marginBottom: 26 },
  marketLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  marketValue: { color: '#f8fafc', fontSize: 18, fontWeight: '850', marginTop: 4 },
  marketRight: { alignItems: 'flex-end' },
  marketChange: { fontSize: 15, fontWeight: '850' },
  sectionTitle: { color: '#f8fafc', fontSize: 21, fontWeight: '850', letterSpacing: -0.4, marginBottom: 14 },
  productCard: { backgroundColor: '#0b1220', borderRadius: 25, padding: 21, borderWidth: 1, borderColor: '#1e293b', marginBottom: 14 },
  productCardAccent: { backgroundColor: '#12213e', borderColor: '#244980' },
  eyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  productTitle: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 9 },
  productDescription: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginTop: 9 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  ctaText: { color: '#fff', fontWeight: '850', fontSize: 14 },
  ctaArrow: { color: '#7dd3fc', fontSize: 19, marginLeft: 8 },
  twoCards: { flexDirection: 'row', gap: 12, marginTop: 2, marginBottom: 15 },
  miniCard: { flex: 1, backgroundColor: '#0b1220', borderRadius: 22, padding: 17, borderWidth: 1, borderColor: '#1e293b' },
  miniIcon: { color: '#7dd3fc', fontSize: 20 },
  miniTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 13 },
  miniValue: { color: '#fff', fontSize: 16, fontWeight: '850', marginTop: 5 },
  miniHint: { color: '#64748b', fontSize: 11, marginTop: 7 },
  custodyLine: { backgroundColor: '#0b1220', borderRadius: 20, padding: 17, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  custodyTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '850' },
  custodyText: { color: '#64748b', fontSize: 11, marginTop: 5, maxWidth: 290 },
  custodyArrow: { color: '#64748b', fontSize: 30 },
  footer: { color: '#334155', textAlign: 'center', fontSize: 12, fontWeight: '800', marginTop: 25 },
};
