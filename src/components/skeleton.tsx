/** Soft pulsing placeholders while something loads (instead of a lone spinner). */
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

export function Skeleton({ width = '100%', height = 14, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }, animated, style]} />;
}

/** A Feed post that hasn't loaded yet. */
export function PostSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.post, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]} accessibilityLabel="Loading">
      <View style={styles.row}>
        <Skeleton width={34} height={34} radius={17} />
        <View style={styles.lines}>
          <Skeleton width="40%" />
          <Skeleton width="20%" height={10} />
        </View>
      </View>
      <Skeleton height={220} radius={18} />
      <Skeleton width="70%" />
    </View>
  );
}

/** A grid of Store items that haven't loaded yet. */
export function TileSkeletons({ count = 4 }: { count?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.grid} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
          <Skeleton height={96} radius={14} />
          <Skeleton width="60%" />
          <Skeleton width="35%" height={10} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  post: { gap: 12, padding: 12, borderRadius: 24, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lines: { flex: 1, gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', flexGrow: 1, padding: 10, borderRadius: 20, gap: 8 },
});
