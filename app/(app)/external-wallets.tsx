import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { nexaApi } from '@/lib/api';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import {
  externalWalletFeaturesEnabled,
  forgetWatchedWallet,
  parseExternalWalletAddress,
  readExternalUsdcBalance,
  readWatchedWallets,
  saveWatchedWallet,
  type ExternalUsdcBalance,
  type WatchedExternalWallet,
} from '@/lib/externalWalletWatch';
import { colors, radius, spacing } from '@/theme';

const METAMASK_NEXA_BROWSER =
  'https://link.metamask.io/dapp/trynexa.com.br/wallet-v148.html?tab=externalWallet';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
}
function shortAddress(address: string) {
  return address.slice(0, 8) + '…' + address.slice(-6);
}

export default function ExternalWalletsScreen() {
  const [identityEmail, setIdentityEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [watched, setWatched] = useState<WatchedExternalWallet[]>([]);
  const [current, setCurrent] = useState('');
  const [balance, setBalance] = useState<ExternalUsdcBalance | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [receiveAddress, setReceiveAddress] = useState('');
  const [receiveHint, setReceiveHint] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!externalWalletFeaturesEnabled()) {
      setAuthLoading(false);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session?.accessToken || !session.email) {
          throw new Error('Entre na sua conta Nexa antes de adicionar uma carteira.');
        }
        const response = await nexaApi.me(session.accessToken);
        const profile = response?.user || response;
        const email = String(profile?.email || '').trim().toLowerCase();
        if (!email || email !== session.email.trim().toLowerCase()) {
          throw new Error('Sua sessão Nexa não foi confirmada. Entre novamente.');
        }
        const list = await readWatchedWallets(email);
        if (!live) return;
        setIdentityEmail(email);
        setWatched(list);
        if (list.length) setCurrent(list[0].address);

        // This is the existing authenticated wallet endpoint, never a
        // hardcoded address or one supplied by an untrusted external wallet.
        try {
          const result = await fetch(config.apiUrl + '/wallet-v15/me', {
            headers: {
              Authorization: 'Bearer ' + session.accessToken,
              Accept: 'application/json',
            },
          });
          if (!result.ok) throw new Error('Wallet de recebimento indisponível.');
          const body = await result.json();
          if (!live) return;
          const chain = body?.chainId ?? body?.wallet?.chainId;
          if (chain && Number(chain) !== 137) {
            throw new Error('O servidor não confirmou o endereço para a rede Polygon.');
          }
          const proposed = body?.portfolio?.address || body?.wallet?.address || body?.walletAddress;
          if (!proposed) {
            setReceiveHint('Sua wallet Nexa ainda não possui endereço ativo de recebimento.');
          } else {
            setReceiveAddress(parseExternalWalletAddress(String(proposed)));
          }
        } catch {
          if (live) setReceiveHint('Consulte o endereço de recebimento na seção Minha Wallet da Nexa.');
        }
      } catch (error) {
        if (live) setAuthError(errorMessage(error));
      } finally {
        if (live) setAuthLoading(false);
      }
    })();
    return () => { live = false; requestId.current += 1; };
  }, []);

  async function consult(address: string) {
    const id = ++requestId.current;
    setCurrent(address);
    setBusy(true);
    setBalance(null);
    setMessage('Consultando USDC na rede Polygon…');
    try {
      const value = await readExternalUsdcBalance(address);
      if (id !== requestId.current) return;
      setBalance(value);
      setMessage('Consulta concluída. Esse saldo é externo, não está na Nexa.');
    } catch (error) {
      if (id === requestId.current) setMessage(errorMessage(error));
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  async function addWallet() {
    if (!identityEmail || busy) return;
    try {
      const parsed = parseExternalWalletAddress(addressInput);
      setBusy(true);
      const next = await saveWatchedWallet(identityEmail, parsed);
      setWatched(next);
      setAddressInput('');
      // consult() owns the busy flag from here.
      void consult(parsed);
    } catch (error) {
      setMessage(errorMessage(error));
      setBusy(false);
    }
  }

  async function removeWallet(address: string) {
    if (!identityEmail || busy) return;
    try {
      const next = await forgetWatchedWallet(identityEmail, address);
      setWatched(next);
      requestId.current += 1;
      if (current.toLowerCase() === address.toLowerCase()) {
        setCurrent(next[0]?.address || '');
        setBalance(null);
      }
      setMessage('Endereço removido do acompanhamento neste aparelho.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function copyAddress(address: string) {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setMessage('Endereço copiado. Confira a rede e o destinatário antes de qualquer envio.');
  }

  async function openMetaMaskBrowser() {
    try {
      await Linking.openURL(METAMASK_NEXA_BROWSER);
    } catch {
      setMessage('Não foi possível abrir a MetaMask. Use a opção Explorar dentro da carteira e acesse trynexa.com.br.');
    }
  }

  if (!externalWalletFeaturesEnabled()) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Carteiras externas</Text>
        <Text style={styles.muted}>A experiência simples está em homologação e não foi habilitada neste aplicativo.</Text>
      </View>
    );
  }
  if (authLoading) return <View style={styles.center}><ActivityIndicator color={colors.cyan}/><Text style={styles.muted}>Validando sua conta Nexa…</Text></View>;
  if (authError) {
    return <View style={styles.center}><Text style={styles.heading}>Carteiras externas</Text><Text style={styles.warning}>{authError}</Text><Action label="Entrar na Nexa" onPress={() => router.replace('/sign-in' as any)}/></View>;
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>NEXA WALLET · CARTEIRAS EXTERNAS</Text>
      <Text style={styles.heading}>Cripto sem complicação.</Text>
      <Text style={styles.muted}>Acompanhe uma MetaMask, Trust Wallet ou outra carteira EVM pelo endereço público. Sem WalletConnect, cadastro extra ou senha da carteira.</Text>

      <View style={styles.card}>
        <Text style={styles.section}>1. Adicionar uma carteira</Text>
        <Text style={styles.muted}>Copie o endereço público (0x…) da sua carteira. A Nexa consulta somente o USDC nativo da Polygon.</Text>
        <TextInput style={styles.input} value={addressInput} onChangeText={setAddressInput}
          accessibilityLabel="Endereço público da carteira externa" placeholder="Cole o endereço 0x…"
          placeholderTextColor={colors.mutedStrong} autoCapitalize="none" autoCorrect={false}
          autoComplete="off" />
        <Action label="Acompanhar endereço" disabled={busy || !addressInput.trim()} onPress={() => { void addWallet(); }}/>
        <Action label="Abrir Nexa no navegador da MetaMask" secondary onPress={() => {void openMetaMaskBrowser();}}/>
        <Text style={styles.small}>Apenas visualizar: cadastrar um endereço não comprova que ele é seu nem autoriza movimentações. Endereços ficam neste aparelho, separados por conta Nexa.</Text>
      </View>

      {watched.length ? (
        <View style={styles.card}>
          <Text style={styles.section}>Carteiras acompanhadas</Text>
          {watched.map(item => (
            <View key={item.address} style={styles.rowCard}>
              <View style={{flex:1,gap:4}}>
                <Text style={styles.address}>{shortAddress(item.address)}</Text>
                <Text style={styles.small}>Polygon · USDC · somente leitura</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => {void consult(item.address);}} disabled={busy}
                style={styles.textAction}><Text style={styles.linkText}>Consultar</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => {void removeWallet(item.address);}} disabled={busy}
                style={styles.textAction}><Text style={styles.warning}>Excluir</Text></Pressable>
            </View>
          ))}
          {busy ? <ActivityIndicator color={colors.cyan}/> : null}
          {current && balance?.address.toLowerCase() === current.toLowerCase() ? (
            <View style={styles.balanceCard}>
              <Text style={styles.small}>SALDO EXTERNO · NÃO É SALDO NEXA</Text>
              <Text style={styles.balance}>{balance.amount} USDC</Text>
              <Text style={styles.small}>Rede Polygon (137). Consulta pública, sem assinar nada.</Text>
              <Action label="Copiar endereço externo" secondary onPress={() => {void copyAddress(current);}}/>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>2. Trazer USDC para a Nexa</Text>
        <Text style={styles.muted}>Use o endereço individual Nexa na Polygon e faça o envio diretamente na sua carteira externa. A carteira externa solicita a confirmação e o pagamento do gás.</Text>
        {receiveAddress ? (
          <>
            <View style={styles.qr}><QRCode value={receiveAddress} size={174} backgroundColor="#FFFFFF"/></View>
            <Text selectable style={styles.addressLong}>{receiveAddress}</Text>
            <Action label="Copiar meu endereço Nexa" onPress={() => {void copyAddress(receiveAddress);}}/>
          </>
        ) : <Text style={styles.warning}>{receiveHint || 'Carregando endereço de recebimento…'}</Text>}
        <Action label="Ver minha Wallet Nexa" secondary onPress={() => router.push('/legacy?open=wallet' as any)}/>
        <Text style={styles.small}>Confira a rede Polygon, o contrato USDC e o destino. A Nexa só considera recebido após confirmação on-chain e conciliação. Não envie fundos para homologação.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>3. Usar cripto para pagar Pix no Brasil</Text>
        <Text style={styles.muted}>Próxima etapa: conversão USDC → reais e pagamento Pix com instituição parceira. A conexão de carteira não ativa esse serviço.</Text>
        <Text style={styles.warning}>Ainda indisponível para clientes — depende de KYC, cotação, liquidez, compliance e parceiro de liquidação habilitado.</Text>
      </View>

      {message ? <Text accessibilityRole="alert" style={styles.status}>{message}</Text> : null}
      <Text style={styles.disclaimer}>Nunca informe frase-semente ou chave privada. Consultas externas usam nós públicos da Polygon, que recebem o endereço pesquisado. Nenhuma transferência, assinatura ou crédito em ledger é feito nesta tela.</Text>
    </ScrollView>
  );
}

function Action(props: {label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" disabled={props.disabled} onPress={props.onPress}
    style={[styles.button,props.secondary?styles.buttonSecondary:null,props.disabled?{opacity:0.45}:null]}>
    <Text style={styles.buttonText}>{props.label}</Text>
  </Pressable>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},
  content:{padding:spacing.lg,paddingBottom:spacing.xxxl,gap:spacing.md},
  center:{flex:1,backgroundColor:colors.background,padding:spacing.lg,justifyContent:'center',gap:spacing.md},
  kicker:{fontSize:11,letterSpacing:1.3,fontWeight:'800',color:colors.cyan},
  heading:{fontSize:27,fontWeight:'900',color:colors.text},
  muted:{fontSize:14,lineHeight:21,color:colors.muted},
  card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.md,gap:spacing.md},
  section:{fontSize:18,fontWeight:'800',color:colors.text},
  input:{borderColor:colors.borderStrong,borderWidth:1,borderRadius:radius.sm,padding:14,color:colors.text,backgroundColor:colors.elevated,fontSize:14},
  button:{borderRadius:radius.sm,padding:14,backgroundColor:colors.primary},
  buttonSecondary:{backgroundColor:colors.elevated},
  buttonText:{color:colors.text,textAlign:'center',fontWeight:'800'},
  small:{fontSize:12,lineHeight:18,color:colors.muted},
  disclaimer:{fontSize:12,lineHeight:19,color:colors.mutedStrong},
  rowCard:{flexDirection:'row',alignItems:'center',gap:5,borderBottomColor:colors.border,borderBottomWidth:1,paddingVertical:10},
  textAction:{paddingHorizontal:5,paddingVertical:7},
  linkText:{color:colors.cyan,fontWeight:'700',fontSize:12},
  address:{color:colors.text,fontSize:14,fontWeight:'700'},
  addressLong:{color:colors.text,fontSize:12,textAlign:'center'},
  warning:{color:colors.warning,fontSize:13,lineHeight:19},
  balanceCard:{gap:10,backgroundColor:colors.backgroundSecondary,borderRadius:radius.md,padding:spacing.md},
  balance:{color:colors.text,fontSize:25,fontWeight:'900'},
  qr:{alignItems:'center',padding:12,backgroundColor:'#FFFFFF',borderRadius:radius.md,alignSelf:'center'},
  status:{color:colors.cyan,fontSize:13,lineHeight:20,padding:10,backgroundColor:colors.backgroundSecondary,borderRadius:radius.sm},
});
