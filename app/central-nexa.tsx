import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { ensureNexaNotificationPermission } from '@/lib/nexaNotifications';
import { loadNexaSession } from '@/lib/session';
import { NEXA_TELEGRAM_SUPPORT_URL, nexaWhatsAppSupportUrl } from '@/lib/nexaSupportLinks';
import { colors, radius, spacing } from '@/theme';

type IdentityStage = 'loading' | 'signed_out' | 'pending' | 'review' | 'approved' | 'unavailable';

const PORTAL_URL = 'https://trynexa.com.br/portal/';
const GUIDE_URL = 'https://trynexa.com.br/insights/primeira-utilizacao-nexa.html';
const FEEDBACK_URL = 'https://trynexa.com.br/ajuda-verificacao.html';

function Action({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function CentralNexaScreen() {
  const [identityStage, setIdentityStage] = useState<IdentityStage>('loading');
  const [notice, setNotice] = useState('');
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!current) return;
        if (!session) {
          setIdentityStage('signed_out');
          return;
        }
        const state = await nexaApi.getMyKycStatus(session.accessToken);
        if (!current) return;
        if (state.kycStatus === 'approved' || state.nextAction === 'approved') {
          setIdentityStage('approved');
        } else if (state.nextAction === 'manual_review' || state.kycStatus === 'in_review') {
          setIdentityStage('review');
        } else {
          setIdentityStage('pending');
        }
      } catch {
        if (current) setIdentityStage('unavailable');
      }
    })();
    return () => { current = false; };
  }, []);

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
      setNotice('');
    } catch {
      setNotice('Não conseguimos abrir esse canal. Você também pode acessar trynexa.com.br/suporte pelo navegador.');
    }
  }

  async function enablePush() {
    setPushState('loading');
    try {
      const result = await ensureNexaNotificationPermission();
      setPushState(result.granted ? 'granted' : 'denied');
      setNotice(result.granted
        ? 'Avisos permitidos neste aparelho. A caixa de mensagens e os envios remotos estão sendo preparados.'
        : 'As notificações não foram autorizadas. Você poderá ajustar isso nas configurações do aparelho.');
    } catch {
      setPushState('denied');
      setNotice('Não foi possível solicitar a permissão neste aparelho. Tente novamente mais tarde.');
    }
  }

  const stage = {
    loading: ['Carregando verificação', 'Estamos consultando sua etapa atual.'],
    signed_out: ['Primeiro, entre na Nexa', 'O acesso ao KYC individual exige sua conta autenticada.'],
    pending: ['Verificação de identidade', 'A verificação começa dentro da Nexa. Não é preciso depositar para começar.'],
    review: ['Verificação em análise', 'Acompanhe sua situação na Nexa; não repita sessões sem orientação.'],
    approved: ['Identidade verificada', 'Você pode consultar os serviços habilitados na sua conta.'],
    unavailable: ['Acompanhar identidade', 'Consulte o status na área autenticada.'],
  }[identityStage];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>NEXA • RELACIONAMENTO</Text>
        <Text style={styles.title}>Central Nexa</Text>
        <Text style={styles.subtitle}>Seu lugar para pedir ajuda, acompanhar sua jornada e escolher como falar com a Nexa.</Text>
      </View>

      <View style={styles.feature}>
        <Text style={styles.featureLabel}>CONVERSE COM O THEO</Text>
        <Text style={styles.featureTitle}>Como podemos ajudar?</Text>
        <Text style={styles.featureCopy}>Estamos preparando o chat dentro do aplicativo. Até a caixa de entrada estar conectada, escolha um canal oficial para conversar com o Theo.</Text>
        <Action title="Theo no WhatsApp" detail="Atendimento por mensagem, iniciado por você" onPress={() => void openUrl(nexaWhatsAppSupportUrl())} />
        <Action title="Theo no Telegram" detail="Abrir @NexaTheoBot" onPress={() => void openUrl(NEXA_TELEGRAM_SUPPORT_URL)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seu próximo passo</Text>
        <Text style={styles.sectionSubtitle}>{stage[0]}</Text>
        <Text style={styles.paragraph}>{stage[1]}</Text>
        <Action title={identityStage === 'signed_out' ? 'Entrar na Nexa' : 'Acompanhar minha verificação'} detail="A verificação Didit é iniciada somente na conta autenticada" onPress={() => router.push((identityStage === 'signed_out' ? '/sign-in' : '/kyc') as any)} />
        <Action title="Encontrei dificuldade no KYC" detail="Pesquisa opcional, sem envio de documentos" onPress={() => void openUrl(FEEDBACK_URL)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Avisos no celular</Text>
        <Text style={styles.paragraph}>Você decide se permite notificações neste aparelho. Não ativaremos campanhas promocionais automaticamente.</Text>
        <Action title={pushState === 'granted' ? 'Notificações permitidas' : pushState === 'loading' ? 'Verificando permissão…' : 'Permitir notificações'} detail="O envio de push remoto ainda exige configuração e validação do serviço" onPress={() => { if (pushState !== 'loading') void enablePush(); }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mensagens e novidades</Text>
        <Text style={styles.paragraph}>A caixa de entrada permanente, preferências de novidades e ofertas estão em preparação. Não mostramos mensagens fictícias nem enviamos campanhas sem sua escolha.</Text>
        <Action title="Guia de primeira utilização" detail="Entenda Pix, USDC, KYC e segurança" onPress={() => void openUrl(GUIDE_URL)} />
        <Action title="Abrir o portal Nexa" detail="Consulte informações da sua conta com segurança" onPress={() => void openUrl(PORTAL_URL)} />
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <Text style={styles.footnote}>Nunca envie CPF, senha, foto de documento, código de acesso ou link individual da Didit em mensagens.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  eyebrow: { color: colors.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  feature: { borderRadius: radius.xl, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  featureLabel: { color: colors.cyan, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  featureTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  featureCopy: { color: colors.muted, lineHeight: 19, fontSize: 13, marginBottom: spacing.xs },
  section: { borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  sectionSubtitle: { color: colors.cyan, fontSize: 15, fontWeight: '700' },
  paragraph: { color: colors.muted, lineHeight: 20, fontSize: 13 },
  action: { minHeight: 57, backgroundColor: colors.panelSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  actionDetail: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  chevron: { color: colors.cyan, fontSize: 26 },
  notice: { color: colors.warning, fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
  footnote: { color: colors.mutedStrong, fontSize: 11, lineHeight: 17, marginBottom: spacing.xl },
});
