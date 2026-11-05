import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { loadNexaSession } from '@/lib/session';
import { nexaApi } from '@/lib/api';
import { buildPublicShoppingSearchUrl } from '@/maya-actions/shoppingSearch';
import { colors, spacing } from '@/theme';

export default function MayaShoppingSearchScreen() {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [budget, setBudget] = useState('');
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState('Entre na Nexa para pesquisar ofertas.');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) { if (active) router.replace('/sign-in'); return; }
        await nexaApi.me(session.accessToken);
        if (active) { setReady(true); setNotice('Pesquisas externas exigem sua escolha explícita.'); }
      } catch {
        if (active) { setReady(false); setNotice('Não foi possível verificar sua conta. Entre novamente.'); }
      }
    })();
    return () => { active = false; };
  }, []);

  const amount = budget.trim() ? Number(budget.trim()) : undefined;
  let url = '';
  if (ready && !opening) {
    try { url = buildPublicShoppingSearchUrl(query, amount); } catch { /* incomplete input */ }
  }

  async function openSearch() {
    if (!ready || !url || opening) return;
    setOpening(true);
    try {
      // This opens a third-party website only after the user taps the button.
      // It does not scrape offers, enter credentials, order or pay.
      await WebBrowser.openBrowserAsync(url);
      setNotice('A pesquisa foi aberta em um site externo. Confira loja, preço, frete e disponibilidade antes de decidir.');
    } catch {
      setNotice('Não foi possível abrir a pesquisa agora. Tente novamente.');
    } finally { setOpening(false); }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Maya · Pesquisar preços</Text>
      <Text style={styles.secondary}>Encontre ofertas em lojas na web. Nesta primeira etapa, a Maya abre a busca externa para você comparar. Ela ainda não verifica nem compra produtos por conta própria.</Text>
      <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>
      {!ready && <ActivityIndicator color={colors.primary}/>}
      <View style={styles.panel}>
        <Text style={styles.title}>O que você quer encontrar?</Text>
        <TextInput accessibilityLabel="Produto para pesquisa" style={styles.input}
          value={query} onChangeText={setQuery} autoCapitalize="sentences"
          placeholder="Ex.: notebook com 16 GB de RAM" placeholderTextColor={colors.muted}
          maxLength={240}/>
        <Text style={styles.title}>Limite em reais (opcional)</Text>
        <TextInput accessibilityLabel="Orçamento máximo em reais" style={styles.input}
          value={budget} onChangeText={setBudget} keyboardType="number-pad"
          placeholder="Ex.: 3000" placeholderTextColor={colors.muted} maxLength={7}/>
        <Text style={styles.secondary}>Ao abrir a pesquisa, somente o produto e o limite que você digitou serão enviados ao mecanismo de busca. Evite incluir dados pessoais.</Text>
        <Pressable accessibilityRole="button" disabled={!ready || !url || opening}
          onPress={() => { void openSearch(); }}
          style={[styles.button, (!ready || !url || opening) && styles.disabled]}>
          <Text style={styles.buttonText}>{opening ? 'Abrindo pesquisa…' : 'Abrir pesquisa de preços na web'}</Text>
        </Pressable>
      </View>
      <Text style={styles.notice}>Preços online podem mudar e incluir frete, taxas ou condições específicas. Nenhuma oferta, disponibilidade ou compra é confirmada pela Nexa nesta etapa.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: 40 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  secondary: { color: colors.muted, lineHeight: 21 },
  notice: { color: '#E6BE7A', lineHeight: 21 },
  panel: { padding: 14, gap: 12, borderWidth: 1, borderColor: '#35506B', borderRadius: 12 },
  input: { color: colors.text, borderWidth: 1, borderColor: '#35506B', borderRadius: 10, padding: 13 },
  button: { backgroundColor: '#2777CC', padding: 14, borderRadius: 10, alignItems: 'center' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }
});
