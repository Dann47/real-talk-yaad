import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Confetti, FloatUp } from '@/components/celebrate';
import { DiffText, FixSheet } from '@/components/fix-editor';
import { HoldToRecord } from '@/components/hold-to-record';
import { Appear, Button, Card, Chip, Header, Icon, IconTile, Notice, Screen, T, TextField, goBack, type IconName } from '@/components/kit';
import { LevelMeter } from '@/components/level-meter';
import { TakeWaveform } from '@/components/take-waveform';
import { money } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useRates } from '@/lib/rates';
import { finishSet, fixProblem, markSkipped, nextPrompts, saveDraftFixes, saveRecording, type SetLine } from '@/lib/recordings';
import { QUIET_LEVEL, clock, useRecorder, type Take } from '@/lib/use-recorder';

const MIN_MS = 800;
const MAX_MS = 60_000;
/** Read-along pace: how long each word stays highlighted. */
const MS_PER_WORD = 380;

type SavedLine = { id: number; text: string; uri: string; duration: number; amount: number; fixed: boolean };

/** What the reader decided about the AI's line before recording it. */
type Choice = { kind: 'as_is' | 'fixed'; text: string };

/** The line, highlighting word by word while recording so readers keep a natural pace. */
function ReadAlong({ text, activeWord }: { text: string; activeWord: number | null }) {
  const theme = useTheme();
  const words = text.split(/\s+/);
  return (
    <T variant="title" accessibilityLabel={text}>
      {words.map((word, i) => (
        <Text
          key={i}
          style={{
            color: activeWord === null ? theme.text : i <= activeWord ? theme.accentText : theme.textSecondary,
          }}>
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </Text>
      ))}
    </T>
  );
}

