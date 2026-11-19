import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACCENT_PALETTE, ACCENT_PRESETS, normalizeHex } from '@/theme/accent';
import { useThemeSettings, type ThemePreference } from '@/theme/theme-provider';

const MODES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function Swatch({
  color,
  label,
  selected,
  size,
  onPress,
}: {
  color: string;
  label: string;
  selected: boolean;
  size: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? theme.text : theme.backgroundSelected,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    />
  );
}

/** Light / dark / system switch and an accent colour picker. */
export function ThemeSettings() {
  const { preference, setPreference, accent, setAccent, resetAccent } = useThemeSettings();
  const theme = useTheme();
  const [hexInput, setHexInput] = useState(accent);
  const [error, setError] = useState<string | null>(null);

  // Keep the text box in step when the accent changes from a swatch or reset.
  useEffect(() => {
    setHexInput(accent);
  }, [accent]);

  const pick = (hex: string) => {
    setAccent(hex);
    setError(null);
  };

  const applyHex = () => {
    if (setAccent(hexInput)) {
      setError(null);
    } else {
      setError('Enter a colour code like #0B6E4F');
    }
  };

  const typed = normalizeHex(hexInput);

  return (
    <View style={styles.wrap}>
      <View style={styles.section}>
        <ThemedText type="smallBold">Appearance</ThemedText>
        <ThemedView type="backgroundElement" style={styles.segment} accessibilityRole="radiogroup">
          {MODES.map((mode) => {
            const selected = preference === mode.value;
            return (
              <Pressable
                key={mode.value}
                onPress={() => setPreference(mode.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.segmentItem, selected && { backgroundColor: theme.accent }]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: selected ? theme.onAccent : theme.text }}>
                  {mode.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          System follows your phone's light or dark setting.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">Accent colour</ThemedText>
          <Pressable onPress={resetAccent} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" themeColor="accentText">
              Reset
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.swatchRow}>
          {ACCENT_PRESETS.map((preset) => (
            <Swatch
              key={preset.hex}
              color={preset.hex}
              label={preset.name}
              size={40}
              selected={accent === preset.hex}
              onPress={() => pick(preset.hex)}
            />
          ))}
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          More colours
        </ThemedText>
        <View style={styles.palette}>
          {ACCENT_PALETTE.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.paletteRow}>
              {row.map((hex) => (
                <Swatch
                  key={hex}
                  color={hex}
                  label={`Colour ${hex}`}
                  size={24}
                  selected={accent === hex}
                  onPress={() => pick(hex)}
                />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.hexRow}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.hexPreview,
              { backgroundColor: typed ?? theme.backgroundElement, borderColor: theme.backgroundSelected },
            ]}
          />
          <TextInput
            value={hexInput}
            onChangeText={setHexInput}
            onSubmitEditing={applyHex}
            accessibilityLabel="Custom accent colour code"
            placeholder="#0B6E4F"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            style={[
              styles.hexInput,
              { color: theme.text, borderColor: error ? '#D93025' : theme.backgroundSelected },
            ]}
          />
          <Pressable
            onPress={applyHex}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.applyButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Apply
            </ThemedText>
          </Pressable>
        </View>
        {error ? (
          <ThemedText type="small" style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Preview</ThemedText>
        <ThemedView type="backgroundElement" style={styles.preview}>
          <View style={[styles.previewButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Start talking
            </ThemedText>
          </View>
          <View style={[styles.previewChip, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold" style={{ color: theme.text }}>
              Level 3 · Trusted Teacher
            </ThemedText>
          </View>
          <ThemedText type="smallBold" themeColor="accentText">
            +J$15 when verified
          </ThemedText>
        </ThemedView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two + Spacing.one,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three - Spacing.one,
  },
  palette: {
    gap: Spacing.two,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  hexPreview: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  hexInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  applyButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#D93025',
  },
  preview: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three - Spacing.one,
    alignItems: 'flex-start',
  },
  previewButton: {
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
  },
  previewChip: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three - Spacing.one,
    borderRadius: Spacing.three,
  },
});
