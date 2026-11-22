/**
 * Appearance: a live preview, light / dark / system, accent colour, your Store look, and privacy.
 * Every change applies straight away and is saved on this phone.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Appear, Avatar, Card, Icon, IconTile, NameBadge, ProgressBar, SectionHeader, T, inputText, type IconName } from '@/components/kit';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { useMyLook } from '@/lib/cosmetics';
import { HIDDEN, useHideAmounts } from '@/lib/hide-amounts';
import { CATEGORY_LABEL, loadCatalog, type StoreCategory, type StoreItem } from '@/lib/store';
import { ACCENT_PALETTE, ACCENT_PRESETS, DEFAULT_ACCENT, accentColors, contrastRatio, normalizeHex } from '@/theme/accent';
import { DEFAULT_PREFERENCE, useThemeSettings, type ThemePreference } from '@/theme/theme-provider';

/** Space between named colours, and between palette swatches. */
const GAP = 10;
const SMALL_GAP = 6;

const MODES: { value: ThemePreference; label: string; icon: IconName; detail: string }[] = [
  { value: 'dark', label: 'Dark', icon: 'moon', detail: 'The original look' },
  { value: 'light', label: 'Light', icon: 'sun', detail: 'Bright and clear' },
  { value: 'system', label: 'Auto', icon: 'phone', detail: 'Follows your phone' },
];

/** A tiny drawing of the app in light or dark, for the mode tiles. */
function MiniScreen({ scheme, accent }: { scheme: 'light' | 'dark'; accent: string }) {
  const c = Colors[scheme];
  return (
    <View style={[styles.mini, { backgroundColor: c.background, borderColor: c.backgroundSelected }]}>
      <View style={[styles.miniHero, { backgroundColor: accent }]} />
      <View style={[styles.miniLine, { backgroundColor: c.backgroundSelected, width: '80%' }]} />
      <View style={[styles.miniLine, { backgroundColor: c.backgroundSelected, width: '55%' }]} />
    </View>
  );
}