/** One of the two big choices under a fresh line: keep it, or fix it. */
function ChoiceTile({
  icon,
  title,
  detail,
  pay,
  tone,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  pay: string | null;
  tone: 'accent' | 'reward';
  onPress: () => void;
}) {
  const theme = useTheme();
  const edge = tone === 'reward' ? theme.reward : theme.accent;
  const wash = tone === 'reward' ? theme.rewardSoft : theme.accentSoft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}${pay ? `. Earn ${pay}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: wash, borderColor: edge, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      <View style={styles.choiceTop}>
        <View style={[styles.choiceIcon, { backgroundColor: edge }]}>
          <Icon name={icon} size={20} color={tone === 'reward' ? theme.onReward : theme.onAccent} />
        </View>
        {pay ? (
          <View style={[styles.payPill, { backgroundColor: theme.reward }]}>
            <T variant="smallStrong" style={{ color: theme.onReward }}>
              {pay}
            </T>
          </View>
        ) : null}
      </View>
      <T variant="heading">{title}</T>
      <T variant="caption" color="textSecondary">
        {detail}
      </T>
    </Pressable>
  );
}

/** A small tappable pill for secondary actions on the card. */
function Pill({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, { borderColor: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={13} color={theme.accentText} />
      <T variant="caption" color="accentText">
        {label}
      </T>
    </Pressable>
  );
}

const STEPS: { icon: IconName; label: string }[] = [
  { icon: 'mic', label: 'Hold the mic' },
  { icon: 'chat', label: 'Read the line' },
  { icon: 'check', label: 'Let go' },
];

/** How to record, as three numbered steps, plus what this line pays. */
function RecordSteps({ pay, fixed }: { pay: string | null; fixed: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.stepsCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step.label} style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name={step.icon} size={18} color={theme.accentText} />
              <View style={[styles.stepNumber, { backgroundColor: theme.accent }]}>
                <T variant="caption" style={{ color: theme.onAccent, fontSize: 10, lineHeight: 12 }}>
                  {i + 1}
                </T>
              </View>
            </View>
            <T variant="caption" style={styles.center}>
              {step.label}
            </T>
          </View>
        ))}
      </View>
      <View style={[styles.hintRow, { borderTopColor: theme.backgroundSelected }]}>
        <Icon name="trash" size={14} color={theme.textSecondary} />
        <T variant="caption" color="textSecondary" style={styles.flex}>
          Slide up while holding to throw a take away. Quiet spot, phone close.
        </T>
      </View>
      {pay ? (
        <View style={[styles.payBanner, { backgroundColor: theme.rewardSoft }]}>
          <Icon name="sparkles" size={16} color={theme.rewardText} />
          <T variant="smallStrong" color="rewardText" style={styles.flex}>
            This line pays {pay}
            {fixed ? ' (with your fix bonus)' : ''}
          </T>
          <T variant="caption" color="rewardText">
            once checked
          </T>
        </View>
      ) : null}
    </View>
  );
}

export default function RecordScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { user } = useAuth();
  const mic = useRecorder();
  const player = useAudioPlayer();
  const playback = useAudioPlayerStatus(player);

  const [prompts, setPrompts] = useState<SetLine[] | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const [earnedBefore, setEarnedBefore] = useState(0);
  const [skippedIds, setSkippedIds] = useState<number[]>([]);
  const finishedSet = useRef<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [editing, setEditing] = useState(false);
  const [lastAmount, setLastAmount] = useState(0);
  const [index, setIndex] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [saved, setSaved] = useState<SavedLine[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [streak, setStreak] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [replaying, setReplaying] = useState<number | null>(null);
  const loadedUri = useRef<string | null>(null);

  /* ---------- Card animation ---------- */
  const cardX = useSharedValue(0);
  const cardY = useSharedValue(0);
  const cardTilt = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: cardX.value },
      { translateY: cardY.value },
      { rotate: `${cardTilt.value}deg` },
      { scale: cardScale.value },
    ],
  }));

  /** Flicks the card away (right = saved, left = skipped), then brings the next one up from the deck. */
  const nextCard = (direction: 1 | -1) => {
    cardX.value = withTiming(direction * 420, { duration: 280, easing: Easing.in(Easing.quad) });
    cardTilt.value = withTiming(direction * 14, { duration: 280 });
    cardOpacity.value = withTiming(0, { duration: 280 });
    setTimeout(() => {
      setIndex((i) => i + 1);
      cardX.value = 0;
      cardTilt.value = 0;
      cardY.value = 16;
      cardScale.value = 0.94;
      cardOpacity.value = withTiming(1, { duration: 180 });
      cardY.value = withSpring(0, { damping: 14 });
      cardScale.value = withSpring(1, { damping: 14 });
    }, 290);
  };

  /* ---------- Loading lines ---------- */
  const load = useCallback(async (fresh = false) => {
    setError(null);
    setPrompts(null);
    setIndex(0);
    setTake(null);
    setChoices({});
    setEditing(false);
    setSaved([]);
    setSkipped(0);
    setStreak(0);
    try {
      const set = await nextPrompts(fresh);
      const firstOpen = set.prompts.findIndex((p) => !p.done);
      setSetId(set.setId);
      setResumed(set.resumed && firstOpen > 0);
      setEarnedBefore(set.earned);
      setSkippedIds(set.prompts.filter((p) => p.done === 'skipped').map((p) => p.id));
      setTopic(set.topic);
      // Bring back fixes typed before leaving.
      const drafts = Object.fromEntries(
        set.prompts.filter((p) => !p.done && p.draft_fix).map((p) => [p.id, { kind: 'fixed' as const, text: p.draft_fix! }]),
      );
      setChoices(drafts);
      setIndex(firstOpen === -1 ? set.prompts.length : firstOpen);
      setPrompts(set.prompts);
    } catch (e) {
      setError((e as Error).message);
      setPrompts([]);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  /* ---------- Playback ---------- */
  const playUri = (uri: string, fraction = 0) => {
    if (loadedUri.current !== uri) {
      player.replace({ uri });
      loadedUri.current = uri;
    }
    const total = playback.duration || 0;
    player.seekTo(total * fraction);
    player.play();
  };

  const toggleTake = () => {
    if (!take) return;
    if (playback.playing && loadedUri.current === take.uri) player.pause();
    else playUri(take.uri, playback.didJustFinish || loadedUri.current !== take.uri ? 0 : playback.currentTime / (playback.duration || 1));
  };

  const seekTake = (fraction: number) => {
    if (!take) return;
    if (loadedUri.current !== take.uri) playUri(take.uri, 0);
    player.seekTo((playback.duration || take.duration / 1000) * fraction);
    if (!playback.playing) player.play();
  };

  useEffect(() => {
    if (playback.didJustFinish) setReplaying(null);
  }, [playback.didJustFinish]);

  const stopPlayback = () => {
    if (playback.playing) player.pause();
    setReplaying(null);
  };

  /* ---------- Recording ---------- */
  const prompt = prompts?.[index];
  const earned = earnedBefore + saved.reduce((sum, r) => sum + r.amount, 0);
  const recordedBefore = prompts?.filter((p) => p.done === 'recorded').length ?? 0;
  const recordedCount = recordedBefore + saved.length;
  const rate = rates.record;
  const fixRate = rates.record_fix;
  const readPay = rate?.amount_jmd ?? 0;
  const fixedPay = readPay + (fixRate?.amount_jmd ?? 0);
  const choice = prompt ? choices[prompt.id] : undefined;
  const spokenText = choice?.text ?? prompt?.text ?? '';
  const linePay = choice?.kind === 'fixed' ? fixedPay : readPay;

  /* ---------- Checking the AI's line ---------- */
  const acceptLine = () => {
    if (!prompt) return;
    setError(null);
    setChoices((prev) => ({ ...prev, [prompt.id]: { kind: 'as_is', text: prompt.text } }));
  };

  const openFix = () => {
    if (!prompt) return;
    stopPlayback();
    setError(null);
    setTake(null);
    setEditing(true);
  };

  const saveFix = (fixed: string) => {
    if (!prompt) return false;
    setChoices((prev) => {
      const next = { ...prev, [prompt.id]: { kind: 'fixed' as const, text: fixed } };
      if (setId) {
        const fixes = Object.fromEntries(Object.entries(next).filter(([, c]) => c.kind === 'fixed').map(([id, c]) => [id, c.text]));
        saveDraftFixes(setId, fixes).catch(() => {});
      }
      return next;
    });
    return true;
  };

  const undoFix = () => {
    if (!prompt) return;
    stopPlayback();
    setTake(null);
    setChoices((prev) => {
      const next = { ...prev };
      delete next[prompt.id];
      if (setId) {
        const fixes = Object.fromEntries(Object.entries(next).filter(([, c]) => c.kind === 'fixed').map(([id, c]) => [id, c.text]));
        saveDraftFixes(setId, fixes).catch(() => {});
      }
      return next;
    });
  };

  const startRecording = async () => {
    if (!mic.allowed) return setError('Allow microphone access first, then try again.');
    if (!choice) return setError('First tell us if the line sounds right, or fix it.');
    stopPlayback();
    setError(null);
    setTake(null);
    if (!(await mic.start())) setError('The microphone did not start. Please try again.');
  };

  const releaseRecording = async (cancelled: boolean) => {
    if (cancelled) {
      await mic.cancel();
      return;
    }
    const result = await mic.finish();
    if (!result) return setError('Hold the mic button the whole time you read, then let go.');
    if (result.duration < MIN_MS) return setError('That was too short. Hold the mic button while you read the line.');
    if (result.loudest < QUIET_LEVEL) return setError('We could not hear you. Check your microphone and read a little louder.');
    setTake(result);
  };

  useEffect(() => {
    if (mic.recording && mic.durationMillis >= MAX_MS) releaseRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.recording, mic.durationMillis]);

  const submit = async () => {
    if (!take || !prompt || !user) return;
    stopPlayback();
    setSaving(true);
    setError(null);
    try {
      const recording = await saveRecording(user.id, prompt, spokenText, take.uri, take.duration);
      const amount = recording.amount_jmd + recording.fix_amount_jmd;
      setLastAmount(amount);
      setSaved((prev) => [
        ...prev,
        { id: recording.id, text: spokenText, uri: take.uri, duration: take.duration, amount, fixed: recording.fixed },
      ]);
      setStreak((s) => s + 1);
      setBurst((b) => b + 1);
      setTake(null);
      nextCard(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    stopPlayback();
    setTake(null);
    setEditing(false);
    setError(null);
    setSkipped((s) => s + 1);
    setStreak(0);
    if (prompt && setId) {
      const next = [...skippedIds, prompt.id];
      setSkippedIds(next);
      markSkipped(setId, next).catch(() => {});
    }
    nextCard(-1);
  };

  // When the last line is done, close the set so the next visit starts fresh lines.
  useEffect(() => {
    if (prompts && prompts.length && index >= prompts.length && setId && finishedSet.current !== setId) {
      finishedSet.current = setId;
      finishSet(setId).catch(() => {});
    }
  }, [prompts, index, setId]);

  /* ---------- Loading ---------- */
  if (!prompts) {
    return (
      <Screen title="Record lines" header={<Header title="Record lines" />}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
          <T variant="small" color="textSecondary">
            Shuffling your lines...
          </T>
        </View>
      </Screen>
    );
  }

  /* ---------- Finished set / nothing left ---------- */
  if (!prompt) {
    const finished = recordedCount > 0;
    return (
      <Screen
        title="Record lines"
        header={<Header title="Record lines" subtitle={finished ? 'Set complete' : 'All done for now'} />}
        footer={
          <View style={styles.footerGap}>
            {finished || skipped > 0 ? <Button label="Record more lines" icon="mic" onPress={() => load(true)} /> : null}
            <Button label="Back to work" variant={finished ? 'secondary' : 'primary'} onPress={goBack} />
          </View>
        }>
        <Confetti burst={finished ? 1 : 0} />
        {error ? <Notice tone="error" text={error} /> : null}
        <Appear>
          <Card tone="hero" style={styles.recap}>
            <T variant="overline" style={{ color: theme.onAccent }}>
              {finished ? 'Set complete' : 'All caught up'}
            </T>
            <T variant="display" style={{ color: theme.onAccent }}>
              {finished ? `+${money(earned, 0)}` : 'Big up!'}
            </T>
            <T variant="body" style={{ color: theme.onAccent }}>
              {finished
                ? `${recordedCount} ${recordedCount === 1 ? 'line' : 'lines'} recorded. The money lands in your wallet once other speakers check them.`
                : "You've read every line we have right now. New ones are on the way."}
            </T>
          </Card>
        </Appear>

        {saved.length ? (
          <>
            <T variant="heading">Hear yourself</T>
            {saved.map((line, i) => (
              <Appear key={line.id} index={i + 1}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${replaying === line.id && playback.playing ? 'Pause' : 'Play'}: ${line.text}`}
                  onPress={() => {
                    if (replaying === line.id && playback.playing) {
                      player.pause();
                      return;
                    }
                    setReplaying(line.id);
                    playUri(line.uri, 0);
                  }}
                  style={({ pressed }) => [
                    styles.recapRow,
                    { backgroundColor: theme.backgroundElement, borderColor: replaying === line.id ? theme.accent : theme.backgroundSelected, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}>
                  <View style={[styles.recapPlay, { backgroundColor: theme.accent }]}>
                    <Icon name={replaying === line.id && playback.playing ? 'stop' : 'play'} size={16} color={theme.onAccent} />
                  </View>
                  <View style={styles.flex}>
                    <T variant="bodyStrong" numberOfLines={2}>
                      {line.text}
                    </T>
                    <T variant="caption" color="textSecondary">
                      {clock(line.duration)} · {line.fixed ? 'you fixed it · ' : ''}waiting for review
                    </T>
                  </View>
                  <T variant="smallStrong" color="rewardText">
                    +{money(line.amount, 0)}
                  </T>
                </Pressable>
              </Appear>
            ))}
          </>
        ) : null}
      </Screen>
    );
  }

  /* ---------- Recording a line ---------- */
  const activeWord = mic.recording ? Math.floor(mic.durationMillis / MS_PER_WORD) : null;
  const progress = playback.duration ? Math.min(1, playback.currentTime / playback.duration) : 0;
  const takeLoaded = !!take && loadedUri.current === take.uri;
  const deck = prompts.slice(index + 1, index + 3);

  const status = mic.recording
    ? `Recording ${clock(mic.durationMillis)} · let go to finish`
    : mic.phase === 'starting'
      ? 'Starting the mic...'
      : 'Hold to record';

  return (
    <Screen
      title="Record lines"
      header={
        <Header
          title="Record lines"
          subtitle={rate ? `${money(readPay, 0)} a line · ${money(fixedPay, 0)} if fixed` : `Line ${index + 1} of ${prompts.length}`}
          right={<Chip label={`${money(earned, 0)} so far`} />}
        />
      }
      footer={
        !choice ? (
          <Button label="Skip this line" icon="chevron" variant="ghost" compact onPress={skip} />
        ) : take && !mic.recording ? (
          <View style={styles.takeRow}>
            <Button label="Redo" icon="mic" variant="secondary" compact disabled={saving} onPress={() => { stopPlayback(); setTake(null); }} />
            <Button
              label={saving ? 'Saving...' : rate ? `Save · +${money(linePay, 0)}` : 'Save line'}
              icon="check"
              style={styles.flex}
              disabled={saving}
              onPress={submit}
            />
          </View>
        ) : (
          <View style={styles.micRow}>
            <View style={styles.side} />
            <View style={styles.micColumn}>
              <HoldToRecord
                disabled={mic.allowed === false || saving}
                busy={mic.busy}
                recording={mic.recording}
                level={mic.level}
                onStart={startRecording}
                onRelease={releaseRecording}
              />
              <T variant="smallStrong" accessibilityLiveRegion="polite">
                {status}
              </T>
            </View>
            <View style={styles.side}>
              {!mic.recording ? <Button label="Skip" variant="ghost" compact onPress={skip} accessibilityLabel="Skip this line" /> : null}
            </View>
          </View>
        )
      }>
      {/* Progress, streak and the floating reward */}
      <View style={styles.progressBlock}>
        <View style={styles.progressTop}>
          <T variant="smallStrong">
            Line {index + 1} <T variant="small" color="textSecondary">of {prompts.length}</T>
          </T>
          {streak >= 2 ? <Chip tone="reward" icon="flame" label={`${streak} in a row`} /> : null}
        </View>
        <View style={styles.progress} accessibilityLabel={`Line ${index + 1} of ${prompts.length}`}>
          {prompts.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    i === index
                      ? theme.reward
                      : skippedIds.includes(p.id)
                        ? theme.textSecondary
                        : i < index
                          ? theme.accent
                          : theme.backgroundSelected,
                  opacity: skippedIds.includes(p.id) && i !== index ? 0.35 : 1,
                },
              ]}
            />
          ))}
        </View>
        <FloatUp trigger={burst} label={lastAmount ? `+${money(lastAmount, 0)}` : 'Saved!'} />
      </View>

      {resumed && !saved.length && !skipped ? (
        <Appear style={[styles.resume, { backgroundColor: theme.accentSoft }]}>
          <Icon name="play" size={16} color={theme.accentText} />
          <T variant="small" color="accentText" style={styles.flex}>
            Picked up where you left off: {recordedBefore} {recordedBefore === 1 ? 'line' : 'lines'} already done
            {earnedBefore ? ` (+${money(earnedBefore, 0)})` : ''}.
          </T>
          <Pressable accessibilityRole="button" onPress={() => load(true)} hitSlop={8}>
            <T variant="caption" color="accentText" style={styles.underline}>
              New lines
            </T>
          </Pressable>
        </Appear>
      ) : null}

      {mic.allowed === false ? (
        <Notice tone="error" text="Real Talk Yaad needs your microphone. Allow it in your phone or browser settings, then come back." />
      ) : null}
      {error ? <Notice tone="error" text={error} /> : null}

      {/* The card deck: the current line on top, the next ones peeking out behind it */}
      <View style={styles.deck}>
        {deck
          .map((next, i) => (
            <View
              key={next.id}
              pointerEvents="none"
              style={[
                styles.deckCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                  transform: [{ translateY: 10 * (i + 1) }, { scale: 1 - 0.04 * (i + 1) }],
                  opacity: 0.7 - i * 0.25,
                },
              ]}
            />
          ))
          .reverse()}
        <Animated.View style={cardStyle}>
          <Card style={[styles.card, mic.recording && { borderColor: theme.reward, borderWidth: 2 }]}>
            <View style={styles.cardTop}>
              <IconTile icon={mic.recording ? 'waveform' : 'chat'} tone={mic.recording ? 'reward' : 'accent'} size={36} />
              <T variant="overline" color={mic.recording ? 'rewardText' : 'accentText'} style={styles.flex}>
                {mic.recording
                  ? 'Reading along...'
                  : take
                    ? 'Got it!'
                    : editing
                      ? 'Fix the line'
                      : choice
                        ? 'Read this out loud'
                        : 'Does this sound right?'}
              </T>
              {take ? <Icon name="check" color={theme.accentText} /> : topic && !mic.recording ? <Chip tone="soft" label={topic} /> : null}
            </View>
            {(
              <>
                <ReadAlong text={spokenText} activeWord={activeWord} />
                {choice?.kind === 'fixed' ? (
                  <View style={[styles.originalBox, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
                    <View style={styles.row}>
                      <Icon name="sparkles" size={14} color={theme.textSecondary} />
                      <T variant="overline" color="textSecondary" style={styles.flex}>
                        What you changed
                      </T>
                      <Chip tone="reward" icon="edit" label="Your fix" />
                    </View>
                    <DiffText original={prompt.text} fixed={choice.text} size="small" />
                    {!mic.recording && !take ? (
                      <View style={styles.row}>
                        <Pill label="Edit fix" icon="edit" onPress={openFix} />
                        <Pill label="Undo" icon="back" onPress={undoFix} />
                      </View>
                    ) : null}
                  </View>
                ) : choice && !mic.recording && !take ? (
                  <View style={styles.row}>
                    <Chip tone="soft" icon="check" label="Sounds right" />
                    <Pill label="Fix it instead" icon="edit" onPress={openFix} />
                  </View>
                ) : null}
              </>
            )}
          </Card>
        </Animated.View>
        <Confetti burst={burst} />
      </View>

      {mic.recording ? (
        <Appear style={[styles.recordingCard, { backgroundColor: theme.backgroundElement, borderColor: theme.reward }]}>
          <View style={styles.row}>
            <View style={[styles.liveDot, { backgroundColor: theme.danger }]} />
            <T variant="smallStrong">Recording · {clock(mic.durationMillis)}</T>
          </View>
          <LevelMeter levels={mic.levels} color={theme.reward} />
          <T variant="caption" color="textSecondary">
            {mic.level > QUIET_LEVEL ? 'We hear you. Let go when you finish.' : 'Go ahead, read the line...'}
          </T>
        </Appear>
      ) : null}

      {take && !mic.recording ? (
        <Appear style={styles.takeBlock}>
          <T variant="smallStrong">Your take</T>
          <TakeWaveform
            waveform={take.waveform}
            durationMs={take.duration}
            progress={takeLoaded ? progress : 0}
            playing={takeLoaded && playback.playing}
            onToggle={toggleTake}
            onSeek={seekTake}
          />
          <T variant="caption" color="textSecondary">
            Tap play to hear it, or tap the waveform to jump around. Happy with it? Save it.
          </T>
        </Appear>
      ) : !choice ? (
        <Appear style={styles.choiceBlock}>
          <View style={styles.row}>
            <IconTile icon="sparkles" size={28} />
            <T variant="smallStrong" style={styles.flex}>
              The AI wrote this. Is it real Patois?
            </T>
          </View>
          <View style={styles.choices}>
            <ChoiceTile
              icon="check"
              title="Sounds right"
              detail="Read it just as written"
              pay={rate ? money(readPay, 0) : null}
              tone="accent"
              onPress={acceptLine}
            />
            <ChoiceTile
              icon="edit"
              title="Fix it"
              detail="Type it how yuh would seh it"
              pay={rate ? money(fixedPay, 0) : null}
              tone="reward"
              onPress={openFix}
            />
          </View>
        </Appear>
      ) : !mic.recording ? (
        <Appear>
          <RecordSteps pay={rate ? money(linePay, 0) : null} fixed={choice.kind === 'fixed'} />
        </Appear>
      ) : null}
      <FixSheet
        visible={editing}
        title="Fix the AI's line"
        label="How you would really say it"
        original={prompt.text}
        initial={choice?.kind === 'fixed' ? choice.text : undefined}
        hint="Fix the spelling or words. Keep the same meaning, then you'll record it."
        submitLabel={fixRate ? `Use my fix · ${money(fixedPay, 0)} line` : 'Use my fix'}
        validate={fixProblem}
        onSubmit={saveFix}
        onClose={() => setEditing(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  progressBlock: { gap: 8 },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  progress: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  deck: { paddingBottom: 20 },
  deckCard: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 20, borderRadius: 22, borderWidth: 1 },
  card: { gap: 14, padding: 22, minHeight: 170 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordingCard: { gap: 8, padding: 16, borderRadius: 20, borderWidth: 2, alignItems: 'center' },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  takeBlock: { gap: 8 },
  micRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 84, alignItems: 'center' },
  micColumn: { alignItems: 'center', gap: 6 },
  takeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fixBox: { gap: 10 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16 },
  underline: { textDecorationLine: 'underline' },
  center: { textAlign: 'center' },
  struck: { textDecorationLine: 'line-through' },
  originalBox: { gap: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  choiceBlock: { gap: 12 },
  choices: { flexDirection: 'row', gap: 12 },
  choice: { flex: 1, gap: 6, padding: 16, borderRadius: 20, borderWidth: 2, minHeight: 150 },
  choiceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  choiceIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  stepsCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  payBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14 },
  footerGap: { gap: 10 },
  recap: { gap: 6, padding: 22 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5 },
  recapPlay: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
