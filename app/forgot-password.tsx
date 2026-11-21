import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, Brand, Card, Field, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { colors, spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const [email, setEmail] = useState(String(initialEmail || '').trim().toLowerCase());
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  async function requestCode() {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Informe o e-mail cadastrado na Nexa.');
      return;
    }
    setWorking(true);
    try {
      await nexaApi.forgotPassword(normalizedEmail);
      setStep('reset');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível solicitar o código. Tente novamente.');
    } finally {
      setWorking(false);
    }
  }

  async function resetPassword() {
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Digite o código de seis números recebido por e-mail.');
      return;
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos oito caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }
    setWorking(true);
    try {
      await nexaApi.resetPassword(normalizedEmail, code.trim(), newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setCode('');
      setStep('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível trocar a senha. Confira o código ou solicite outro.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <View style={{ height: spacing.lg }} />
      <Title>{step === 'done' ? 'Senha redefinida' : 'Recuperar minha senha'}</Title>
      <Paragraph>
        {step === 'request'
          ? 'Informe o e-mail da sua conta Nexa. Se houver cadastro, enviaremos um código de recuperação.'
          : step === 'reset'
            ? 'Confira seu e-mail e informe o código de seis números. Ele expira em dez minutos.'
            : 'Sua senha foi atualizada. Entre novamente na Nexa com a nova senha.'}
      </Paragraph>
      {step !== 'done' ? (
        <Card>
          <Field label="E-mail cadastrado" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="voce@email.com" />
          {step === 'reset' ? (
            <>
              <Field label="Código recebido" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="6 números" />
              <Field label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" placeholder="Pelo menos 8 caracteres" />
              <Field label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" placeholder="Repita a nova senha" />
            </>
          ) : null}
        </Card>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {step === 'request' ? <ActionButton label="Enviar código" loading={working} onPress={requestCode} /> : null}
      {step === 'reset' ? (
        <>
          <ActionButton label="Redefinir senha" loading={working} onPress={resetPassword} />
          <ActionButton label="Enviar novo código" variant="secondary" disabled={working} onPress={requestCode} />
        </>
      ) : null}
      <ActionButton label={step === 'done' ? 'Entrar na Nexa' : 'Voltar para login'} variant="secondary" disabled={working} onPress={() => router.replace('/sign-in')} />
      <Paragraph>Nunca compartilhe códigos ou senhas com o atendimento da Nexa.</Paragraph>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md },
});
