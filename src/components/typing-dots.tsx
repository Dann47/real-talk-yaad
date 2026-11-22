import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

function Dot({ delay }: { delay: number }) {
  const theme = useTheme();
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 })), -1),
    );
  }, [delay, lift]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + lift.value * 0.6,
    transform: [{ translateY: -3 * lift.value }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: theme.textSecondary }, style]} />;
}

/** Three bouncing dots shown while the AI is writing. */
export function TypingDots() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="The AI is typing"
      style={[styles.bubble, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      {[0, 150, 300].map((delay) => (
        <Dot key={delay} delay={delay} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
