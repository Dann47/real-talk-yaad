/**
 * Real Talk Yaad UI kit: text, buttons, cards, chips, icons and the screen frame.
 * Every colour comes from useTheme(), so light/dark mode and the accent picker apply everywhere.
 */
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/* ---------- Icons ---------- */

type SymbolName = Exclude<ComponentProps<typeof SymbolView>['name'], string>;

const ICONS = {
  home: { ios: 'house', android: 'home', web: 'home' },
  chat: { ios: 'bubble.left', android: 'chat_bubble', web: 'chat_bubble' },
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  waveform: { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' },
  wallet: { ios: 'creditcard', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  person: { ios: 'person', android: 'person', web: 'person' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  send: { ios: 'arrow.up', android: 'send', web: 'send' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  heart: { ios: 'heart', android: 'favorite', web: 'favorite' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  bag: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  shield: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  video: { ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? theme.text} />;
}

/* ---------- Text ---------- */

const textStyles = StyleSheet.create({
  display: { fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  smallStrong: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});

export type TextVariant = keyof typeof textStyles;

export function T({
  variant = 'body',
  color = 'text',
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: ThemeColor }) {
  const theme = useTheme();
  const isHeading = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : undefined}
      style={[textStyles[variant], { color: theme[color] }, style]}
      {...rest}
    />
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'reward';

export function Button({
  label,
  onPress,
  href,
  icon,
  variant = 'primary',
  disabled,
  compact,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    secondary: { bg: 'transparent', fg: theme.text, border: theme.backgroundSelected },
    ghost: { bg: 'transparent', fg: theme.accentText, border: 'transparent' },
    reward: { bg: theme.reward, fg: theme.onReward, border: theme.reward },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        onPress?.();
        if (href) router.push(href);
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={18} color={palette.fg} /> : null}
      <T variant={compact ? 'smallStrong' : 'bodyStrong'} style={{ color: palette.fg }}>
        {label}
      </T>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  filled,
  size = 44,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  filled?: boolean;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? theme.accent : theme.backgroundElement,
          borderWidth: filled ? 0 : 1,
          borderColor: theme.backgroundSelected,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Icon name={icon} size={size > 60 ? 32 : 20} color={filled ? theme.onAccent : theme.text} />
    </Pressable>
  );
}

/* ---------- Surfaces ---------- */

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'plain' | 'soft' | 'accent' | 'outlined';
}) {
  const theme = useTheme();
  const toneStyle = {
    plain: { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
    soft: { backgroundColor: theme.accentSoft, borderColor: theme.backgroundSelected },
    accent: { backgroundColor: theme.accent, borderColor: theme.accent },
    outlined: { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 2 },
  }[tone];
  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

export function Chip({
  label,
  tone = 'reward',
  icon,
}: {
  label: string;
  tone?: 'reward' | 'soft' | 'accent';
  icon?: IconName;
}) {
  const theme = useTheme();
  const colors = {
    reward: { bg: theme.reward, fg: theme.onReward },
    soft: { bg: theme.accentSoft, fg: theme.text },
    accent: { bg: theme.accent, fg: theme.onAccent },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
      {icon ? <Icon name={icon} size={14} color={colors.fg} /> : null}
      <T variant="caption" style={{ color: colors.fg, fontWeight: '700' }}>
        {label}
      </T>
    </View>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: theme.accent }]} />
    </View>
  );
}

const BARS = [10, 18, 28, 16, 34, 44, 26, 38, 52, 30, 20, 40, 56, 36, 24, 46, 30, 18, 34, 22, 14, 26, 38, 20, 12];

export function Waveform({ color, active = true }: { color?: string; active?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.waveform}>
      {BARS.map((h, i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: active ? h : 6,
            borderRadius: 3,
            backgroundColor: color ?? theme.accent,
            opacity: active ? 1 : 0.5,
          }}
        />
      ))}
    </View>
  );
}

export function Avatar({ letter, size = 44 }: { letter: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <T style={{ color: theme.onAccent, fontWeight: '800', fontSize: size * 0.42 }}>{letter}</T>
    </View>
  );
}

/** A tappable list row with an icon tile, two lines of text and a value on the right. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  href,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  href?: Href;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onPress?.();
        if (href) router.push(href);
      }}
      style={({ pressed }) => [
        styles.card,
        styles.listRow,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: theme.accentSoft }]}>
          <Icon name={icon} color={theme.accentText} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <T variant="bodyStrong">{title}</T>
        {subtitle ? (
          <T variant="small" color="textSecondary">
            {subtitle}
          </T>
        ) : null}
      </View>
      {value ? (
        <T variant="smallStrong" color="accentText">
          {value}
        </T>
      ) : (
        <Icon name="chevron" size={18} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

/* ---------- Screen frame ---------- */

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/' as Href);
}

export function Header({
  title,
  subtitle,
  right,
  back = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
}) {
  return (
    <View style={styles.header}>
      {back ? <IconButton icon="back" label="Back" onPress={goBack} /> : null}
      <View style={styles.flex}>
        <T variant="heading">{title}</T>
        {subtitle ? (
          <T variant="small" color="textSecondary">
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * Page frame: safe areas, centred column on wide screens, optional fixed header and footer.
 * `tabs` adds room for the tab bar (top bar on web, bottom bar on phones).
 */
export function Screen({
  children,
  header,
  footer,
  tabs = false,
  scroll = true,
  gap = 16,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tabs?: boolean;
  scroll?: boolean;
  gap?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const top = isWeb ? (tabs ? 96 : 24) : insets.top + 8;
  const bottom = tabs
    ? isWeb
      ? 32
      : insets.bottom + BottomTabInset + 16
    : insets.bottom + 16;

  const body = (
    <View style={[styles.column, { gap }]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: theme.background }]}>
      {header ? (
        <View style={[styles.centerRow, { paddingTop: top }]}>
          <View style={styles.column}>{header}</View>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            alignItems: 'center',
            paddingTop: header ? 8 : top,
            paddingBottom: footer ? 16 : bottom,
          }}>
          {body}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.flex,
            styles.centerRow,
            { paddingTop: header ? 8 : top, paddingBottom: footer ? 16 : bottom },
          ]}>
          {body}
        </View>
      )}
      {footer ? (
        <View
          style={[
            styles.centerRow,
            {
              paddingTop: 12,
              paddingBottom: isWeb ? 20 : insets.bottom + 12,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerRow: { width: '100%', alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 44, paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 72 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
