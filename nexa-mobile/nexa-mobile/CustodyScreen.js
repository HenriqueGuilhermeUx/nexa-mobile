import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const API =
  process.env.EXPO_PUBLIC_NEXA_API_URL ||
  'https://nexa-backend-p2u0.onrender.com/api/v1';

function ActionButton({ title, onPress, secondary, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={{
        backgroundColor: secondary ? '#111c2f' : '#2563eb',
        borderWidth: 1,
        borderColor: secondary ? '#263650' : '#3b82f6',
        opacity: disabled ? 0.55 : 1,
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginTop: 10,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>{title}</Text>
    </TouchableOpacity>
  );
}

function Field(props) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#64748b"
      style={{
        backgroundColor: '#07101e',
        borderWidth: 1,
        borderColor: '#263650',
        color: '#fff',
        borderRadius: 14,
        padding: 14,
        marginTop: 10,
      }}
    />
  );
}

function ChoiceCard({ active, title, subtitle, bullets, accent, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={{
      backgroundColor: active ? '#12213e' : '#0b1220',
      borderWidth: 1,
      borderColor: active ? accent : '#1e293b',
      borderRadius: 22,
      padding: 18,
      marginTop: 12,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{title}</Text>
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} /> : null}
        </View>
      </View>
      <Text style={{ color: '#94a3b8', marginTop: 6, lineHeight: 19 }}>{subtitle}</Text>
      {bullets.map((item) => (
        <Text key={item} style={{ color: '#cbd5e1', marginTop: 8 }}>✓ {item}</Text>
      ))}
    </TouchableOpacity>
  );
}

