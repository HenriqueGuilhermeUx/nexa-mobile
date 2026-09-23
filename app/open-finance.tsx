import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '@/config';
import {
  efiOpenFinanceApi,
  participantIdOf,
  participantNameOf,
} from '@/lib/efiOpenFinance';
import { loadNexaSession } from '@/lib/session';

type Participant = Record<string, any>;

export default function OpenFinanceScreen() {
  const [token, setToken] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Participant | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [status, setStatus] = useState('');
  const [backendReady, setBackendReady] = useState(false);
  const [ledgerCreditEnabled, setLedgerCreditEnabled] = useState(false);
  const [paymentInitiationEnabled, setPaymentInitiationEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const lastAppState = useRef(AppState.currentState);

  function applyDepositStatus(nextStatusRaw: string, ledgerEnabled: boolean) {
    const nextStatus = String(nextStatusRaw || '').toLowerCase();
    setStatus(nextStatus);
    if (nextStatus === 'credited') {
      setMessage('Dinheiro confirmado e creditado na Nexa.');
    } else if (nextStatus === 'paid') {
      setMessage(
        ledgerEnabled
          ? 'Pagamento confirmado. A Nexa está finalizando o crédito.'
          : 'Pagamento confirmado. O crédito no saldo continua desligado por segurança.',
      );
    } else if (nextStatus === 'failed') {
      setMessage('O pagamento não foi concluído. Você pode tentar novamente.');
    } else if (nextStatus) {
      setMessage('Aguardando sua autorização e a confirmação do banco.');
    }
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!config.efiOpenFinanceEnabled) {
        setMessage('Trazer dinheiro de outro banco ainda não está habilitado neste build.');
        return;
      }

      try {
        setLoading(true);
        const session = await loadNexaSession();
        if (!session?.accessToken) {
          router.replace('/sign-in');
          return;
        }
        if (!mounted) return;
        setToken(session.accessToken);

        const providerStatus = await efiOpenFinanceApi.status(session.accessToken);
        if (!mounted) return;
        const ledgerEnabled = Boolean(providerStatus.ledgerCreditEnabled);
        setBackendReady(Boolean(providerStatus.enabled && providerStatus.configured));
        setLedgerCreditEnabled(ledgerEnabled);
        setPaymentInitiationEnabled(Boolean(providerStatus.paymentInitiationEnabled));

        if (!providerStatus.enabled || !providerStatus.configured) {
          setMessage('Open Finance ainda não está disponível neste ambiente.');
          return;
        }

        const list = await efiOpenFinanceApi.participants(session.accessToken);
        if (!mounted) return;
        setParticipants(list.filter((item) => participantIdOf(item)));

        try {
          const latest = await efiOpenFinanceApi.latestDeposit(session.accessToken);
          if (!mounted) return;
          if (latest?.found && latest?.paymentId) {
            setPaymentId(latest.paymentId);
            if (typeof latest.amountBrl === 'number') {
              setAmount(String(latest.amountBrl));
            }
            applyDepositStatus(String(latest.status || 'pending'), ledgerEnabled);
          }
        } catch (error: any) {
          if (mounted) {
            setMessage(
              error?.message ||
                'Open Finance carregado, mas não foi possível recuperar o último depósito.',
            );
          }
        }
      } catch (error: any) {
        if (mounted) setMessage(error?.message || 'Não foi possível carregar o Open Finance.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function refreshDepositStatus() {
    try {
      setLoading(true);
      setMessage('Consultando a confirmação do banco...');

      const session = await loadNexaSession();
      const activeToken = String(session?.accessToken || '').trim();
      if (!activeToken) {
        throw new Error('Sua sessão Nexa expirou. Entre novamente para consultar o depósito.');
      }
      setToken(activeToken);

      let activePaymentId = String(paymentId || '').trim();
      if (!activePaymentId) {
        const latest = await efiOpenFinanceApi.latestDeposit(activeToken);
        if (!latest?.found || !latest?.paymentId) {
          throw new Error('Nenhum depósito Open Finance pendente foi encontrado para sua conta.');
        }
        activePaymentId = String(latest.paymentId).trim();
        setPaymentId(activePaymentId);
        if (typeof latest.amountBrl === 'number') {
          setAmount(String(latest.amountBrl));
        }
      }

      const data = await efiOpenFinanceApi.depositStatus(activeToken, activePaymentId);
      const ledgerEnabled = Boolean(data?.ledgerCreditEnabled ?? ledgerCreditEnabled);
      setLedgerCreditEnabled(ledgerEnabled);
      applyDepositStatus(String(data?.status || ''), ledgerEnabled);
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível atualizar o depósito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasAway = /inactive|background/.test(lastAppState.current);
      lastAppState.current = nextState;
      if (wasAway && nextState === 'active' && paymentId) {
        void refreshDepositStatus();
      }
    });
    return () => subscription.remove();
  }, [paymentId, ledgerCreditEnabled]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return participants.slice(0, 40);
    return participants
      .filter((item) => participantNameOf(item).toLocaleLowerCase('pt-BR').includes(needle))
      .slice(0, 40);
  }, [participants, search]);

  async function startDeposit() {
    if (!backendReady) return setMessage('Open Finance ainda não está disponível neste ambiente.');
    if (!paymentInitiationEnabled) {
      return setMessage(
        'A integração com os bancos está ativa para validação, mas iniciar movimentações continua bloqueado por segurança.',
      );
    }
    if (!token) return setMessage('Sua sessão Nexa expirou. Entre novamente.');
    if (!selected) return setMessage('Escolha o banco de onde o dinheiro vai sair.');

    const value = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      return setMessage('Informe um valor válido em reais.');
    }

    const participantId = participantIdOf(selected);
    if (!participantId) return setMessage('Não foi possível identificar esse banco.');

    try {
      setLoading(true);
      setMessage('Preparando a autorização no seu banco...');
      const data = await efiOpenFinanceApi.startDeposit(token, {
        amountBrl: value,
        participantId,
      });

      if (!data?.paymentId || !data?.redirectURI) {
        throw new Error('A Efí não retornou a autorização do banco.');
      }

      setPaymentId(data.paymentId);
      setStatus(String(data.status || 'pending_authorization'));
      await Linking.openURL(data.redirectURI);
      setMessage('Autorize no seu banco e volte para a Nexa. Vamos conferir a confirmação automaticamente.');
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível iniciar o depósito.');
    } finally {
      setLoading(false);
    }
  }

  const startDisabled = loading || !selected || !paymentInitiationEnabled;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Trazer dinheiro</Text>
            <Text style={styles.subtitle}>Do seu banco direto para a Nexa.</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OPEN FINANCE</Text>
          <Text style={styles.heroTitle}>Sem copiar Pix.</Text>
          <Text style={styles.heroText}>
            Escolha seu banco, informe o valor e autorize com segurança no próprio banco.
          </Text>
        </View>

        {message ? (
          <TouchableOpacity style={styles.notice} onPress={() => setMessage('')}>
            <Text style={styles.noticeText}>{message}</Text>
          </TouchableOpacity>
        ) : null}

        {!config.efiOpenFinanceEnabled || !backendReady ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Indisponível no momento</Text>
            <Text style={styles.cardText}>
              A integração está preparada, mas permanece bloqueada até a validação final da Nexa.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Valor</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="R$ 100,00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>De qual banco?</Text>
              <TextInput
                style={styles.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar banco"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <View style={styles.bankList}>
                {filtered.map((item) => {
                  const id = participantIdOf(item);
                  const name = participantNameOf(item);
                  const active = participantIdOf(selected || {}) === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.bankButton, active ? styles.bankButtonActive : null]}
                      onPress={() => setSelected(item)}
                    >
                      <Text style={[styles.bankName, active ? styles.bankNameActive : null]}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!paymentInitiationEnabled ? (
                <Text style={styles.safetyNotice}>
                  Validação segura ativa: os bancos podem ser consultados, mas iniciar movimentação ainda está bloqueado.
                </Text>
              ) : null}

              <TouchableOpacity
                disabled={startDisabled}
                onPress={startDeposit}
                style={[styles.primaryButton, startDisabled ? styles.disabled : null]}
              >
                <Text style={styles.primaryButtonText}>
                  {paymentInitiationEnabled ? 'Autorizar no meu banco' : 'Movimentação bloqueada no piloto'}
                </Text>
              </TouchableOpacity>
            </View>

            {paymentId ? (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>DEPÓSITO NEXA</Text>
                <Text style={styles.cardTitle}>Status: {status || 'pendente'}</Text>
                <Text style={styles.cardText}>
                  Este depósito fica vinculado à sua conta Nexa mesmo se o app for fechado durante a autorização bancária.
                </Text>
                <TouchableOpacity
                  disabled={loading}
                  onPress={() => void refreshDepositStatus()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Atualizar status</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {loading ? <ActivityIndicator size="large" color="#60a5fa" style={{ marginTop: 18 }} /> : null}

        <Text style={styles.securityText}>
          A Nexa nunca pede sua senha bancária. A autorização acontece no ambiente do seu banco.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 18, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  backText: { color: '#ffffff', fontSize: 31, lineHeight: 32 },
  title: { color: '#ffffff', fontSize: 25, fontWeight: '900' },
  subtitle: { color: '#94a3b8', marginTop: 2 },
  hero: {
    backgroundColor: '#0d1b32',
    borderWidth: 1,
    borderColor: '#244980',
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  eyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { color: '#ffffff', fontSize: 27, fontWeight: '900', marginTop: 8 },
  heroText: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 8 },
  notice: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#263650',
    borderRadius: 15,
    padding: 13,
    marginBottom: 14,
  },
  noticeText: { color: '#e2e8f0', fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: { color: '#ffffff', fontSize: 19, fontWeight: '900', marginTop: 7 },
  cardText: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 7 },
  label: { color: '#cbd5e1', fontWeight: '800', fontSize: 12, marginTop: 10, marginBottom: 7 },
  input: {
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#263650',
    color: '#ffffff',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  bankList: { gap: 8, marginTop: 12, maxHeight: 320 },
  bankButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#263650',
  },
  bankButtonActive: { backgroundColor: '#12213e', borderColor: '#3b82f6' },
  bankName: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  bankNameActive: { color: '#ffffff' },
  safetyNotice: {
    color: '#fbbf24',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  secondaryButton: {
    backgroundColor: '#111c2f',
    borderWidth: 1,
    borderColor: '#263650',
    borderRadius: 15,
    paddingVertical: 14,
    marginTop: 14,
  },
  secondaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  securityText: { color: '#64748b', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 },
});
