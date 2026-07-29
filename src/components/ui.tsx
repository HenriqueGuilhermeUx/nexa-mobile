import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type ReactElement,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/theme';

export function Screen({
  children,
  refreshControl,
}: PropsWithChildren<{ refreshControl?: ReactElement }>) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Brand() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>N</Text>
      </View>
      <View>
        <Text style={styles.brandName}>Nexa</Text>
        <Text style={styles.brandTagline}>Cripto sem complicação.</Text>
      </View>
    </View>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Paragraph({ children }: PropsWithChildren) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  children,
  tone = 'info',
}: PropsWithChildren<{ tone?: 'info' | 'success' | 'warning' | 'danger' }>) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>
        {children}
      </Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function KeyValue({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string | number | null;
  valueNode?: ReactNode;
}) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyLabel}>{label}</Text>
      {valueNode || <Text style={styles.keyValueText}>{String(value ?? '—')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  brandMarkText: { color: colors.white, fontSize: 24, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 22, fontWeight: '900' },
  brandTagline: { color: colors.muted, fontSize: 12, marginTop: 2 },
  eyebrow: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.3,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  paragraph: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badge_info: { backgroundColor: colors.primarySoft },
  badge_success: { backgroundColor: colors.successSoft },
  badge_warning: { backgroundColor: colors.warningSoft },
  badge_danger: { backgroundColor: colors.dangerSoft },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeText_info: { color: '#C7D2FE' },
  badgeText_success: { color: colors.success },
  badgeText_warning: { color: colors.warning },
  badgeText_danger: { color: colors.danger },
  fieldWrap: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '700', marginBottom: 7 },
  input: {
    color: colors.text,
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: {
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button_success: { backgroundColor: '#059669' },
  button_danger: { backgroundColor: '#BE123C' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.9 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  keyValue: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: 13,
  },
  keyLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  keyValueText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
