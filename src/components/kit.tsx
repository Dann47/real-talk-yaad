/**
 * Real Talk Yaad UI kit: text, buttons, cards, chips, icons, motion and the screen frame.
 * Every colour comes from useTheme(), so light/dark mode and the accent picker apply everywhere.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import Head from 'expo-router/head';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMyLook } from '@/lib/cosmetics';
import { press } from '@/lib/haptics';
import { heroGradient } from '@/theme/accent';
import { ThemeOverride } from '@/theme/override';

export const APP_NAME = 'Real Talk Yaad';

/* ---------- Fonts (loaded in app/_layout.tsx) ---------- */

export const FONT = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Use on TextInput so typed text matches the app font. */
export const inputText: TextStyle = { fontFamily: FONT.medium, fontSize: 16 };

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
  flame: { ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  cashout: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  trend: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
  store: { ios: 'storefront', android: 'storefront', web: 'storefront' },
  bolt: { ios: 'bolt', android: 'bolt', web: 'bolt' },
  speaker: { ios: 'speaker.wave.2', android: 'volume_up', web: 'volume_up' },
  muted: { ios: 'speaker.slash', android: 'volume_off', web: 'volume_off' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  sun: { ios: 'sun.max', android: 'light_mode', web: 'light_mode' },
  moon: { ios: 'moon', android: 'dark_mode', web: 'dark_mode' },
  phone: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  palette: { ios: 'paintpalette', android: 'palette', web: 'palette' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' },
  chevronUp: { ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' },
  headphones: { ios: 'headphones', android: 'headphones', web: 'headphones' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? theme.text} />;
}

/* ---------- Text ---------- */

const textStyles = StyleSheet.create({
  display: { fontFamily: FONT.extrabold, fontSize: 36, lineHeight: 42, letterSpacing: -0.8 },
  title: { fontFamily: FONT.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: FONT.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: FONT.bold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: FONT.bold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FONT.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  overline: { fontFamily: FONT.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
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

/* ---------- Motion ---------- */

/** Fades content up into place; pass an index to stagger lists. Respects the system reduce-motion setting. */
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 55)} style={style}>
      {children}
    </Animated.View>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'reward' | 'onAccent';

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
    secondary: { bg: theme.background, fg: theme.text, border: theme.backgroundSelected },
    ghost: { bg: 'transparent', fg: theme.accentText, border: 'transparent' },
    reward: { bg: theme.reward, fg: theme.onReward, border: theme.reward },
    onAccent: { bg: 'transparent', fg: theme.onAccent, border: theme.onAccent },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        if (variant === 'primary' || variant === 'reward') press();
        onPress?.();
        if (href) router.push(href);
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
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
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}>
      <Icon name={icon} size={size > 60 ? 30 : 20} color={filled ? theme.onAccent : theme.text} />
    </Pressable>
  );
}

/* ---------- Surfaces ---------- */

function useShadow(): ViewStyle {
  const theme = useTheme();
  return { boxShadow: `0 1px 2px ${theme.shadow}, 0 6px 16px ${theme.shadow}` };
}

/** Soft circles that give hero cards depth. Purely decorative. */
export function Decor({ color, pattern = 'rings' }: { color: string; pattern?: 'rings' | 'stripes' | 'dots' }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      {pattern === 'stripes' ? (
        [0, 1, 2, 3].map((i) => <View key={i} style={[styles.decorStripe, { backgroundColor: color, right: -40 + i * 34 }]} />)
      ) : pattern === 'dots' ? (
        Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={[styles.decorDot, { backgroundColor: color, right: 14 + (i % 4) * 22, top: 14 + Math.floor(i / 4) * 22 }]} />
        ))
      ) : (
        <>
          <View style={[styles.decorBig, { borderColor: color }]} />
          <View style={[styles.decorSmall, { backgroundColor: color }]} />
        </>
      )}
    </View>
  );
}

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'plain' | 'soft' | 'hero' | 'outlined' | 'reward';
}) {
  const theme = useTheme();
  const shadow = useShadow();
  const { card: skin } = useMyLook();
  const tones: Record<'plain' | 'soft' | 'hero' | 'outlined' | 'reward', ViewStyle> = {
    plain: { backgroundColor: theme.background, borderColor: theme.backgroundSelected, ...shadow },
    soft: { backgroundColor: theme.accentSoft, borderColor: 'transparent' },
    hero: { backgroundColor: theme.accent, borderColor: theme.accent, overflow: 'hidden', ...shadow },
    outlined: { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 2 },
    reward: { backgroundColor: theme.rewardSoft, borderColor: 'transparent' },
  };
  const toneStyle = tones[tone];
  if (tone === 'hero' && skin) {
    // A card skin from the Store: its own colours, and text in its colour.
    return (
      <View style={[styles.card, toneStyle, { backgroundColor: skin.background, borderColor: skin.background }, style]}>
        <Decor color={skin.text} pattern={skin.pattern} />
        <ThemeOverride value={{ onAccent: skin.text }}>{children}</ThemeOverride>
      </View>
    );
  }
  // Hero cards get a soft jade sheen (any accent works: the shades come from it).
  const sheen =
    tone === 'hero'
      ? Platform.OS === 'web'
        ? ({ backgroundImage: heroGradient(theme.accent) } as ViewStyle)
        : ({ experimental_backgroundImage: heroGradient(theme.accent) } as ViewStyle)
      : null;
  return (
    <View style={[styles.card, toneStyle, sheen, style]}>
      {tone === 'hero' ? <Decor color={theme.onAccent} /> : null}
      {children}
    </View>
  );
}

