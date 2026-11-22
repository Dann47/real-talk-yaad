/** A recording drawn as bars. Tap to play or pause; tap a spot to jump there. The played part fills in. */
import { useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { Icon, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { clock } from '@/lib/use-recorder';

export function TakeWaveform({
  waveform,
  durationMs,
  progress,
  playing,
  onToggle,
  onSeek,
}: {
  waveform: number[];
  durationMs: number;
  /** 0–1: how much has played. */
  progress: number;
  playing: boolean;
  onToggle: () => void;
  /** Jump to a point, 0–1 along the recording. */
  onSeek: (fraction: number) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const playedBars = Math.round(progress * waveform.length);

  const seek = (event: GestureResponderEvent) => {
    if (!width) return;
    onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / width)));
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause your recording' : 'Play your recording'}
        onPress={onToggle}
        style={({ pressed }) => [styles.play, { backgroundColor: theme.accent, transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
        <Icon name={playing ? 'stop' : 'play'} size={20} color={theme.onAccent} />
      </Pressable>

      <View style={styles.flex}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Recording timeline. Tap a spot to jump there."
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onPress={seek}
          style={styles.bars}>
          {waveform.map((level, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.bar,
                {
                  height: 6 + Math.round(level * 34),
                  backgroundColor: i < playedBars ? theme.accent : theme.backgroundSelected,
                },
              ]}
            />
          ))}
        </Pressable>
        <View style={styles.times}>
          <T variant="caption" color="textSecondary">
            {clock(progress * durationMs)}
          </T>
          <T variant="caption" color="textSecondary">
            {clock(durationMs)}
          </T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, borderWidth: 1 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  bar: { width: 3, borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
});