/** The app in miniature, using your real colours and Store look. */
function LivePreview() {
  const theme = useTheme();
  const { user, profile } = useAuth();
  const look = useMyLook();
  const [hidden] = useHideAmounts();
  const name = displayName(profile, user);

  return (
    <View style={[styles.phone, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
      <View style={styles.phoneTop}>
        <Avatar letter={name[0]?.toUpperCase() ?? 'R'} size={30} frame={look.frame?.colors} />
        <View style={styles.flex}>
          <T variant="caption" color="textSecondary">
            Mawnin
          </T>
          <View style={styles.nameRow}>
            <T variant="smallStrong" numberOfLines={1}>
              {name}
            </T>
            <NameBadge badge={look.badge} small />
          </View>
        </View>
      </View>
      <Card tone="hero" style={styles.phoneHero}>
        <T variant="caption" style={{ color: theme.onAccent, opacity: 0.85 }}>
          Available balance
        </T>
        <T variant="title" style={{ color: theme.onAccent }}>
          {hidden ? HIDDEN : 'J$1,250.00'}
        </T>
        <ProgressBar value={0.62} label="Weekly goal" color={theme.reward} />
      </Card>
      <View style={styles.phoneRow}>
        <View style={[styles.phoneButton, { backgroundColor: theme.accent }]}>
          <T variant="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>
            Start talking
          </T>
        </View>
        <View style={[styles.phoneChip, { backgroundColor: theme.accentSoft }]}>
          <T variant="caption" color="accentText">
            +J$7 when checked
          </T>
        </View>
      </View>
      <View style={[styles.phoneTabs, { borderTopColor: theme.backgroundSelected }]}>
        {(['home', 'check', 'video', 'wallet', 'person'] as IconName[]).map((icon, i) => (
          <View key={icon} style={[styles.phoneTab, i === 0 && { backgroundColor: theme.accentSoft }]}>
            <Icon name={icon} size={14} color={i === 0 ? theme.accentText : theme.textSecondary} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Swatch({ color, label, selected, size, onPress }: { color: string; label: string; selected: boolean; size: number; onPress: () => void }) {
  const theme = useTheme();
  const tick = accentColors(color, '#FFFFFF').onAccent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => [
        styles.swatch,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderColor: selected ? theme.text : 'transparent',
          transform: [{ scale: pressed ? 0.9 : selected ? 1.08 : 1 }],
        },
      ]}>
      {selected ? <Icon name="check" size={size * 0.45} color={tick} /> : null}
    </Pressable>
  );
}

export function ThemeSettings() {
  const theme = useTheme();
  const { preference, scheme, setPreference, accent, setAccent, resetAccent } = useThemeSettings();
  const look = useMyLook();
  const [hidden, toggleHidden] = useHideAmounts();
  const [hexInput, setHexInput] = useState(accent);
  const [showMore, setShowMore] = useState(false);
  const [owned, setOwned] = useState<StoreItem[] | null>(null);
  // Width of the colour card's inside, so swatches can be sized to fill each row evenly.
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    setHexInput(accent);
  }, [accent]);

  // Names of what you're wearing from the Store.
  useFocusEffect(
    useCallback(() => {
      loadCatalog()
        .then((items) => setOwned(items.filter((item) => item.owned)))
        .catch(() => setOwned([]));
    }, []),
  );

  const typed = normalizeHex(hexInput);

  // Named colours: as many per row as fit at ~64pt each, every column the same width (rows line up).
  const PRESET_MIN = 64;
  const presetCols = gridWidth ? Math.max(3, Math.min(ACCENT_PRESETS.length, Math.floor((gridWidth + GAP) / (PRESET_MIN + GAP)))) : 0;
  const presetWidth = presetCols ? (gridWidth - GAP * (presetCols - 1)) / presetCols : PRESET_MIN;
  const presetSize = Math.min(48, Math.max(36, presetWidth - 16));

  // Palette: 12 hues per row, sized to fill the width; on narrow screens each row splits in two.
  const perRow = gridWidth && (gridWidth - SMALL_GAP * 11) / 12 < 22 ? 6 : 12;
  const swatch = gridWidth ? Math.min(44, Math.floor((gridWidth - SMALL_GAP * (perRow - 1)) / perRow)) : 24;
  const paletteRows = ACCENT_PALETTE.flatMap((row) => (perRow === 12 ? [row] : [row.slice(0, 6), row.slice(6)]));
  const presetName = ACCENT_PRESETS.find((p) => p.hex === accent)?.name;
  const readable = contrastRatio(accent, theme.background) >= 3;

  const onHex = (text: string) => {
    const value = text.startsWith('#') ? text : `#${text}`;
    setHexInput(value.toUpperCase());
    // Apply as soon as it's a full, valid colour.
    const valid = normalizeHex(value);
    if (valid && value.replace('#', '').length === 6) setAccent(valid);
  };

  const wearing = (slot: StoreCategory) => owned?.find((item) => item.category === slot && item.equipped) ?? null;
  const ownedCount = (slot: StoreCategory) => owned?.filter((item) => item.category === slot).length ?? 0;
  const isDefault = preference === DEFAULT_PREFERENCE && accent === DEFAULT_ACCENT;

  return (
    <View style={styles.wrap}>
      {/* Live preview */}
      <Appear>
        <LivePreview />
        <T variant="caption" color="textSecondary" style={styles.center}>
          Changes show here and across the app straight away.
        </T>
      </Appear>

      {/* Mode */}
      <Appear index={1}>
        <SectionHeader title="Light or dark" />
      </Appear>
      <Appear index={1} style={styles.modes}>
        {MODES.map((mode) => {
          const selected = preference === mode.value;
          return (
            <Pressable
              key={mode.value}
              onPress={() => setPreference(mode.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${mode.label}: ${mode.detail}`}
              style={({ pressed }) => [
                styles.mode,
                {
                  backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                  borderColor: selected ? theme.accent : theme.backgroundSelected,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}>
              {mode.value === 'system' ? (
                <View style={styles.split}>
                  <View style={styles.splitHalf}>
                    <MiniScreen scheme="light" accent={accent} />
                  </View>
                  <View style={styles.splitHalf}>
                    <MiniScreen scheme="dark" accent={accent} />
                  </View>
                </View>
              ) : (
                <MiniScreen scheme={mode.value} accent={accent} />
              )}
              <View style={styles.modeLabel}>
                <Icon name={mode.icon} size={14} color={selected ? theme.accentText : theme.textSecondary} />
                <T variant="smallStrong" color={selected ? 'accentText' : 'text'}>
                  {mode.label}
                </T>
              </View>
              <T variant="caption" color="textSecondary" style={styles.center}>
                {mode.value === 'system' ? `Now ${scheme}` : mode.detail}
              </T>
            </Pressable>
          );
        })}
      </Appear>

      {/* Accent */}
      <Appear index={2} style={styles.accentHeader}>
        <View style={styles.flex}>
          <T variant="heading">Accent colour</T>
          <T variant="caption" color="textSecondary">
            {presetName ?? 'Custom'} · {accent}
          </T>
        </View>
        <View style={[styles.current, { backgroundColor: accent }]} />
      </Appear>
      <Appear index={2}>
        <Card style={styles.accentCard}>
          <View style={styles.presets} onLayout={(e) => setGridWidth(Math.floor(e.nativeEvent.layout.width))}>
            {ACCENT_PRESETS.map((preset) => (
              <View key={preset.hex} style={[styles.preset, { width: presetWidth }]}>
                <Swatch color={preset.hex} label={preset.name} size={presetSize} selected={accent === preset.hex} onPress={() => setAccent(preset.hex)} />
                <T variant="caption" color={accent === preset.hex ? 'accentText' : 'textSecondary'} numberOfLines={1}>
                  {preset.name}
                </T>
              </View>
            ))}
          </View>

          <Pressable accessibilityRole="button" onPress={() => setShowMore(!showMore)} style={[styles.more, { borderTopColor: theme.backgroundSelected }]}>
            <Icon name="palette" size={16} color={theme.accentText} />
            <T variant="smallStrong" color="accentText" style={styles.flex}>
              {showMore ? 'Fewer colours' : 'More colours and custom'}
            </T>
            <Icon name={showMore ? 'chevronUp' : 'chevron'} size={14} color={theme.accentText} />
          </Pressable>

          {showMore ? (
            <Appear style={styles.moreBlock}>
              {paletteRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.paletteRow}>
                  {row.map((hex) => (
                    <Swatch key={hex} color={hex} label={`Colour ${hex}`} size={swatch} selected={accent === hex} onPress={() => setAccent(hex)} />
                  ))}
                </View>
              ))}
              <View style={styles.hexRow}>
                <View style={[styles.hexPreview, { backgroundColor: typed ?? theme.backgroundElement, borderColor: theme.backgroundSelected }]} />
                <TextInput
                  value={hexInput}
                  onChangeText={onHex}
                  accessibilityLabel="Custom colour code"
                  placeholder="#07805C"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  style={[
                    styles.hexInput,
                    inputText,
                    { color: theme.text, backgroundColor: theme.background, borderColor: typed || hexInput.length < 7 ? theme.backgroundSelected : theme.danger },
                    Platform.OS === 'web' && ({ outlineWidth: 0 } as object),
                  ]}
                />
              </View>
              <T variant="caption" color="textSecondary">
                Type a colour code like #07805C. It applies as soon as it's complete.
              </T>
            </Appear>
          ) : null}

          <View style={[styles.readable, { backgroundColor: theme.background }]}>
            <Icon name={readable ? 'check' : 'info'} size={14} color={readable ? theme.accentText : theme.rewardText} />
            <T variant="caption" color="textSecondary" style={styles.flex}>
              {readable
                ? 'Easy to read in this mode.'
                : 'This colour is light here, so text uses a deeper shade of it to stay readable.'}
            </T>
          </View>
        </Card>
      </Appear>

      {/* Store look */}
      <Appear index={3}>
        <SectionHeader title="Your look" action="Store" href={'/store' as Href} />
      </Appear>
      <Appear index={3}>
        <Card style={styles.list}>
          {(['card', 'frame', 'badge'] as StoreCategory[]).map((slot, i) => {
            const item = wearing(slot);
            const count = ownedCount(slot);
            const icon: IconName = slot === 'card' ? 'wallet' : slot === 'frame' ? 'person' : 'sparkles';
            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                onPress={() => router.push(`/store?filter=${slot}` as Href)}
                style={({ pressed }) => [
                  styles.listRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <IconTile icon={icon} tone={item ? 'reward' : 'accent'} size={36} />
                <View style={styles.flex}>
                  <T variant="bodyStrong">{CATEGORY_LABEL[slot]}</T>
                  <T variant="caption" color="textSecondary">
                    {owned === null ? '…' : item ? `Wearing ${item.name}` : count ? `${count} owned · none on` : 'None yet'}
                  </T>
                </View>
                {slot === 'frame' && look.frame ? (
                  <Avatar letter="R" size={26} frame={look.frame.colors} />
                ) : slot === 'badge' && look.badge ? (
                  <NameBadge badge={look.badge} small />
                ) : slot === 'card' && look.card ? (
                  <View style={[styles.skinDot, { backgroundColor: look.card.background, borderColor: look.card.text }]} />
                ) : (
                  <Icon name="chevron" size={14} color={theme.textSecondary} />
                )}
              </Pressable>
            );
          })}
        </Card>
      </Appear>

      {/* Privacy */}
      <Appear index={4}>
        <SectionHeader title="Privacy" />
      </Appear>
      <Appear index={4}>
        <Card style={styles.toggle}>
          <IconTile icon={hidden ? 'eyeOff' : 'eye'} size={36} />
          <View style={styles.flex}>
            <T variant="bodyStrong">Hide money amounts</T>
            <T variant="caption" color="textSecondary">
              Shows J$ •••• on Home, Work, Wallet and Me. Handy in public.
            </T>
          </View>
          <Switch
            accessibilityLabel="Hide money amounts"
            value={hidden}
            onValueChange={toggleHidden}
            trackColor={{ true: theme.accentSoft, false: theme.backgroundSelected }}
            thumbColor={hidden ? theme.accent : theme.textSecondary}
            {...({ activeThumbColor: theme.accent, activeTrackColor: theme.accentSoft } as object)}
          />
        </Card>
      </Appear>

      {!isDefault ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPreference(DEFAULT_PREFERENCE);
            resetAccent();
          }}
          style={styles.reset}>
          <Icon name="undo" size={14} color={theme.textSecondary} />
          <T variant="smallStrong" color="textSecondary">
            Back to the original look
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  wrap: { gap: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  phone: { alignSelf: 'center', width: '100%', maxWidth: 340, gap: 10, padding: 14, paddingBottom: 0, borderRadius: 28, borderWidth: 6, overflow: 'hidden', marginBottom: 8 },
  phoneTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneHero: { gap: 6, padding: 14 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  phoneChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  phoneTabs: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: -14 },
  phoneTab: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },

  modes: { flexDirection: 'row', gap: 10 },
  mode: { flex: 1, alignItems: 'center', gap: 6, padding: 10, borderRadius: 20, borderWidth: 2 },
  modeLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mini: { width: '100%', height: 64, borderRadius: 10, borderWidth: 1, padding: 6, gap: 4 },
  miniHero: { height: 22, borderRadius: 5 },
  miniLine: { height: 5, borderRadius: 3 },
  split: { flexDirection: 'row', width: '100%', borderRadius: 10, overflow: 'hidden' },
  splitHalf: { flex: 1, overflow: 'hidden' },

  accentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  current: { width: 32, height: 32, borderRadius: 16 },
  accentCard: { gap: 14 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 14 },
  preset: { alignItems: 'center', gap: 4 },
  swatch: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  moreBlock: { gap: 10 },
  paletteRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  hexPreview: { width: 44, height: 44, borderRadius: 12, borderWidth: 1 },
  hexInput: { flex: 1, minHeight: 44, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 12 },
  readable: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },

  list: { padding: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
  skinDot: { width: 26, height: 26, borderRadius: 8, borderWidth: 3 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
});
