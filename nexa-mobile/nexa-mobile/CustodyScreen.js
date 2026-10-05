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

const DEFAULT_API = 'https://nexa-backend-p2u0.onrender.com/api/v1';

function ActionButton({ title, onPress, secondary, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={{
        backgroundColor: secondary ? '#132A45' : '#218BFF',
        borderWidth: 1,
        borderColor: secondary ? '#284B68' : '#31D7FF',
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
      placeholderTextColor="#70879F"
      style={{
        backgroundColor: '#081726',
        borderWidth: 1,
        borderColor: '#284B68',
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
      backgroundColor: active ? '#102A42' : '#0E2138',
      borderWidth: 1,
      borderColor: active ? accent : '#203B59',
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
      <Text style={{ color: '#A9BCD0', marginTop: 6, lineHeight: 19 }}>{subtitle}</Text>
      {bullets.map((item) => (
        <Text key={item} style={{ color: '#D5E2EF', marginTop: 8 }}>✓ {item}</Text>
      ))}
    </TouchableOpacity>
  );
}

export default function CustodyScreen({
  user,
  token,
  onBack,
  onBalanceRefresh,
  apiUrl = DEFAULT_API,
  financialExecutionEnabled = false,
  onSendExternalUsdc,
  clientHeaders = {},
  privyWalletReady = false,
}) {
  const API = String(apiUrl || DEFAULT_API).replace(/\/$/, '');
  const [overview, setOverview] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [amount, setAmount] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedMode, setSelectedMode] = useState('nexa');
  const [externalToAddress, setExternalToAddress] = useState('');
  const [externalAmountUsdc, setExternalAmountUsdc] = useState('');
  const [externalTxHash, setExternalTxHash] = useState('');
  const [externalSending, setExternalSending] = useState(false);
  const [externalReview, setExternalReview] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...clientHeaders,
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };

  async function loadOverview() {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await fetch(
        API + '/custody/overview?_=' + Date.now(),
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
        API + '/custody/deposit-instructions',
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
    if (!financialExecutionEnabled) {
      return setMessage('Movimentação on-chain está bloqueada neste build de preview.');
    }
    const amountUsdc = Number(String(amount).replace(',', '.'));
    if (!amountUsdc || amountUsdc <= 0) return setMessage('Informe um valor USDC válido.');
    if (!otpCode) return setMessage('Informe o OTP de segurança para concluir.');

    try {
      setLoading(true);
      const response = await fetch(API + '/custody/move-to-own-wallet', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amountUsdc,
          otpCode,
          note: 'Custódia Inteligente Nexa - Modo Minha Wallet',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Falha ao mover para carteira');
      setAmount('');
      setOtpCode('');
      setMessage('USDC enviado para sua Minha Wallet na Polygon.');
      await loadOverview();
      if (onBalanceRefresh) onBalanceRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmReturn() {
    if (!financialExecutionEnabled) {
      return setMessage('Confirmação de retorno está bloqueada neste build de preview.');
    }
    if (!instructions?.depositId) return setMessage('Gere primeiro o endereço Nexa.');
    if (!txHash || !String(txHash).startsWith('0x')) return setMessage('Informe o hash da transação Polygon.');

    try {
      setLoading(true);
      const response = await fetch(API + '/custody/return-to-nexa', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          depositId: instructions.depositId,
          txHash: txHash.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Falha ao confirmar retorno');
      setTxHash('');
      setInstructions(null);
      setMessage('USDC confirmado e liberado novamente no Recursos Nexa.');
      await loadOverview();
      if (onBalanceRefresh) onBalanceRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function reviewExternalUsdc() {
    const toAddress = String(externalToAddress || '').trim();
    const amountUsdc = Number(String(externalAmountUsdc || '').replace(',', '.'));

    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return setMessage('Confira o endereço da wallet de destino.');
    }
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      return setMessage('Informe um valor USDC válido.');
    }
    if (amountUsdc > ownUsdc) {
      return setMessage('Seu saldo USDC disponível não é suficiente para este envio.');
    }
    if (!financialExecutionEnabled) {
      return setMessage('Envio externo está bloqueado neste build de preview.');
    }
    if (!privyWalletReady || typeof onSendExternalUsdc !== 'function') {
      return setMessage('Sua wallet ainda não está pronta neste dispositivo.');
    }
    setMessage('');
    setExternalReview(true);
  }

  async function sendExternalUsdc() {
    const toAddress = String(externalToAddress || '').trim();
    const amountUsdc = Number(String(externalAmountUsdc || '').replace(',', '.'));

    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return setMessage('Informe um endereço 0x válido.');
    }
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      return setMessage('Informe um valor USDC válido.');
    }
    if (amountUsdc > ownUsdc) {
      return setMessage('Saldo USDC insuficiente na sua wallet individual.');
    }
    if (!financialExecutionEnabled) {
      return setMessage('Envio externo está bloqueado neste build de preview.');
    }
    if (!privyWalletReady || typeof onSendExternalUsdc !== 'function') {
      return setMessage('Carteira Privy não está pronta neste dispositivo.');
    }

    try {
      setExternalSending(true);
      setMessage('Confirme a transação na sua carteira Privy...');
      const result = await onSendExternalUsdc({ toAddress, amountUsdc });
      const hash = String(result?.txHash || '');
      setExternalTxHash(hash);
      setExternalReview(false);
      setExternalAmountUsdc('');
      setExternalToAddress('');
      setMessage(
        result?.journalWarning ||
          result?.journal?.message ||
          'USDC enviado pela sua wallet individual.',
      );
      await loadOverview();
      if (onBalanceRefresh) await onBalanceRefresh();
    } catch (error) {
      setMessage(error?.message || 'Não foi possível enviar o USDC.');
    } finally {
      setExternalSending(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [user?.id]);

  const nexaUsdc = Number(overview?.balances?.nexa?.USDC || 0);
  const ownUsdc = Number(overview?.balances?.ownWallet?.USDC || 0);
  const walletAddress = overview?.wallet?.address || '';
  const currentMode = overview?.mode || 'nexa';
  const modeLabel = currentMode === 'hybrid' ? 'Híbrido' : currentMode === 'own_wallet' ? 'Minha Wallet' : 'Recursos Nexa';

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
        <Text style={{ color: '#31D7FF', fontWeight: '900' }}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={{ color: '#fff', fontSize: 29, fontWeight: '900', letterSpacing: -0.8 }}>
        Opções avançadas da wallet
      </Text>
      <Text style={{ color: '#A9BCD0', marginTop: 7, lineHeight: 20 }}>
        Aqui ficam recursos técnicos e de interoperabilidade. Para o uso diário, volte à tela Minha Wallet.
      </Text>

      <View style={{ backgroundColor: '#0E2138', borderRadius: 24, padding: 18, marginTop: 18, borderWidth: 1, borderColor: '#203B59' }}>
        <Text style={{ color: '#70879F', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }}>MODO ATUAL</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 }}>{modeLabel}</Text>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={{ color: '#A9BCD0' }}>Disponível na Nexa</Text>
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 5 }}>{nexaUsdc.toFixed(6)}</Text>
            <Text style={{ color: '#31D7FF' }}>USDC</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={{ color: '#A9BCD0' }}>Na sua carteira</Text>
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 5 }}>{ownUsdc.toFixed(6)}</Text>
            <Text style={{ color: '#35D69A' }}>USDC on-chain</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 14 }} /> : null}
        <ActionButton title="Atualizar saldos" secondary onPress={loadOverview} disabled={loading} />
      </View>

      <ChoiceCard
        active={currentMode === 'nexa' || currentMode === 'hybrid'}
        title="Recursos Nexa"
        subtitle="Mais simples para o dia a dia."
        bullets={['Pix e transferências por @username', 'Compra automática e Premium', 'Operações instantâneas no app']}
        accent="#31D7FF"
        onPress={() => setSelectedMode('nexa')}
      />

      <ChoiceCard
        active={currentMode === 'own_wallet' || currentMode === 'hybrid'}
        title="Minha Wallet"
        subtitle="Mais liberdade e controle on-chain."
        bullets={['Uso em qualquer app compatível', 'Controle direto dos ativos', 'Rede Polygon e wallet individual']}
        accent="#35D69A"
        onPress={() => setSelectedMode('own_wallet')}
      />

      {selectedMode === 'own_wallet' && walletAddress ? (
      <View style={{ backgroundColor: '#0E2138', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#203B59' }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Receber USDC externamente</Text>
        <Text style={{ color: '#A9BCD0', marginTop: 6, lineHeight: 19 }}>
          Use este endereço para receber USDC diretamente na sua wallet individual. Envie somente USDC pela rede Polygon.
        </Text>
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 14 }}>
            <QRCode value={walletAddress} size={190} />
          </View>
          <Text selectable style={{ color: '#fff', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            {walletAddress}
          </Text>
          <Text style={{ color: '#F3C86B', marginTop: 8, textAlign: 'center', fontWeight: '800' }}>
            Rede Polygon • somente USDC
          </Text>
        </View>
      </View>
      ) : null}

      {selectedMode === 'own_wallet' && walletAddress ? (
      <View style={{ backgroundColor: '#0E2138', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#203B59' }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Enviar para carteira externa</Text>
        <Text style={{ color: '#A9BCD0', marginTop: 6, lineHeight: 19 }}>
          Envie USDC diretamente da sua wallet individual. A assinatura acontece na Privy, no seu dispositivo.
        </Text>
        <Field
          placeholder="Carteira 0x..."
          value={externalToAddress}
          onChangeText={(value) => {
            setExternalToAddress(value);
            setExternalReview(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          placeholder="Valor em USDC"
          value={externalAmountUsdc}
          onChangeText={(value) => {
            setExternalAmountUsdc(value);
            setExternalReview(false);
          }}
          keyboardType="decimal-pad"
        />
        {!externalReview ? (
          <ActionButton
            title={
              financialExecutionEnabled
                ? 'Revisar envio'
                : 'Envio externo bloqueado no preview'
            }
            onPress={reviewExternalUsdc}
            disabled={
              loading ||
              externalSending ||
              !financialExecutionEnabled ||
              !privyWalletReady
            }
          />
        ) : (
          <View style={{
            backgroundColor: '#081726',
            borderWidth: 1,
            borderColor: '#284B68',
            borderRadius: 16,
            padding: 14,
            marginTop: 12,
          }}>
            <Text style={{ color: '#70879F', fontSize: 11 }}>VOCÊ ENVIA</Text>
            <Text style={{ color: '#F4F8FC', fontSize: 24, fontWeight: '900', marginTop: 4 }}>
              {Number(String(externalAmountUsdc).replace(',', '.')).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} USDC
            </Text>
            <Text style={{ color: '#70879F', fontSize: 11, marginTop: 12 }}>PARA</Text>
            <Text selectable style={{ color: '#D5E2EF', fontSize: 11, lineHeight: 17, marginTop: 4 }}>
              {externalToAddress}
            </Text>
            <Text style={{ color: '#F3C86B', fontSize: 11, lineHeight: 17, marginTop: 12 }}>
              Confira os dados antes de confirmar. Operações na blockchain podem ser irreversíveis.
            </Text>
            <ActionButton
              title={externalSending ? 'Enviando...' : 'Confirmar envio'}
              onPress={sendExternalUsdc}
              disabled={externalSending}
            />
            <ActionButton
              title="Editar dados"
              secondary
              onPress={() => setExternalReview(false)}
              disabled={externalSending}
            />
          </View>
        )}
        <Text style={{ color: '#70879F', fontSize: 11, marginTop: 10, lineHeight: 17 }}>
          Rede compatível: Polygon. Envie somente USDC. Taxas de rede aparecem apenas quando forem necessárias.
        </Text>
        {!financialExecutionEnabled ? (
          <Text style={{ color: '#F3C86B', marginTop: 8, lineHeight: 18 }}>
            Preview seguro: a tela pode ser validada, mas nenhuma transação é assinada ou transmitida.
          </Text>
        ) : null}
        {externalTxHash ? (
          <Text selectable style={{ color: '#31D7FF', fontSize: 11, marginTop: 10 }}>
            Identificador da operação: {externalTxHash}
          </Text>
        ) : null}
      </View>
      ) : null}

      {selectedMode === 'own_wallet' ? (
      <View style={{ backgroundColor: '#0E2138', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#203B59' }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Mover para minha carteira</Text>
        <Text style={{ color: '#A9BCD0', marginTop: 6, lineHeight: 19 }}>
          O valor sai do Recursos Nexa e vai para sua wallet na Polygon. Você poderá usar o ativo fora da plataforma.
        </Text>
        <Field placeholder="Valor em USDC" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field placeholder="Código OTP de segurança" value={otpCode} onChangeText={setOtpCode} keyboardType="numeric" />
        <ActionButton
          title={financialExecutionEnabled ? 'Mover para Minha Wallet' : 'Movimentação bloqueada no preview'}
          onPress={moveToOwnWallet}
          disabled={loading || !financialExecutionEnabled}
        />
        {!financialExecutionEnabled ? (
          <Text style={{ color: '#F3C86B', marginTop: 10, lineHeight: 18 }}>
            Preview seguro: nenhuma saída on-chain é executada neste build.
          </Text>
        ) : null}
        {walletAddress ? (
          <Text selectable style={{ color: '#70879F', fontSize: 11, marginTop: 11 }}>Sua carteira: {walletAddress}</Text>
        ) : null}
      </View>
      ) : null}

      {selectedMode === 'nexa' ? (
      <View style={{ backgroundColor: '#0E2138', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#203B59' }}>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>Trazer para o Recursos Nexa</Text>
        <Text style={{ color: '#A9BCD0', marginTop: 6, lineHeight: 19 }}>
          Envie USDC Polygon para o endereço Nexa abaixo. Depois confirme a transação para voltar a usar Pix e @username.
        </Text>
        <ActionButton title="Gerar endereço Nexa" secondary onPress={createReturnInstructions} disabled={loading} />

        {instructions?.treasuryAddress ? (
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 14 }}>
              <QRCode value={instructions.treasuryAddress} size={190} />
            </View>
            <Text selectable style={{ color: '#fff', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{instructions.treasuryAddress}</Text>
            <Text style={{ color: '#F3C86B', marginTop: 8, textAlign: 'center', fontWeight: '800' }}>Rede Polygon • somente USDC</Text>
            <Field placeholder="Hash da transação 0x..." value={txHash} onChangeText={setTxHash} autoCapitalize="none" />
            <ActionButton
              title={financialExecutionEnabled ? 'Confirmar retorno para Nexa' : 'Confirmação bloqueada no preview'}
              onPress={confirmReturn}
              disabled={loading || !financialExecutionEnabled}
            />
          </View>
        ) : null}
      </View>
      ) : null}

      {message ? (
        <View style={{ backgroundColor: '#132A45', borderRadius: 16, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#284B68' }}>
          <Text style={{ color: '#D5E2EF', lineHeight: 19 }}>{message}</Text>
        </View>
      ) : null}

      <Text style={{ color: '#70879F', textAlign: 'center', fontSize: 12, fontWeight: '800', marginVertical: 24 }}>
        Cripto sem complicação.
      </Text>
    </ScrollView>
  );
}