export default function CustodyScreen({ user, token, onBack, onBalanceRefresh }) {
  const [overview, setOverview] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [amount, setAmount] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedMode, setSelectedMode] = useState('nexa');

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };

  async function loadOverview() {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await fetch(
        API + '/custody/overview?userId=' + encodeURIComponent(user.id) + '&_=' + Date.now(),
        { headers: authHeaders },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Falha ao carregar custódia');
      setOverview(data);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createReturnInstructions() {
    try {
      setLoading(true);
      setMessage('Gerando endereço seguro de depósito...');
      const response = await fetch(
        API + '/custody/deposit-instructions?userId=' + encodeURIComponent(user.id),
        { headers: authHeaders },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Falha ao gerar endereço Nexa');
      setInstructions(data);
      setMessage('Endereço gerado. Envie somente USDC pela rede Polygon.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function moveToOwnWallet() {
    const amountUsdc = Number(String(amount).replace(',', '.'));
    if (!amountUsdc || amountUsdc <= 0) return setMessage('Informe um valor USDC válido.');
    if (!otpCode) return setMessage('Informe o OTP de segurança para concluir.');

    try {
      setLoading(true);
      const response = await fetch(API + '/custody/move-to-own-wallet', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: user.id,
          amountUsdc,
          otpCode,
          note: 'Custódia Inteligente Nexa - Modo Carteira Própria',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Falha ao mover para carteira');
      setAmount('');
      setOtpCode('');
      setMessage('USDC enviado para sua Carteira Própria na Polygon.');
      await loadOverview();
      if (onBalanceRefresh) onBalanceRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmReturn() {
    if (!instructions?.depositId) return setMessage('Gere primeiro o endereço Nexa.');
    if (!txHash || !String(txHash).startsWith('0x')) return setMessage('Informe o hash da transação Polygon.');

    try {
      setLoading(true);
      const response = await fetch(API + '/custody/return-to-nexa', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: user.id,
          depositId: instructions.depositId,
          txHash: txHash.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Falha ao confirmar volta');
      setTxHash('');
      setInstructions(null);
      setMessage('USDC confirmado e liberado novamente no Modo Nexa.');
      await loadOverview();
      if (onBalanceRefresh) onBalanceRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [user?.id]);

  const nexaUsdc = Number(overview?.balances?.nexa?.USDC || 0);
  const ownUsdc = Number(overview?.balances?.ownWallet?.USDC || 0);
  const walletAddress = overview?.wallet?.address || '';
  const currentMode = overview?.mode || 'nexa';
  const modeLabel = currentMode === 'hybrid' ? 'Híbrido' : currentMode === 'own_wallet' ? 'Carteira Própria' : 'Modo Nexa';

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
        <Text style={{ color: '#7dd3fc', fontWeight: '900' }}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={{ color: '#fff', fontSize: 29, fontWeight: '900', letterSpacing: -0.8 }}>
        Saldo Nexa e carteira individual
      </Text>
      <Text style={{ color: '#94a3b8', marginTop: 7, lineHeight: 20 }}>
        Você pode manter USDC no Saldo Nexa e também usar sua carteira individual na rede Polygon.
      </Text>

      <View style={{ backgroundColor: '#0a1220', borderRadius: 24, padding: 18, marginTop: 18, borderWidth: 1, borderColor: '#1e293b' }}>
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }}>MODO ATUAL</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 }}>{modeLabel}</Text>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={{ color: '#94a3b8' }}>Disponível na Nexa</Text>
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 5 }}>{nexaUsdc.toFixed(6)}</Text>
            <Text style={{ color: '#60a5fa' }}>USDC</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={{ color: '#94a3b8' }}>Na sua carteira</Text>
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 5 }}>{ownUsdc.toFixed(6)}</Text>
            <Text style={{ color: '#34d399' }}>USDC on-chain</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 14 }} /> : null}
        <ActionButton title="Atualizar saldos" secondary onPress={loadOverview} disabled={loading} />
      </View>

      <ChoiceCard
        active={currentMode === 'nexa' || currentMode === 'hybrid'}
        title="Saldo Nexa"
        subtitle="Mais simples para o dia a dia."
        bullets={['Pix e transferências por @username', 'USDC por assinatura', 'Movimentações internas instantâneas']}
        accent="#60a5fa"
        onPress={() => setSelectedMode('nexa')}
      />

      <ChoiceCard
        active={currentMode === 'own_wallet' || currentMode === 'hybrid'}
        title="Carteira individual"
        subtitle="Seu endereço on-chain vinculado à Nexa."
        bullets={['Receber USDC externo', 'Movimentar USDC pela rede Polygon', 'Endereço individual vinculado à sua conta']}
        accent="#34d399"
        onPress={() => setSelectedMode('own_wallet')}
      />

      {selectedMode === 'own_wallet' ? (
      <View style={{ backgroundColor: '#0b1220', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#1e293b' }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Mover para minha carteira</Text>
        <Text style={{ color: '#94a3b8', marginTop: 6, lineHeight: 19 }}>
          O valor sai do Modo Nexa e vai para sua carteira Polygon. Você poderá usar o ativo fora da plataforma.
        </Text>
        <Field placeholder="Valor em USDC" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field placeholder="Código OTP de segurança" value={otpCode} onChangeText={setOtpCode} keyboardType="numeric" />
        <ActionButton title="Mover para Carteira Própria" onPress={moveToOwnWallet} disabled={loading} />
        {walletAddress ? (
          <Text selectable style={{ color: '#64748b', fontSize: 11, marginTop: 11 }}>Sua carteira: {walletAddress}</Text>
        ) : null}
      </View>
      ) : null}

      {selectedMode === 'nexa' ? (
      <View style={{ backgroundColor: '#0b1220', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#1e293b' }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Trazer para o Modo Nexa</Text>
        <Text style={{ color: '#94a3b8', marginTop: 6, lineHeight: 19 }}>
          Envie USDC Polygon para o endereço Nexa abaixo. Depois confirme a transação para voltar a usar Pix e @username.
        </Text>
        <ActionButton title="Gerar endereço Nexa" secondary onPress={createReturnInstructions} disabled={loading} />

        {instructions?.treasuryAddress ? (
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 14 }}>
              <QRCode value={instructions.treasuryAddress} size={190} />
            </View>
            <Text selectable style={{ color: '#fff', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{instructions.treasuryAddress}</Text>
            <Text style={{ color: '#fbbf24', marginTop: 8, textAlign: 'center', fontWeight: '800' }}>Rede Polygon • somente USDC</Text>
            <Field placeholder="Hash da transação 0x..." value={txHash} onChangeText={setTxHash} autoCapitalize="none" />
            <ActionButton title="Confirmar volta para Nexa" onPress={confirmReturn} disabled={loading} />
          </View>
        ) : null}
      </View>
      ) : null}

      {message ? (
        <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#263650' }}>
          <Text style={{ color: '#e2e8f0', lineHeight: 19 }}>{message}</Text>
        </View>
      ) : null}

      <Text style={{ color: '#334155', textAlign: 'center', fontSize: 12, fontWeight: '800', marginVertical: 24 }}>
        Cripto sem complicação.
      </Text>
    </ScrollView>
  );
}