export function Chip({
  label,
  tone = 'reward',
  icon,
}: {
  label: string;
  tone?: 'reward' | 'soft' | 'accent' | 'onAccent';
  icon?: IconName;
}) {
  const theme = useTheme();
  const colors = {
    reward: { bg: theme.reward, fg: theme.onReward },
    soft: { bg: theme.accentSoft, fg: theme.accentText },
    accent: { bg: theme.accent, fg: theme.onAccent },
    onAccent: { bg: theme.background, fg: theme.accentText },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colors.bg }]}>
      {icon ? <Icon name={icon} size={14} color={colors.fg} /> : null}
      <T variant="caption" style={{ color: colors.fg, fontFamily: FONT.bold }}>
        {label}
      </T>
    </View>
  );
}

export function IconTile({ icon, tone = 'accent', size = 44 }: { icon: IconName; tone?: 'accent' | 'reward'; size?: number }) {
  const theme = useTheme();
  const colors = tone === 'reward' ? { bg: theme.rewardSoft, fg: theme.rewardText } : { bg: theme.accentSoft, fg: theme.accentText };
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.48} color={colors.fg} />
    </View>
  );
}

export function ProgressBar({ value, label, color }: { value: number; label: string; color?: string }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color ?? theme.accent }]} />
    </View>
  );
}

const BARS = [10, 18, 28, 16, 34, 44, 26, 38, 52, 30, 20, 40, 56, 36, 24, 46, 30, 18, 34, 22, 14, 26, 38, 20, 12];

export function Waveform({ color, active = true }: { color?: string; active?: boolean }) {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.waveform}>
      {BARS.map((h, i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: active ? h : 6,
            borderRadius: 3,
            backgroundColor: color ?? theme.accent,
            opacity: active ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

/** A Store frame: up to three rings of colour around an avatar. */
function Framed({ colors, size, children }: { colors: string[]; size: number; children: ReactNode }) {
  const band = Math.max(2, Math.round(size * 0.06));
  return colors.reduceRight<ReactNode>(
    (inner, color, i) => (
      <View
        style={{
          padding: band,
          borderRadius: (size + band * 2 * (colors.length - i)) / 2,
          backgroundColor: color,
        }}>
        {inner}
      </View>
    ),
    children,
  ) as ReactNode;
}

export function Avatar({
  letter,
  size = 44,
  ring,
  frame,
}: {
  letter: string;
  size?: number;
  ring?: string;
  /** Colours of a Store frame, outside in. */
  frame?: string[] | null;
}) {
  const theme = useTheme();
  if (frame?.length) {
    return (
      <Framed colors={frame} size={size}>
        <Avatar letter={letter} size={size} />
      </Framed>
    );
  }
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
        borderWidth: ring ? 3 : 0,
        borderColor: ring,
      }}>
      <T style={{ color: theme.onAccent, fontFamily: FONT.extrabold, fontSize: size * 0.4, lineHeight: size * 0.5 }}>{letter}</T>
    </View>
  );
}

