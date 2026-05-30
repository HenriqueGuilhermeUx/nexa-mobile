import React, { useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
const USDC_BRL_RATE = 5.3;

export default function App() {
  const [page, setPage] = useState('home');
  const [authPage, setAuthPage] = useState('login');

  const [saldo, setSaldo] = useState({ BRL: 0, USDC: 0 });
  const [extrato, setExtrato] = useState([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  const [valorBrl, setValorBrl] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [username, setUsername] = useState('');
  const [valorUsdc, setValorUsdc] = useState('');
  const [wallet, setWallet] = useState('');
  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  const [user, setUser] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(function () {
    carregarLoginSalvo();
  }, []);

  useEffect(function () {
    if (user && user.id) {
      carregarDados();
    }
  }, [user && user.id]);

  function show(data) {
    setMsg(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  function getUsername() {
    if (!user || !user.id) return '@nexa';
    return '@' + String(user.email || user.id).split('@')[0];
  }

  function getInitial() {
    if (!user || !user.fullName) return 'N';
    return user.fullName.charAt(0).toUpperCase();
  }

  function getIcon(item) {
    const description = String(item.description || '').toLowerCase();

    if (description.includes('pix')) return '💳';
    if (description.includes('conversão')) return '🔄';
    if (description.includes('transferência')) return '📤';
    if (description.includes('carteira')) return '🌐';
    if (item.asset === 'USDC') return '💵';

    return '💰';
  }

  async function salvarSessao(data) {
    setUser(data.user);
    await AsyncStorage.setItem('nexa_user', JSON.stringify(data.user));
    await AsyncStorage.setItem('nexa_token', data.accessToken || '');
  }

  async function carregarLoginSalvo() {
    try {
      const savedUser = await AsyncStorage.getItem('nexa_user');

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setMsg('Login restaurado');
      }
    } catch (e) {
      setMsg('Erro ao restaurar login: ' + e.message);
    }
  }

  async function login() {
    if (!email || !password) {
      show('Informe e-mail e senha');
      return;
    }

    try {
      const response = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.accessToken) {
        await salvarSessao(data);
        show('Login realizado com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro login: ' + e.message);
    }
  }

  async function cadastrar() {
    if (!email || !password || !fullName || !cpf || !phone) {
      show('Preencha todos os campos do cadastro');
      return;
    }

    try {
      const response = await fetch(API + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, cpf, fullName, phone }),
      });

      const data = await response.json();

      if (data.accessToken) {
        await salvarSessao(data);
        show('Conta criada com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro cadastro: ' + e.message);
    }
  }

  async function logout() {
    await AsyncStorage.removeItem('nexa_user');
    await AsyncStorage.removeItem('nexa_token');

    setUser(null);
    setSaldo({ BRL: 0, USDC: 0 });
    setExtrato([]);
    setPixCopyPaste('');
    setTicketUrl('');
    setPage('home');
    show('Você saiu da Nexa');
  }

  async function carregarDados() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/ledger/statement?userId=' + user.id);
      const data = await r.json();

      var brl = 0;
      var usdc = 0;

      if (data.statement) {
        setExtrato(data.statement);

        data.statement.forEach(function (item) {
          var sinal = item.direction === 'credit' ? 1 : -1;
          if (item.asset === 'BRL') brl += Number(item.amount) * sinal;
          if (item.asset === 'USDC') usdc += Number(item.amount) * sinal;
        });
      }

      setSaldo({
        BRL: Number(brl.toFixed(2)),
        USDC: Number(usdc.toFixed(6)),
      });

      show('Saldo atualizado');
    } catch (e) {
      show('Falha ao carregar dados: ' + e.message);
    }
  }

  async function depositarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/banking/mercadopago/pix-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          amountBrl: Number(depositValue),
        }),
      });

      const data = await r.json();

      setPixCopyPaste(data.pixCopyPasteCode || '');
      setTicketUrl(data.ticketUrl || '');

      if (data.success) {
        show('Pix gerado com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro depósito Pix: ' + e.message);
    }
  }

  async function converter() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/swap/brl-to-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountBrl: Number(valorBrl) }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setValorBrl('');
        carregarDados();
      }
    } catch (e) {
      show('Erro conversão: ' + e.message);
    }
  }

  async function sacarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: Number(valorBrl),
          pixKey,
        }),
      });

      const data = await r.json();
      show(data);
    } catch (e) {
      show('Erro Pix: ' + e.message);
    }
  }

  async function enviarUsername() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/internal-transfer/send-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUsername: username,
          amountUsdc: Number(valorUsdc),
          note: 'envio app',
        }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setUsername('');
        setValorUsdc('');
        carregarDados();
      }
    } catch (e) {
      show('Erro envio: ' + e.message);
    }
  }

  async function enviarWallet() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const r = await fetch(API + '/wallet/send-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          toAddress: wallet,
          amountUsdc: Number(valorUsdc),
          note: 'envio externo app',
        }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setWallet('');
        setValorUsdc('');
        carregarDados();
      }
    } catch (e) {
      show('Erro wallet: ' + e.message);
    }
  }

  function Card(props) {
    return <View style={styles.card}>{props.children}</View>;
  }

  function Button(props) {
    return (
      <TouchableOpacity style={styles.button} onPress={props.onPress}>
        <Text style={styles.buttonText}>{props.title}</Text>
      </TouchableOpacity>
    );
  }

  function Input(props) {
    return (
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry || false}
        keyboardType={props.keyboardType || 'default'}
        autoCapitalize={props.autoCapitalize || 'none'}
        autoCorrect={false}
        blurOnSubmit={false}
        returnKeyType="next"
        placeholderTextColor="#64748b"
      />
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="always">
          <Text style={styles.logo}>NEXA</Text>
          <Text style={styles.subtitle}>Cripto sem complicação</Text>

          <Card>
            <Text style={styles.title}>
              {authPage === 'login' ? 'Entrar' : 'Criar conta'}
            </Text>

            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              placeholder="Senha"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
            />

            {authPage === 'register' && (
              <>
                <Input
                  placeholder="Nome completo"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />

                <Input
                  placeholder="CPF"
                  keyboardType="numeric"
                  value={cpf}
                  onChangeText={setCpf}
                />

                <Input
                  placeholder="Telefone"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </>
            )}

            {authPage === 'login' ? (
              <Button title="Entrar" onPress={login} />
            ) : (
              <Button title="Criar conta" onPress={cadastrar} />
            )}

            {authPage === 'login' ? (
              <Button title="Não tenho conta" onPress={function () { setAuthPage('register'); }} />
            ) : (
              <Button title="Já tenho conta" onPress={function () { setAuthPage('login'); }} />
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  const patrimonioTotal = Number((saldo.BRL + saldo.USDC * USDC_BRL_RATE).toFixed(2));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="always">
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Pix + USDC + @username</Text>

        {page === 'home' && (
          <>
            <Card>
              <View style={styles.headerRow}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>

                <View>
                  <Text style={styles.welcome}>Olá, {user.fullName}</Text>
                  <Text style={styles.usernameText}>{getUsername()}</Text>
                </View>
              </View>

              <Text style={styles.smallLabel}>Patrimônio total estimado</Text>
              <Text style={styles.totalBalance}>R$ {patrimonioTotal.toFixed(2)}</Text>

              <View style={styles.balanceGrid}>
                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>BRL</Text>
                  <Text style={styles.balanceMiniText}>R$ {saldo.BRL.toFixed(2)}</Text>
                </View>

                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>USDC</Text>
                  <Text style={styles.balanceMiniText}>{saldo.USDC}</Text>
                </View>
              </View>

              <Text style={styles.rateText}>
                Cotação estimada: 1 USDC = R$ {USDC_BRL_RATE.toFixed(2)}
              </Text>

              <Button title="Atualizar saldo" onPress={carregarDados} />
            </Card>

            <Card>
              <Text style={styles.title}>Ações rápidas</Text>
              <Button title="💳 Depositar Pix" onPress={function () { setPage('deposit'); }} />
              <Button title="🔄 Converter para USDC" onPress={function () { setPage('convert'); }} />
              <Button title="📤 Enviar USDC" onPress={function () { setPage('send'); }} />
              <Button title="🏦 Sacar Pix" onPress={function () { setPage('pix'); }} />
            </Card>

            <Card>
              <Text style={styles.title}>Últimas movimentações</Text>

              {extrato.length === 0 && (
                <Text style={styles.itemText}>Nenhuma movimentação carregada ainda.</Text>
              )}

              {extrato.slice(0, 5).map(function (item) {
                return (
                  <View key={item.id} style={styles.item}>
                    <Text style={styles.itemText}>
                      {getIcon(item)} {item.description}
                    </Text>
                    <Text style={item.direction === 'credit' ? styles.creditText : styles.debitText}>
                      {item.direction === 'credit' ? '+' : '-'} {item.amount} {item.asset}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {page === 'deposit' && (
          <Card>
            <Text style={styles.title}>Depositar Pix</Text>

            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={depositValue}
              onChangeText={setDepositValue}
            />

            <Button title="Gerar Pix Mercado Pago" onPress={depositarPix} />

            {pixCopyPaste ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>QR Code Pix</Text>

                <View style={styles.qrBox}>
                  <QRCode value={pixCopyPaste} size={180} />
                </View>

                <Text style={styles.itemText}>Pix copia e cola:</Text>
                <Text style={styles.copyText}>{pixCopyPaste}</Text>
              </View>
            ) : null}

            {ticketUrl ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>Link de pagamento:</Text>
                <Text style={styles.copyText}>{ticketUrl}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {page === 'pix' && (
          <Card>
            <Text style={styles.title}>Sacar Pix</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="Chave Pix"
              value={pixKey}
              onChangeText={setPixKey}
            />

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={valorBrl}
              onChangeText={setValorBrl}
            />

            <Button title="Solicitar Pix" onPress={sacarPix} />
          </Card>
        )}

        {page === 'convert' && (
          <Card>
            <Text style={styles.title}>Converter BRL para USDC</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={valorBrl}
              onChangeText={setValorBrl}
            />

            <Button title="Converter" onPress={converter} />
          </Card>
        )}

        {page === 'send' && (
          <Card>
            <Text style={styles.title}>Enviar USDC</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="@username"
              value={username}
              onChangeText={setUsername}
            />

            <Input
              placeholder="Valor USDC"
              keyboardType="numeric"
              value={valorUsdc}
              onChangeText={setValorUsdc}
            />

            <Button title="Enviar para @username" onPress={enviarUsername} />

            <Input
              placeholder="Carteira 0x..."
              value={wallet}
              onChangeText={setWallet}
            />

            <Button title="Enviar para carteira" onPress={enviarWallet} />
          </Card>
        )}

        {page === 'profile' && (
          <Card>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{getInitial()}</Text>
            </View>

            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.itemText}>Nome: {user.fullName}</Text>
            <Text style={styles.itemText}>Username: {getUsername()}</Text>
            <Text style={styles.itemText}>E-mail: {user.email}</Text>
            <Text style={styles.itemText}>CPF: {user.cpf}</Text>
            <Text style={styles.itemText}>KYC: {user.kycStatus}</Text>
            <Text style={styles.itemText}>User ID: {user.id}</Text>

            <Button title="Sair" onPress={logout} />
          </Card>
        )}

        {page === 'extrato' && (
          <Card>
            <Text style={styles.title}>Extrato</Text>
            <Button title="Atualizar extrato" onPress={carregarDados} />

            {extrato.map(function (item) {
              return (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.itemText}>
                    {getIcon(item)} {item.description}
                  </Text>
                  <Text style={item.direction === 'credit' ? styles.creditText : styles.debitText}>
                    {item.direction === 'credit' ? '+' : '-'} {item.amount} {item.asset}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <View style={styles.menu}>
        <TouchableOpacity onPress={function () { setPage('home'); }}>
          <Text style={styles.menuText}>🏠</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('deposit'); }}>
          <Text style={styles.menuText}>💳</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('pix'); }}>
          <Text style={styles.menuText}>🏦</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('convert'); }}>
          <Text style={styles.menuText}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('send'); }}>
          <Text style={styles.menuText}>📤</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={function () { setPage('profile'); }}>
          <Text style={styles.menuText}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#020617' },

  content: {
    flex: 1,
    padding: 20,
    paddingTop: 55,
  },

  logo: {
    color: 'white',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },

  subtitle: {
    color: '#93c5fd',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 13,
  },

  card: {
    backgroundColor: '#0f172a',
    padding: 22,
    borderRadius: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e40af',
  },

  title: {
    color: 'white',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 16,
    marginTop: 6,
  },

  welcome: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },

  usernameText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  avatarSmall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
  },

  avatarLarge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },

  avatarLargeText: {
    color: 'white',
    fontSize: 38,
    fontWeight: '900',
  },

  smallLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },

  totalBalance: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '900',
    marginBottom: 12,
  },

  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },

  balanceMiniCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 14,
  },

  balanceMiniText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 18,
  },

  rateText: {
    color: '#93c5fd',
    fontSize: 12,
    marginBottom: 14,
  },

  loginMsg: {
    color: '#93c5fd',
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 13,
  },

  input: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 15,
  },

  button: {
    backgroundColor: '#2563eb',
    padding: 13,
    borderRadius: 14,
    marginBottom: 11,
  },

  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },

  menu: {
    height: 74,
    backgroundColor: '#020617',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },

  menuText: {
    color: '#e2e8f0',
    fontSize: 21,
    fontWeight: '800',
  },

  item: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  itemText: {
    color: '#f8fafc',
    marginBottom: 6,
    fontSize: 13,
  },

  creditText: {
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 14,
  },

  debitText: {
    color: '#f87171',
    fontWeight: '900',
    fontSize: 14,
  },

  pixBox: {
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  copyText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },

  qrBox: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    alignSelf: 'center',
    marginBottom: 16,
  },
};
