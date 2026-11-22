/** Small celebrations: a confetti burst and a reward that floats up. Both skip when "reduce motion" is on. */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { cheer } from '@/lib/haptics';

const PIECES = 18;

function Piece({ index, color }: { index: number; color: string }) {
  const progress = useSharedValue(0);
  // Spread the pieces evenly around a half-circle pointing up, with a little variety.
  const angle = Math.PI * (0.1 + (0.8 * index) / (PIECES - 1));
  const distance = 70 + ((index * 37) % 60);
  const spin = ((index * 53) % 360) - 180;

  useEffect(() => {
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: 1 - t * t,
      transform: [
        { translateX: Math.cos(angle) * distance * t },
        // Up and out, then gravity pulls it back down.
        { translateY: -Math.sin(angle) * distance * t + 90 * t * t },
        { rotate: `${spin * t}deg` },
      ],
    };
  });

  return <Animated.View style={[styles.piece, { backgroundColor: color, width: index % 3 ? 8 : 6, height: index % 2 ? 12 : 8 }, style]} />;
}

/** A burst of confetti. Change `burst` (e.g. a counter) to fire it again. */
export function Confetti({ burst }: { burst: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (burst) cheer();
  }, [burst]);
  if (!burst || reduced) return null;
  const colors = [theme.accent, theme.reward, theme.accentText, theme.danger];
  return (
    <View pointerEvents="none" style={styles.origin} key={burst}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} color={colors[i % colors.length]} />
      ))}
    </View>
  );
}

/** A chip like "+J$4" that rises and fades. Change `trigger` to show it again. */
export function FloatUp({ trigger, label }: { trigger: number; label: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const rise = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    rise.value = 0;
    opacity.value = 1;
    rise.value = withTiming(reduced ? 0 : -56, { duration: 1100, easing: Easing.out(Easing.cubic) });
    opacity.value = withSequence(withTiming(1, { duration: 150 }), withDelay(650, withTiming(0, { duration: 300 })));
  }, [trigger, reduced, rise, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: rise.value }] }));

  if (!trigger) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.float, { backgroundColor: theme.reward }, style]}>
      <T variant="smallStrong" style={{ color: theme.onReward }}>
        {label}
      </T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '40%', width: 0, height: 0, zIndex: 20 },
  piece: { position: 'absolute', borderRadius: 2 },
  float: { position: 'absolute', alignSelf: 'center', top: -8, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, zIndex: 20 },
});
