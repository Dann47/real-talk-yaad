import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { AiBadge, MessageRow } from '@/components/chat-bubbles';
import { HoldToRecord } from '@/components/hold-to-record';
import { Appear, Button, Card, Chip, Header, Icon, IconButton, Notice, Screen, T, goBack, inputText } from '@/components/kit';
import { LevelMeter } from '@/components/level-meter';
import { TopicPicker } from '@/components/topic-picker';
import { TypingDots } from '@/components/typing-dots';
import { money } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/lib/chat';
import { perUnitLabel, useRates } from '@/lib/rates';
import { useChat } from '@/lib/use-chat';
import { QUIET_LEVEL, clock, useRecorder } from '@/lib/use-recorder';

const MIN_RECORDING_MS = 700;
const MAX_RECORDING_MS = 60_000;
const MAX_LENGTH = 1000;

export default function VoiceScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { topic: topicParam, conversation: resumeId } = useLocalSearchParams<{ topic?: string; conversation?: string }>();
  const chat = useChat('voice');
  const mic = useRecorder();

  const [picking, setPicking] = useState(!resumeId && !topicParam);
  const [muted, setMuted] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [target, setTarget] = useState<ChatMessage | null>(null);
  const [draft, setDraft] = useState('');

  /* ---------- The AI's voice ---------- */
  const speak = useCallback(
    (message: ChatMessage | null, force = false) => {
      if (!message || (muted && !force)) return;
      Speech.stop();
      setSpeakingId(message.id);
      Speech.speak(message.content, {
        language: 'en-US',
        rate: 0.95,
        onDone: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    },
    [muted],
  );

  useEffect(() => () => void Speech.stop(), []);

  const { begin, resume } = chat;
  useEffect(() => {
    if (resumeId) resume(resumeId);
    else if (topicParam) begin(topicParam).then((opening) => speak(opening));
    // speak is left out on purpose: muting later must not restart the chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begin, resume, resumeId, topicParam]);

  const pickTopic = async (topicId?: string) => {
    setPicking(false);
    setTarget(null);
    speak(await begin(topicId));
  };

  const newTopic = () => {
    Speech.stop();
    chat.clear();
    setTarget(null);
    setDraft('');
    setPicking(true);
    if (resumeId || topicParam) router.setParams({ conversation: undefined, topic: undefined } as never);
  };

  /* ---------- Hold to record ---------- */
  const startRecording = async () => {
    if (!mic.allowed) {
      chat.setError('Allow microphone access first, then try again.');
      return;
    }
    Speech.stop();
    chat.setError(null);
    if (!(await mic.start())) chat.setError('The microphone did not start. Please try again.');
  };

  const releaseRecording = async (cancelled: boolean) => {
    if (cancelled) {
      await mic.cancel();
      return;
    }
    const take = await mic.finish();
    if (!take) {
      chat.setError('Hold the mic button the whole time you talk, then let go to send.');
      return;
    }
    if (take.duration < MIN_RECORDING_MS) {
      chat.setError('That was too short. Hold the mic button while you talk.');
      return;
    }
    if (take.loudest < QUIET_LEVEL) {
      chat.setError('We could not hear you. Check your microphone and speak a little louder.');
      return;
    }
    speak(await chat.sendVoice(take.uri));
  };

  // Send automatically at the time limit.
  useEffect(() => {
    if (mic.recording && mic.durationMillis >= MAX_RECORDING_MS) releaseRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.recording, mic.durationMillis]);

  /* ---------- Corrections ---------- */
  const choose = (message: ChatMessage) => {
    if (target?.id === message.id) {
      setTarget(null);
      return;
    }
    Speech.stop();
    setTarget(message);
    // Fixing what we heard: start from our words so they only change what is wrong.
    if (message.role === 'user' && !draft.trim()) setDraft(message.content);
  };

  const submitCorrection = async () => {
    const text = draft.trim();
    if (!target || !text) return;
    if (await chat.correct(target, text)) {
      setTarget(null);
      setDraft('');
    }
  };

  if (picking) {
    return (
      <Screen title="Voice chat" header={<Header title="Voice chat" subtitle="Choose a topic" />}>
        <TopicPicker onPick={pickTopic} />
      </Screen>
    );
  }

  const { conversation, loading, waiting, error } = chat;
  const rateLine = perUnitLabel(rates.voice);
  const fixingTranscript = target?.role === 'user';
  const tooQuiet = mic.recording && mic.durationMillis > 2000 && mic.loudest < QUIET_LEVEL;

  const status = mic.recording
    ? `Recording ${clock(mic.durationMillis)} · let go to send`
    : mic.phase === 'starting'
      ? 'Starting the mic...'
      : chat.voiceStage === 'uploading'
        ? 'Sending your voice...'
        : chat.voiceStage === 'thinking'
          ? 'Hearing you and thinking...'
          : waiting
            ? 'Working on it...'
            : speakingId !== null
              ? 'AI is talking. Hold to answer.'
              : 'Hold to talk';

  return (
    <Screen
      stickToBottom
      title={conversation ? `${conversation.topic.title} · Voice` : 'Voice chat'}
      header={
        <Header
          title={conversation?.topic.title ?? 'Voice chat'}
          subtitle={loading ? 'Getting ready...' : mic.recording ? 'Recording...' : speakingId !== null ? 'Talking...' : 'Speak Patois'}
          right={
            <View style={styles.row}>
              <Chip label={`${money(chat.earned, 0)} so far`} />
              <IconButton icon="plus" label="New topic" onPress={newTopic} />
            </View>
          }
        />
      }
      footer={
        target ? (
          <View style={styles.footer}>
            <View style={[styles.quote, { backgroundColor: theme.accentSoft, borderLeftColor: theme.accent }]}>
              <View style={styles.flex}>
                <T variant="caption" color="accentText">
                  {fixingTranscript ? 'Fix what we heard you say' : 'Correcting the AI'}
                </T>
                <T variant="small" numberOfLines={2}>
                  {target.content}
                </T>
              </View>
              <IconButton icon="back" label="Stop correcting" size={36} onPress={() => setTarget(null)} />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel={fixingTranscript ? 'What you really said' : 'Your correction'}
                value={draft}
                onChangeText={setDraft}
                autoFocus
                multiline
                maxLength={MAX_LENGTH}
                placeholder={fixingTranscript ? 'Type exactly what you said' : 'How would a Jamaican say it?'}
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, inputText, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}
              />
              <IconButton icon="check" label="Save correction" filled onPress={submitCorrection} />
            </View>
          </View>
        ) : (
          <View style={styles.controls}>
            <IconButton
              icon={muted ? 'muted' : 'speaker'}
              label={muted ? 'Turn AI voice on' : 'Turn AI voice off'}
              size={52}
              onPress={() => {
                if (!muted) Speech.stop();
                setMuted(!muted);
              }}
            />
            <View style={styles.micColumn}>
              <HoldToRecord
                disabled={!conversation || loading || waiting || mic.allowed === false}
                busy={waiting || mic.busy}
                recording={mic.recording}
                level={mic.level}
                onStart={startRecording}
                onRelease={releaseRecording}
              />
              <T variant="smallStrong" accessibilityLiveRegion="polite">
                {status}
              </T>
            </View>
            <Button label="End" variant="secondary" compact onPress={goBack} />
          </View>
        )
      }>
      {mic.allowed === false ? (
        <Notice
          tone="error"
          text="Real Talk Yaad needs your microphone for voice chat. Allow it in your phone or browser settings, then come back."
        />
      ) : null}

      {conversation ? (
        <Appear>
          <Card tone="soft" style={styles.topicCard}>
            <T variant="overline" color="accentText">
              Topic
            </T>
            <T variant="heading">{conversation.topic.title}</T>
            <T variant="small" color="textSecondary">
              {conversation.topic.guidance}
            </T>
            <View style={[styles.tip, { borderTopColor: theme.backgroundSelected }]}>
              <Icon name="sparkles" size={14} color={theme.accentText} />
              <T variant="caption" color="textSecondary" style={styles.flex}>
                Hold the mic while you talk and let go to send. Slide up to delete. If we heard you wrong, tap Fix the
                words. If the AI sounds off, tap Correct.
                {rateLine ? ` You earn ${rateLine} once other speakers agree.` : ''}
              </T>
            </View>
          </Card>
        </Appear>
      ) : null}

      {error ? (
        <Appear style={styles.errorBlock}>
          <Notice tone="error" text={error} />
          {!conversation ? (
            <View style={styles.row}>
              <Button label="Try again" variant="secondary" compact onPress={() => (resumeId ? resume(resumeId) : pickTopic(topicParam))} />
              <Button label="Pick a topic" variant="ghost" compact onPress={newTopic} />
            </View>
          ) : null}
        </Appear>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
          <T variant="small" color="textSecondary">
            {resumeId ? 'Loading your chat...' : 'Starting a conversation...'}
          </T>
        </View>
      ) : null}

      {chat.messages.map((message) => (
        <Appear key={message.id}>
          <MessageRow
            message={message}
            correction={chat.corrections[message.id]}
            selected={target?.id === message.id}
            canCorrect={!chat.corrections[message.id] && !waiting && (message.role === 'assistant' || !!message.audio_path)}
            onCorrect={() => choose(message)}
            onReplay={message.role === 'assistant' ? () => speak(message, true) : undefined}
          />
        </Appear>
      ))}

      {mic.recording ? (
        <Appear style={[styles.recordingCard, { backgroundColor: theme.backgroundElement, borderColor: theme.reward }]}>
          <View style={styles.row}>
            <View style={[styles.liveDot, { backgroundColor: theme.danger }]} />
            <T variant="smallStrong">Recording · {clock(mic.durationMillis)}</T>
          </View>
          <LevelMeter levels={mic.levels} color={theme.reward} />
          <T variant="caption" color={tooQuiet ? 'danger' : 'textSecondary'} accessibilityLiveRegion="polite">
            {tooQuiet
              ? "We can't hear you yet. Speak up or check your microphone."
              : mic.level > QUIET_LEVEL
                ? 'We hear you. Let go when you finish.'
                : 'Go ahead, talk...'}
          </T>
        </Appear>
      ) : null}

      {waiting && !target ? (
        <Appear style={styles.aiRow}>
          <AiBadge />
          <TypingDots />
        </Appear>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicCard: { gap: 4 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  errorBlock: { gap: 10 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  micColumn: { alignItems: 'center', gap: 6 },
  recordingCard: { gap: 8, padding: 16, borderRadius: 20, borderWidth: 2, alignItems: 'center' },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  footer: { gap: 10 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 12, paddingRight: 6, borderRadius: 14, borderLeftWidth: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13 },
});