/** A Store badge shown next to a name. */
export function NameBadge({ badge, small }: { badge: { icon: string; color: string; label: string } | null | undefined; small?: boolean }) {
  if (!badge) return null;
  const icon = (badge.icon in ICONS ? badge.icon : 'sparkles') as IconName;
  return (
    <View style={[styles.nameBadge, { backgroundColor: badge.color }, small && styles.nameBadgeSmall]} accessibilityLabel={`Badge: ${badge.label}`}>
      <Icon name={icon} size={small ? 10 : 12} color="#FFFFFF" />
      <Text style={[styles.nameBadgeText, small && { fontSize: 10 }]}>{badge.label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, href }: { title: string; action?: string; href?: Href }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="heading">{title}</T>
      {action && href ? <Button label={action} variant="ghost" compact href={href} style={styles.sectionAction} /> : null}
    </View>
  );
}

/** A tappable list row with an icon tile, two lines of text and a value on the right. */
export function ListRow({
  icon,
  tone = 'accent',
  title,
  subtitle,
  value,
  onPress,
  href,
}: {
  icon?: IconName;
  tone?: 'accent' | 'reward';
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  href?: Href;
}) {
  const theme = useTheme();
  const shadow = useShadow();
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
          backgroundColor: theme.background,
          borderColor: theme.backgroundSelected,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...shadow,
        },
      ]}>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
      <View style={styles.flex}>
        <T variant="bodyStrong">{title}</T>
        {subtitle ? (
          <T variant="small" color="textSecondary">
            {subtitle}
          </T>
        ) : null}
      </View>
      {value ? (
        <View style={[styles.valuePill, { backgroundColor: theme.accentSoft }]}>
          <T variant="caption" color="accentText" style={{ fontFamily: FONT.bold }}>
            {value}
          </T>
        </View>
      ) : (
        <Icon name="chevron" size={18} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

/* ---------- Forms ---------- */

/** Labelled text box with focus ring, error message and an optional show/hide toggle for passwords. */
export function TextField({
  label,
  error,
  hint,
  secure,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string; secure?: boolean }) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.backgroundSelected;

  return (
    <View style={styles.field}>
      <T variant="smallStrong">{label}</T>
      <View style={[styles.fieldBox, { borderColor, backgroundColor: theme.backgroundElement }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secure && hidden}
          autoCapitalize={secure ? 'none' : input.autoCapitalize}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.fieldInput, inputText, { color: theme.text }, Platform.OS === 'web' && styles.noOutline]}
          {...input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden(!hidden)}
            style={styles.fieldToggle}>
            <T variant="smallStrong" color="accentText">
              {hidden ? 'Show' : 'Hide'}
            </T>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <T variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T variant="small" color="textSecondary">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/** A short message box for form results. */
export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' | 'success' }) {
  const theme = useTheme();
  const colors = {
    info: { bg: theme.accentSoft, fg: theme.text, icon: 'sparkles' as IconName },
    success: { bg: theme.accentSoft, fg: theme.accentText, icon: 'check' as IconName },
    error: { bg: theme.backgroundElement, fg: theme.danger, icon: 'shield' as IconName },
  }[tone];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: colors.bg, borderColor: tone === 'error' ? theme.danger : 'transparent' }]}>
      <Icon name={colors.icon} size={18} color={colors.fg} />
      <T variant="small" style={[styles.flex, { color: colors.fg }]}>
        {text}
      </T>
    </View>
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
        <T variant="heading" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * Page frame: browser tab title, safe areas, centred column on wide screens, optional fixed header and footer.
 * `tabs` adds room for the tab bar (top bar on web, bottom bar on phones).
 */
