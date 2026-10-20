import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

// This is a discovery screen, not a company authorization mechanism.
// PJ features require a Nexa-signed, tenant-scoped approval and cannot
// inherit PF authorization or NexOffice local sessions.
const features = [
  ['CRM e vendas', 'Clientes, oportunidades, propostas e pipeline'],
  ['ERP e financeiro', 'Contas, lançamentos, recebimentos e conciliação'],
  ['Agenda e documentos', 'Compromissos, tarefas, contratos e arquivos'],
  ['Marketing e inteligência', 'Automações, campanhas, indicadores e agentes'],
  ['Conta Nexa PJ', 'Pix, USDC, extratos e transferências após aprovação'],
];

export default function NexaEmpresaEntry() {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.brand}>NEXA EMPRESAS</Text>
    <Text style={styles.title}>Sua Nexa também é da sua empresa.</Text>
    <Text style={styles.summary}>Continue usando sua conta pessoal como hoje. Para acessar a experiência empresarial, abra e obtenha aprovação da Conta Nexa PJ.</Text>
    <View style={styles.notice}><Text style={styles.noticeTitle}>Conta PJ obrigatória</Text><Text style={styles.info}>Cadastro Nexa → CNPJ e responsáveis → verificação de identidade → aprovação da empresa → acesso aos módulos.</Text></View>
    {features.map(([name, description]) => <View key={name} style={styles.card}><Text style={styles.feature}>{name}</Text><Text style={styles.info}>{description}</Text></View>)}
    <Pressable style={styles.primary} onPress={() => Linking.openURL('https://trynexa.com.br/pj')} accessibilityRole="button"><Text style={styles.primaryText}>Abrir minha Conta Nexa PJ</Text></Pressable>
    <Pressable style={styles.secondary} onPress={() => Linking.openURL('https://trynexa.com.br/merchant')} accessibilityRole="button"><Text style={styles.secondaryText}>Já tenho Conta Nexa PJ</Text></Pressable>
    <Text style={styles.footer}>Acesso aos módulos dentro do aplicativo: aguardando integração segura de identidade PJ. Nenhum recurso financeiro é ativado por esta tela.</Text>
    <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>Voltar à Nexa pessoal</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 60, gap: 14 },
  brand: { color: '#38bdf8', fontWeight: '800', letterSpacing: 2, marginTop: 24 },
  title: { color: '#f0f7ff', fontSize: 32, fontWeight: '800', lineHeight: 38 },
  summary: { color: '#b7cde8', fontSize: 16, lineHeight: 24 },
  notice: { backgroundColor: '#102d59', padding: 18, borderRadius: 16, borderColor: '#29528e', borderWidth: 1 },
  noticeTitle: { color: '#dcecff', fontWeight: '800', fontSize: 17, marginBottom: 6 },
  card: { backgroundColor: '#0b2449', borderRadius: 15, borderWidth: 1, borderColor: '#1b416d', padding: 18 },
  feature: { color: '#eff7ff', fontWeight: '700', fontSize: 17, marginBottom: 6 },
  info: { color: '#b8d0ee', lineHeight: 21 },
  primary: { backgroundColor: '#2563eb', padding: 17, alignItems: 'center', borderRadius: 14, marginTop: 10 },
  primaryText: { color: 'white', fontWeight: '800' },
  secondary: { borderColor: '#60a5fa', borderWidth: 1, borderRadius: 14, padding: 16, alignItems: 'center' },
  secondaryText: { color: '#bfdbfe', fontWeight: '700' },
  footer: { color: '#92b3d8', fontSize: 12, lineHeight: 18 },
  back: { color: '#93c5fd', textAlign: 'center', padding: 12 },
});
