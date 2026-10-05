import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type RefreshControlProps,
  View,
  type ViewStyle,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, radius, spacing } from '@/theme';

export function Screen({
  children,
  refreshControl,
}: PropsWithChildren<{
  refreshControl?: ReactElement<RefreshControlProps>;
}>) {
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

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <View
      style={[
        styles.brandMark,
        { width: size, height: size, borderRadius: Math.round(size * 0.33) },
      ]}
    >
      <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 128 128">
        <Defs>
          <LinearGradient id="nexaBrand" x1="18" y1="16" x2="110" y2="112">
            <Stop offset="0" stopColor="#234BFF" />
            <Stop offset="0.55" stopColor="#22AFFF" />
            <Stop offset="1" stopColor="#32E3E0" />
          </LinearGradient>
          <LinearGradient id="nexaSilver" x1="86" y1="10" x2="48" y2="74">
            <Stop offset="0" stopColor="#D5E2EF" />
            <Stop offset="0.65" stopColor="#7FA7FF" />
            <Stop offset="1" stopColor="#234BFF" />
          </LinearGradient>
        </Defs>
        <Path
          d="M24 97V31c0-8 6-14 14-14h3l48 60V31c0-8 6-14 14-14h1v80c0 8-6 14-14 14h-3L39 51v46c0 8-6 14-14 14h-1V97z"
          fill="url(#nexaBrand)"
        />
        <Path
          d="M38 17h5l25 31-13 19-31-39c3-7 7-11 14-11z"
          fill="url(#nexaSilver)"
          opacity={0.96}
        />
      </Svg>
    </View>
  );
}

export function Brand() {
  return (
    <View style={styles.brandRow}>
      <BrandMark />
      <View>
        <View style={styles.wordmarkRow}>
          <Text style={styles.brandName}>NEX</Text>
          <Text style={styles.brandNameAccent}>A</Text>
        </View>
        <Text style={styles.brandTagline}>WALLET · Cripto sem complicação.</Text>
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
    gap: 13,
    marginBottom: spacing.xl,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline' },
  brandName: {
    color: colors.silver,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 3.6,
  },
  brandNameAccent: {
    color: colors.cyan,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 3.6,
  },
  brandTagline: {
    color: colors.mutedStrong,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: .45,
    marginTop: 3,
  },
  eyebrow: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.1,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  paragraph: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
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
  badgeText_info: { color: colors.cyan },
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
  button_primary: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.cyan },
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