export function Screen({
  title,
  children,
  header,
  footer,
  tabs = false,
  scroll = true,
  gap = 16,
  stickToBottom = false,
  onRefresh,
  refreshing = false,
}: {
  title?: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tabs?: boolean;
  scroll?: boolean;
  gap?: number;
  /** Chat mode: keep the newest content in view as it grows and when the keyboard opens. */
  stickToBottom?: boolean;
  /** Pull down to refresh (phones). */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (isWeb) return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardOpen(true);
      if (stickToBottom) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [isWeb, stickToBottom]);
  // Page transition. Phones get native slides between stacked pages, so this runs on the web,
  // and on phone tabs (which switch without any animation of their own). Replays each time the page comes into view.
  const animateIn = isWeb || tabs;
  const enter = useSharedValue(animateIn ? 0 : 1);
  useFocusEffect(
    useCallback(() => {
      if (!animateIn) return;
      enter.value = 0;
      enter.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    }, [animateIn, enter]),
  );
  // Phones never fade all the way out (a fully clear page can flash the window colour); the web can.
  const startOpacity = isWeb ? 0 : 0.6;
  const enterStyle = useAnimatedStyle(() => ({
    opacity: startOpacity + (1 - startOpacity) * enter.value,
    transform: [{ translateY: (1 - enter.value) * 18 }, { scale: 0.985 + enter.value * 0.015 }],
  }));

  const top = isWeb ? (tabs ? 104 : 28) : insets.top + 8;
  // Native tab screens already end above the tab bar (Android) or get it in the safe-area inset (iOS),
  // so only the safe area plus a little breathing room is needed. Adding the tab bar height again left a big gap.
  const bottom = isWeb ? 24 : insets.bottom + 16;

  const body = <View style={[styles.column, { gap }]}>{children}</View>;

  return (
    <KeyboardAvoidingView
      // Android draws edge to edge, so it needs padding too or the keyboard covers the footer.
      behavior={isWeb ? undefined : 'padding'}
      style={[styles.flex, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.flex, enterStyle]}>
      <Head>
        <title>{title ? `${title} · ${APP_NAME}` : APP_NAME}</title>
      </Head>
      {header ? (
        <View style={[styles.centerRow, { paddingTop: top }]}>
          <View style={styles.column}>{header}</View>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={stickToBottom ? () => scrollRef.current?.scrollToEnd({ animated: true }) : undefined}
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
            ) : undefined
          }
          contentContainerStyle={{
            alignItems: 'center',
            paddingTop: header ? 8 : top,
            paddingBottom: footer ? 20 : bottom,
          }}>
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.centerRow, { paddingTop: header ? 8 : top, paddingBottom: footer ? 20 : bottom }]}>
          {body}
        </View>
      )}
      {footer ? (
        <View
          style={[
            styles.centerRow,
            {
              paddingTop: 14,
              // The keyboard already covers the home-indicator area, so drop that gap while it is open.
              paddingBottom: isWeb ? 20 : keyboardOpen ? 12 : insets.bottom + 12,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerRow: { width: '100%', alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  button: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 44, paddingHorizontal: 16 },
  card: { borderRadius: 22, borderWidth: 1, padding: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  decorBig: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 28, right: -80, top: -90, opacity: 0.1 },
  decorSmall: { position: 'absolute', width: 90, height: 90, borderRadius: 45, right: 40, bottom: -50, opacity: 0.08 },
  decorStripe: { position: 'absolute', top: -40, width: 14, height: 320, opacity: 0.12, transform: [{ rotate: '24deg' }] },
  decorDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, opacity: 0.18 },
  nameBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  nameBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, gap: 3 },
  nameBadgeText: { color: '#FFFFFF', fontFamily: FONT.bold, fontSize: 11 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 72 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  valuePill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionAction: { minHeight: 36, paddingHorizontal: 8 },
  field: { gap: 6 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 16, minHeight: 52 },
  fieldInput: { flex: 1, minHeight: 50, paddingHorizontal: 16 },
  noOutline: { outlineWidth: 0 },
  fieldToggle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
});
