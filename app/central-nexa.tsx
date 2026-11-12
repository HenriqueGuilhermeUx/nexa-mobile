import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { config } from '@/config';

import { Screen } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { ensureNexaNotificationPermission } from '@/lib/nexaNotifications';
import { loadNexaSession } from '@/lib/session';
import { NEXA_TELEGRAM_SUPPORT_URL, nexaWhatsAppSupportUrl } from '@/lib/nexaSupportLinks';
import { colors, radius, spacing } from '@/theme';

type IdentityStage = 'loading' | 'signed_out' | 'pending' | 'review' | 'approved' | 'unavailable';
type InboxState = 'loading' | 'signed_out' | 'unavailable' | 'ready';
type CentralMessage = { id: string; direction: 'inbound' | 'theo' | 'nexa'; topic: string; body: string; createdAt: string };
type CentralPreferences = { servicePushOptIn: boolean; offersOptIn: boolean; marketingPushOptIn: boolean };

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
  const [inboxState, setInboxState] = useState<InboxState>('loading');
  const [messages, setMessages] = useState<CentralMessage[]>([]);
  const [preferences, setPreferences] = useState<CentralPreferences | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

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

  // The in-app chat is only shown after a successful owner-scoped API reply.
  // When the backend flag is off, use the existing official Theo channels.
  async function refreshInbox() {
    try {
      const session = await loadNexaSession();
      if (!session) { setInboxState('signed_out'); return; }
      const response = await fetch((config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl) + '/central-nexa/me', {
        headers: { Authorization: 'Bearer ' + session.accessToken },
      });
      if (!response.ok) { setInboxState('unavailable'); return; }
      const body = await response.json();
      if (!Array.isArray(body?.messages)) { setInboxState('unavailable'); return; }
      setMessages(body.messages.slice(-100));
      setPreferences(body.preferences || null);
      setInboxState('ready');
    } catch {
      setInboxState('unavailable');
    }
  }

  useEffect(() => { void refreshInbox(); }, []);

  async function sendInternalMessage() {
    if (sending || inboxState !== 'ready') return;
    const text = draft.trim();
    if (!text || text.length > 1000) {
      setNotice('Escreva uma pergunta de até 1000 caracteres.');
      return;
    }
    const session = await loadNexaSession();
    if (!session) {
      setInboxState('signed_out');
      return;
    }
    setSending(true);
    try {
      const response = await fetch((config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl) + '/central-nexa/support', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, clientMessageId: Crypto.randomUUID() }),
      });
      if (!response.ok) {
        setNotice('Mensagem não enviada. Não inclua CPF, e-mail, telefone ou documentos. Você pode usar o atendimento externo.');
        return;
      }
      setDraft('');
      setNotice('');
      await refreshInbox();
    } catch {
      setNotice('Não foi possível enviar. Sua mensagem foi mantida para tentar novamente.');
    } finally {
      setSending(false);
    }
  }

  async function updatePreference(name: keyof CentralPreferences, enabled: boolean) {
    if (inboxState !== 'ready') return;
    const session = await loadNexaSession();
    if (!session) return;
    try {
      const response = await fetch((config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl) + '/central-nexa/preferences', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [name]: enabled }),
      });
      if (!response.ok) throw new Error('Preference not confirmed');
      const updated = await response.json() as CentralPreferences;
      setPreferences(updated);
      setNotice('Preferência registrada na sua conta Nexa.');
    } catch {
      setNotice('Não conseguimos confirmar essa preferência; ela não foi modificada.');
    }
  }

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
        {inboxState === 'ready' ? (
          <>
            <Text style={styles.featureCopy}>Converse com o Theo na Nexa. Ele oferece orientações gerais; não movimenta sua conta nem aprova verificações.</Text>
            <View style={styles.chatHistory}>
              {messages.length === 0 ? <Text style={styles.chatEmpty}>Sua conversa começa aqui. Você pode perguntar sobre cadastro e verificação de identidade.</Text> : null}
              {messages.map(message => (
                <View key={message.id} style={[styles.chatBubble, message.direction === 'inbound' ? styles.chatOwn : styles.chatTheo]}>
                  <Text style={styles.chatAuthor}>{message.direction === 'inbound' ? 'Você' : message.direction === 'theo' ? 'Theo' : 'Nexa'}</Text>
                  <Text style={styles.chatBody}>{message.body}</Text>
                </View>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Escrever para o Theo"
              value={draft}
              onChangeText={setDraft}
              maxLength={1000}
              multiline
              placeholder="Pergunte ao Theo, sem enviar dados pessoais"
              placeholderTextColor={colors.mutedStrong}
              style={styles.chatInput}
            />
            <Pressable accessibilityRole="button" disabled={sending || !draft.trim()} onPress={() => void sendInternalMessage()} style={styles.sendButton}>
              <Text style={styles.sendLabel}>{sending ? 'Enviando…' : 'Enviar ao Theo'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.featureCopy}>{inboxState === 'signed_out'
            ? 'Entre na conta para usar o chat privado. O atendimento externo continua disponível.'
            : 'Estamos preparando o chat dentro do aplicativo. Enquanto isso, escolha um canal oficial para conversar com o Theo.'}</Text>
        )}
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
        <Text style={styles.paragraph}>{inboxState === 'ready'
          ? 'Seus comunicados ficam aqui. Avisos de serviço e ofertas são preferências separadas e podem ser desativadas.'
          : 'A caixa de entrada permanente, preferências de novidades e ofertas estão em preparação. Não mostramos mensagens fictícias nem enviamos campanhas sem sua escolha.'}</Text>
        {inboxState === 'ready' && preferences ? (
          <>
            <Action title={preferences.offersOptIn ? 'Novidades e ofertas: autorizado' : 'Novidades e ofertas: desativado'} detail="Toque para mudar sua preferência. Nenhuma campanha é enviada automaticamente." onPress={() => void updatePreference('offersOptIn', !preferences.offersOptIn)} />
            <Action title={preferences.marketingPushOptIn ? 'Push promocional: autorizado' : 'Push promocional: desativado'} detail="Preferência independente da permissão do aparelho" onPress={() => void updatePreference('marketingPushOptIn', !preferences.marketingPushOptIn)} />
          </>
        ) : null}
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
  chatHistory: { maxHeight: 320, gap: spacing.sm, marginVertical: spacing.sm },
  chatEmpty: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chatBubble: { borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  chatOwn: { backgroundColor: colors.primarySoft, marginLeft: 18 },
  chatTheo: { backgroundColor: colors.panelSoft, marginRight: 18 },
  chatAuthor: { color: colors.cyan, fontWeight: '800', fontSize: 10 },
  chatBody: { color: colors.text, fontSize: 13, lineHeight: 19 },
  chatInput: { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.md, minHeight: 54, padding: spacing.md, textAlignVertical: 'top' },
  sendButton: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.primary },
  sendLabel: { color: colors.white, fontWeight: '800', fontSize: 14 },
  footnote: { color: colors.mutedStrong, fontSize: 11, lineHeight: 17, marginBottom: spacing.xl },
});
