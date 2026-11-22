/**
 * Hold to record, release to finish, slide up to delete (the take flies into the trash).
 * With a screen reader on, it becomes tap to start / tap to finish, since holding and sliding are hard there.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 92;
const HALO = 116;
/** How far up (px) the finger must slide to delete. */
const CANCEL_DISTANCE = 90;
/** Where the trash can sits, measured up from the middle of the mic. */
const TRASH_Y = -140;

export function HoldToRecord({
  disabled,
  busy,
  recording,
  level,
  onStart,
  onRelease,
}: {
  disabled: boolean;
  busy: boolean;
  recording: boolean;
  /** 0–1 live microphone level; the ring grows with it. */
  level: number;
  onStart: () => void;
  /** Called when the finger lifts: cancelled = slid up to the trash. */
  onRelease: (cancelled: boolean) => void;
}) {
  const theme = useTheme();
  const [holding, setHolding] = useState(false);
  const [armed, setArmed] = useState(false);
  const [binning, setBinning] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  const drag = useSharedValue(0);
  const blobY = useSharedValue(0);
  const blobScale = useSharedValue(1);
  const blobOpacity = useSharedValue(0);
  const trashScale = useSharedValue(1);
  const trashTilt = useSharedValue(0);

  const latest = useRef({ disabled, onStart, onRelease });
  latest.current = { disabled, onStart, onRelease };
  const armedRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => subscription.remove();
  }, []);

  const throwInTrash = () => {
    setBinning(true);
    blobY.value = drag.value;
    blobScale.value = 1;
    blobOpacity.value = 1;
    blobY.value = withTiming(TRASH_Y, { duration: 280 });
    blobScale.value = withTiming(0.2, { duration: 280 });
    blobOpacity.value = withDelay(220, withTiming(0, { duration: 100 }));
    trashScale.value = withDelay(260, withSequence(withTiming(1.35, { duration: 110 }), withTiming(1, { duration: 150 })));
    trashTilt.value = withDelay(
      260,
      withSequence(
        withTiming(-16, { duration: 70 }),
        withTiming(16, { duration: 70 }),
        withTiming(-8, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      ),
    );
    setTimeout(() => setBinning(false), 850);
  };

  const release = useRef(() => {});
  release.current = () => {
    const cancelled = armedRef.current;
    armedRef.current = false;
    setHolding(false);
    setArmed(false);
    if (cancelled) throwInTrash();
    drag.value = withSpring(0, { damping: 16 });
    latest.current.onRelease(cancelled);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => false,
      // Don't let the page scroll steal the finger while recording.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        armedRef.current = false;
        drag.value = 0;
        setArmed(false);
        setHolding(true);
        latest.current.onStart();
      },
      onPanResponderMove: (_event, gesture) => {
        const y = Math.max(TRASH_Y, Math.min(0, gesture.dy));
        drag.value = y;
        const nowArmed = y <= -CANCEL_DISTANCE;
        if (nowArmed !== armedRef.current) {
          armedRef.current = nowArmed;
          setArmed(nowArmed);
        }
      },
      onPanResponderRelease: () => release.current(),
      onPanResponderTerminate: () => release.current(),
    }),
  ).current;

  const micStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const blobStyle = useAnimatedStyle(() => ({
    opacity: blobOpacity.value,
    transform: [{ translateY: blobY.value }, { scale: blobScale.value }],
  }));
  const trashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trashScale.value }, { rotate: `${trashTilt.value}deg` }],
  }));

  const active = recording || holding;
  const showTrack = (holding && !screenReader) || binning;

  const circle = (
    <View
      style={[
        styles.mic,
        {
          backgroundColor: active ? theme.reward : theme.accent,
          opacity: disabled && !active ? 0.5 : 1,
        },
      ]}>
      {busy && !holding ? (
        <ActivityIndicator color={theme.onAccent} size="large" />
      ) : (
        <Icon name="mic" size={34} color={active ? theme.onReward : theme.onAccent} />
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {showTrack ? (
        <View pointerEvents="none" style={styles.track}>
          <Animated.View
            style={[
              styles.trash,
              trashStyle,
              {
                backgroundColor: armed || binning ? theme.danger : theme.background,
                borderColor: theme.danger,
              },
            ]}>
            <Icon name="trash" size={22} color={armed || binning ? '#FFFFFF' : theme.danger} />
          </Animated.View>
          {!binning ? (
            <View style={[styles.hint, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <Icon name="chevronUp" size={14} color={armed ? theme.danger : theme.textSecondary} />
              <T variant="caption" color={armed ? 'danger' : 'textSecondary'}>
                {armed ? 'Let go to delete' : 'Slide up to delete'}
              </T>
            </View>
          ) : null}
        </View>
      ) : null}

      {binning ? (
        <Animated.View pointerEvents="none" style={[styles.blob, blobStyle, { backgroundColor: theme.reward }]}>
          <Icon name="mic" size={20} color={theme.onReward} />
        </Animated.View>
      ) : null}

      {/* Outer layer follows the finger; inner ring grows with the voice level. */}
      <Animated.View style={micStyle}>
        <View
          style={[
            styles.halo,
            {
              backgroundColor: active ? theme.rewardSoft : 'transparent',
              transform: [{ scale: active ? 1 + level * 0.35 : 1 }],
            },
          ]}>
        {screenReader ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            accessibilityState={{ disabled, busy: recording }}
            disabled={disabled && !recording}
            onPress={() => (recording ? onRelease(false) : onStart())}>
            {circle}
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Hold to record"
            accessibilityHint="Hold while you talk and let go to finish. Slide up to delete."
            accessibilityState={{ disabled, busy: recording }}
            {...responder.panHandlers}>
            {circle}
          </View>
        )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  halo: { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
  track: {
    position: 'absolute',
    left: -60,
    right: -60,
    top: HALO / 2 + TRASH_Y - 26,
    height: -TRASH_Y,
    alignItems: 'center',
    gap: 12,
  },
  trash: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  blob: {
    position: 'absolute',
    top: HALO / 2 - 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
