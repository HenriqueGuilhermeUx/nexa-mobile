import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { config } from '@/config';

import { Screen } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { ensureNexaNotificationPermission } from '@/lib/nexaNotifications';
import { registerNexaCentralServicePush, revokeNexaCentralServicePush } from '@/lib/nexaCentralPush';
import { loadNexaSession } from '@/lib/session';
import { NEXA_TELEGRAM_SUPPORT_URL, nexaWhatsAppSupportUrl } from '@/lib/nexaSupportLinks';
import { colors, radius, spacing } from '@/theme';

type IdentityStage = 'loading' | 'signed_out' | 'pending' | 'review' | 'approved' | 'unavailable';
type InboxState = 'loading' | 'signed_out' | 'unavailable' | 'ready';
type CentralMessage = { id: string; direction: 'inbound' | 'theo' | 'nexa'; topic: string; body: string; createdAt: string };
type CentralPreferences = { servicePushOptIn: boolean; offersOptIn: boolean; marketingPushOptIn: boolean };
type ExternalChannel = 'whatsapp' | 'telegram';
type ExternalPurpose = 'service' | 'marketing';
type ChannelConsent = { channel: ExternalChannel; purpose: ExternalPurpose; optedIn: boolean };
type ChannelConsentKey = `${ExternalChannel}:${ExternalPurpose}`;
const CONSENT_NOTICE_VERSION = 'nexa-channel-v1';
const CHANNEL_OPTIONS: ReadonlyArray<{channel:ExternalChannel;purpose:ExternalPurpose;label:string}> = [
  {channel:'whatsapp',purpose:'service',label:'WhatsApp — orientações e suporte'},
  {channel:'telegram',purpose:'service',label:'Telegram — orientações e suporte'},
  {channel:'whatsapp',purpose:'marketing',label:'WhatsApp — notícias e novidades'},
  {channel:'telegram',purpose:'marketing',label:'Telegram — notícias e novidades'},
];

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
  const [channelConsents, setChannelConsents] = useState<Partial<Record<ChannelConsentKey, boolean>>>({});
  const [channelConsentState, setChannelConsentState] = useState<'loading' | 'unavailable' | 'ready'>('loading');
  const [channelConsentSaving, setChannelConsentSaving] = useState<ChannelConsentKey | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const pendingMessage = useRef<{ text: string; requestId: string } | null>(null);

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
        const profile = await nexaApi.me(session.accessToken);
        const country = String(profile?.residenceCountry || 'BR').trim().toUpperCase();
        const state = country === 'BR'
          ? await nexaApi.getMyKycStatus(session.accessToken)
          : await nexaApi.getMyGlobalKycStatus(session.accessToken);
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

  // Separate, authenticated consent endpoint. A login or a push permission
  // never counts as WhatsApp / Telegram consent. Fail closed if unavailable.
  async function refreshChannelConsents() {
    try {
      const session = await loadNexaSession();
      if (!session) { setChannelConsentState('unavailable'); return; }
      const base = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0,-1) : config.apiUrl;
      const response = await fetch(base + '/central-nexa/channel-consents', {
        headers: { Authorization:'Bearer ' + session.accessToken },
      });
      if (!response.ok) { setChannelConsentState('unavailable'); return; }
      const body = await response.json();
      if (!Array.isArray(body?.consents) || body.noticeVersion !== CONSENT_NOTICE_VERSION) {
        setChannelConsentState('unavailable'); return;
      }
      const stored:Partial<Record<ChannelConsentKey, boolean>> = {};
      for (const consent of body.consents as ChannelConsent[]) {
        const allowed = CHANNEL_OPTIONS.some(option => option.channel === consent.channel && option.purpose === consent.purpose);
        if (allowed && consent.optedIn === true) stored[`${consent.channel}:${consent.purpose}`] = true;
      }
      setChannelConsents(stored);
      setChannelConsentState('ready');
    } catch {
      setChannelConsentState('unavailable');
    }
  }

  useEffect(() => { void refreshChannelConsents(); }, []);

  async function setChannelConsent(channel:ExternalChannel,purpose:ExternalPurpose,optedIn:boolean) {
    if (channelConsentState !== 'ready' || channelConsentSaving) return;
    const key:ChannelConsentKey = `${channel}:${purpose}`;
    const session = await loadNexaSession();
    if (!session) { setChannelConsentState('unavailable'); return; }
    setChannelConsentSaving(key);
    try {
      const base = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0,-1) : config.apiUrl;
      const response = await fetch(base + '/central-nexa/channel-consents', {
        method:'POST',
        headers:{Authorization:'Bearer ' + session.accessToken,'Content-Type':'application/json'},
        body:JSON.stringify({channel,purpose,optedIn,noticeVersion:CONSENT_NOTICE_VERSION}),
      });
      if (!response.ok) throw new Error('consent persistence failed');
      const body = await response.json();
      if (!Array.isArray(body?.consents)) throw new Error('consent confirmation missing');
      const found = (body.consents as ChannelConsent[]).find(x=>x.channel===channel && x.purpose===purpose);
      if (!found || found.optedIn !== optedIn) throw new Error('consent confirmation mismatch');
      setChannelConsents(current=>({...current,[key]:optedIn}));
      setNotice(optedIn
        ? 'Sua escolha foi registrada. Mensagens externas dependem da confirmação do canal; nenhum disparo automático foi ativado.'
        : 'Autorização retirada na Nexa. Para mensagens já recebidas, também use a opção de parar no canal.');
    } catch {
      setNotice('Não conseguimos confirmar sua escolha. Nada foi alterado nesta tela.');
    } finally {
      setChannelConsentSaving(null);
    }
  }

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
    // Retain the same client message ID if the connection fails after
    // the backend commits. Replaying with a new ID would duplicate Theo.
    if (!pendingMessage.current || pendingMessage.current.text !== text) {
      pendingMessage.current = { text, requestId: Crypto.randomUUID() };
    }
    const requestId = pendingMessage.current.requestId;
    setSending(true);
    try {
      const response = await fetch((config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl) + '/central-nexa/support', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, clientMessageId: requestId }),
      });
      if (!response.ok) {
        setNotice('Mensagem não enviada. Não inclua CPF, e-mail, telefone ou documentos. Você pode usar o atendimento externo.');
        return;
      }
      pendingMessage.current = null;
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
      if (!result.granted) {
        setPushState('denied');
        setNotice('As notificações não foram autorizadas. Você poderá ajustar isso nas configurações do aparelho.');
        return;
      }
      const registration = await registerNexaCentralServicePush();
      setPushState(registration.registered ? 'granted' : 'idle');
      setNotice(registration.registered
        ? 'Seu aparelho foi registrado para avisos de serviço. A entrega remota ainda está em homologação; ofertas continuam desativadas.'
        : 'O aparelho permitiu notificações, mas ainda não conseguimos registrar este dispositivo na Nexa. Nenhum envio foi ativado.');
    } catch {
      setPushState('denied');
      setNotice('Não foi possível solicitar a permissão neste aparelho. Tente novamente mais tarde.');
    }
  }

  async function sendPushSelfTest() {
    if (pushState !== 'granted') {
      setNotice('Primeiro autorize avisos de serviço e registre seu aparelho.');
      return;
    }
    const session=await loadNexaSession();
    if (!session) { setNotice('Entre na Nexa para testar notificações.');return; }
    try {
      const base=config.apiUrl.endsWith('/') ? config.apiUrl.slice(0,-1) : config.apiUrl;
      const response=await fetch(base+'/central-nexa/push/test-me',{
        method:'POST',headers:{Authorization:'Bearer '+session.accessToken},
      });
      if(!response.ok) throw new Error('push_test_unavailable');
      const result=await response.json();
      setNotice(result?.acceptedForDelivery===true
        ? 'Pedido de teste registrado. Feche o app normalmente para conferir a notificação. A entrega ainda depende do serviço de push do aparelho.'
        : result?.reason==='already_requested_today'
          ? 'Você já pediu um teste hoje. Confira a Central Nexa e as notificações do aparelho.'
          : 'Teste registrado na Central, mas a entrega remota ainda não está disponível.');
    }catch {
      setNotice('O teste de push ainda não está liberado no servidor. Nenhum aviso foi disparado.');
    }
  }

  async function disablePush() {
    setPushState('loading');
    try {
      const revoked = await revokeNexaCentralServicePush();
      if (revoked) {
        setPushState('idle');
        setPreferences(current => current ? {...current,servicePushOptIn:false} : current);
        setNotice('Avisos de serviço desativados para este aparelho.');
      } else {
        setPushState('idle');
        setNotice('Não foi possível confirmar a desativação. Você pode bloquear notificações nas configurações do aparelho.');
      }
    } catch {
      setPushState('idle');
      setNotice('Não foi possível confirmar a desativação no servidor.');
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
              onChangeText={value => { if (value !== draft) pendingMessage.current = null; setDraft(value); }}
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
        {inboxState === 'ready' ? (
          <>
            <Action title={pushState === 'granted' ? 'Avisos de serviço: aparelho registrado' : pushState === 'loading' ? 'Verificando aparelho…' : 'Ativar avisos de serviço'} detail="Registra o aparelho para avisos de serviço; não autoriza publicidade." onPress={() => { if (pushState !== 'loading' && pushState !== 'granted') void enablePush(); }} />
            {pushState === 'granted' ? (
              <Action title="Testar notificação neste celular"
                detail="Envia no máximo um teste por dia, somente após seu pedido e autorização"
                onPress={() => void sendPushSelfTest()} />
            ) : null}
            {pushState === 'granted' || preferences?.servicePushOptIn ? (
              <Action title="Desativar avisos neste aparelho" detail="Revoga o dispositivo e a preferência de serviço" onPress={() => { if (pushState !== 'loading') void disablePush(); }} />
            ) : null}
          </>
        ) : (
          <Text style={styles.paragraph}>Os avisos push estão em preparação. Quando estiverem disponíveis, você poderá escolher ativá-los aqui.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Converse com a Nexa onde preferir</Text>
        <Text style={styles.paragraph}>
          Quer orientações de cadastro, KYC e depósitos pelo WhatsApp ou Telegram?
          Você escolhe cada canal e pode retirar a autorização quando quiser.
          Notícias sobre cripto e ofertas são opcionais e exigem escolha separada.
          A Nexa não pede senhas, códigos nem documentos pelo chat.
        </Text>
        {channelConsentState === 'ready' ? (
          <>
            {CHANNEL_OPTIONS.map(option => {
              const key:ChannelConsentKey = `${option.channel}:${option.purpose}`;
              const enabled = channelConsents[key] === true;
              return <Action key={key}
                title={option.label + (enabled ? ': autorizado' : ': não autorizado')}
                detail={channelConsentSaving === key ? 'Salvando escolha…' : enabled ? 'Toque para revogar' : 'Toque para autorizar'}
                onPress={() => { if (!channelConsentSaving) void setChannelConsent(option.channel,option.purpose,!enabled); }}
              />;
            })}
            <Text style={styles.footnote}>Autorizar mensagens não vincula automaticamente o número ou o Telegram à sua conta. O canal precisa ser verificado antes de qualquer envio.</Text>
          </>
        ) : (
          <Text style={styles.paragraph}>As preferências de WhatsApp e Telegram estão em preparação. Quando estiverem disponíveis, você poderá autorizar ou recusar cada tipo de mensagem aqui.</Text>
        )}
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
