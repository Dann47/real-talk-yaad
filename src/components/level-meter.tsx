import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Live microphone level: one bar per recent reading, newest on the right.
 * Levels are 0 (silence) to 1 (loud).
 */
export function LevelMeter({ levels, color }: { levels: number[]; color?: string }) {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.meter}>
      {levels.map((level, i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: 6 + Math.round(level * 58),
            borderRadius: 3,
            backgroundColor: color ?? theme.accent,
            opacity: 0.35 + level * 0.65,
          }}
        />
      ))}
    </View>
  );
}

/** Turns a decibel reading (about -60 quiet … 0 loud) into 0–1. */
export function levelFromDecibels(db?: number): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 72 },
});
