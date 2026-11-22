import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AiBadge, MessageRow } from '@/components/chat-bubbles';
import { FixSheet } from '@/components/fix-editor';
import { HoldToRecord } from '@/components/hold-to-record';
import { Appear, Button, Card, Chip, Header, Icon, IconButton, Notice, Screen, T, goBack, inputText } from '@/components/kit';
import { LevelMeter } from '@/components/level-meter';
import { TopicPicker } from '@/components/topic-picker';
import { TypingDots } from '@/components/typing-dots';
import { money } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/lib/chat';
import { perUnitLabel, useRates } from '@/lib/rates';
import { supabase } from '@/lib/supabase';
import { useChat } from '@/lib/use-chat';
import { QUIET_LEVEL, clock, useRecorder } from '@/lib/use-recorder';

const MIN_RECORDING_MS = 700;
const MAX_RECORDING_MS = 60_000;
const MAX_LENGTH = 1000;

/** What you said just before the reply you're fixing. */
function PreviousTurn({ messages, before }: { messages: ChatMessage[]; before: ChatMessage }) {
  const theme = useTheme();
  const at = messages.findIndex((m) => m.id === before.id);
  const said = [...messages.slice(0, Math.max(0, at))].reverse().find((m) => m.role === 'user');
  if (!said) return null;
  return (
    <View style={[styles.said, { backgroundColor: theme.accentSoft }]}>
      <T variant="caption" color="accentText">
        You said
      </T>
      <T variant="small" numberOfLines={3}>
        {said.content}
      </T>
    </View>
  );
}

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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ended, setEnded] = useState<{ topic: string; earned: number; fixes: number } | null>(null);

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

  /* ---------- Your own recordings ---------- */
  const player = useAudioPlayer();
  const playback = useAudioPlayerStatus(player);
  const [playingMine, setPlayingMine] = useState<number | null>(null);
  const audioLinks = useRef(new Map<string, string>());

  const stopMine = useCallback(() => {
    if (playback.playing) player.pause();
    setPlayingMine(null);
  }, [player, playback.playing]);

  const playMine = async (message: ChatMessage) => {
    const path = message.audio_path;
    if (!path) return;
    if (playingMine === message.id) return stopMine();
    Speech.stop();
    let url = audioLinks.current.get(path);
    if (!url) {
      const { data, error } = await supabase.storage.from('voice').createSignedUrl(path, 60 * 60);
      if (error || !data) return chat.setError('We could not play that recording. Please try again.');
      url = data.signedUrl;
      audioLinks.current.set(path, url);
    }
    player.replace({ uri: url });
    player.seekTo(0);
    player.play();
    setPlayingMine(message.id);
  };

  useEffect(() => {
    if (playback.didJustFinish) setPlayingMine(null);
  }, [playback.didJustFinish]);

  const { begin, resume } = chat;
  useEffect(() => {
    if (resumeId) resume(resumeId);
    else if (topicParam) begin(topicParam).then((opening) => speak(opening));
    // speak is left out on purpose: muting later must not restart the chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begin, resume, resumeId, topicParam]);

  const pickTopic = async (topicId?: string) => {
    setEnded(null);
    setPicking(false);
    setTarget(null);
    speak(await begin(topicId));
  };

  const newTopic = () => {
    Speech.stop();
    chat.clear();
    setTarget(null);
    stopMine();
    setPicking(true);
    if (resumeId || topicParam) router.setParams({ conversation: undefined, topic: undefined } as never);
  };

  /* ---------- Hold to record ---------- */
  const startRecording = async () => {
    stopMine();
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
  };

  const endChat = async () => {
    const topic = chat.conversation?.topic.title ?? 'Your chat';
    const fixes = Object.keys(chat.corrections).length;
    const earned = chat.earned;
    if (!(await chat.end())) return;
    setConfirmEnd(false);
    newTopic();
    setEnded({ topic, earned, fixes });
  };

  if (picking) {
    return (
      <Screen title="Voice chat" header={<Header title="Voice chat" subtitle="Choose a topic" />}>
        {ended ? (
          <Appear>
            <Card tone="soft" style={styles.endedCard}>
              <View style={[styles.endedIcon, { backgroundColor: theme.accent }]}>
                <Icon name="check" size={18} color={theme.onAccent} />
              </View>
              <View style={styles.flex}>
                <T variant="bodyStrong">Chat ended: {ended.topic}</T>
                <T variant="caption" color="textSecondary">
                  {ended.fixes
                    ? `${ended.fixes} ${ended.fixes === 1 ? 'fix' : 'fixes'} · ${money(ended.earned, 0)} once other speakers agree`
                    : 'No fixes this time. Pick a new topic below.'}
                </T>
              </View>
            </Card>
          </Appear>
        ) : null}
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
          subtitle={
            loading
              ? 'Getting ready...'
              : mic.recording
                ? 'Recording...'
                : speakingId !== null
                  ? 'Talking...'
                  : chat.earned
                    ? `${money(chat.earned, 0)} earned in this chat`
                    : 'Speak Patois'
          }
          right={
            <View style={styles.row}>
              {conversation && !loading ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="End this voice chat"
                  onPress={() => {
                    Speech.stop();
                    stopMine();
                    setConfirmEnd(true);
                  }}
                  hitSlop={6}
                  style={({ pressed }) => [styles.endPill, { borderColor: theme.danger, opacity: pressed ? 0.6 : 1 }]}>
                  <Icon name="stop" size={12} color={theme.danger} />
                  <T variant="caption" style={{ color: theme.danger }}>
                    End
                  </T>
                </Pressable>
              ) : (
                <IconButton icon="plus" label="New topic" onPress={newTopic} />
              )}
            </View>
          }
        />
      }
      footer={
        confirmEnd ? (
          <Appear style={styles.footer}>
            <View style={styles.row}>
              <Icon name="stop" size={16} color={theme.danger} />
              <T variant="bodyStrong" style={styles.flex}>
                End this voice chat?
              </T>
            </View>
            <T variant="small" color="textSecondary">
              {Object.keys(chat.corrections).length
                ? 'Your fixes stay saved and still pay once other speakers agree.'
                : "You haven't fixed anything in this chat yet. You can start a new topic after."}
            </T>
            <View style={styles.row}>
              <Button label="Keep talking" variant="secondary" style={styles.flex} disabled={waiting} onPress={() => setConfirmEnd(false)} />
              <Button label={waiting ? 'Ending...' : 'End chat'} icon="check" style={styles.flex} disabled={waiting} onPress={endChat} />
            </View>
          </Appear>
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
            onReplay={message.role === 'assistant' ? () => { stopMine(); speak(message, true); } : undefined}
            onPlayMine={message.role === 'user' && message.audio_path ? () => playMine(message) : undefined}
            playingMine={playingMine === message.id}
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
      <FixSheet
        visible={!!target}
        title={fixingTranscript ? 'Fix what we heard' : "Fix the AI's reply"}
        label={fixingTranscript ? 'What you really said' : 'How a Jamaican would say it'}
        original={target?.content ?? ''}
        hint={
          fixingTranscript
            ? 'Play your clip and fix only the words we got wrong.'
            : 'Keep what the AI got right. Only change what sounds wrong.'
        }
        submitLabel={rates.voice ? `Send fix · +${money(rates.voice.amount_jmd, 0)}` : 'Send fix'}
        context={
          target && fixingTranscript && target.audio_path ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playingMine === target.id ? 'Stop your recording' : 'Play your recording'}
              onPress={() => playMine(target)}
              style={({ pressed }) => [styles.clip, { backgroundColor: theme.accentSoft, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.clipButton, { backgroundColor: theme.accent }]}>
                <Icon name={playingMine === target.id ? 'stop' : 'play'} size={18} color={theme.onAccent} />
              </View>
              <View style={styles.flex}>
                <T variant="smallStrong" color="accentText">
                  {playingMine === target.id ? 'Playing your clip...' : 'Play your clip'}
                </T>
                <T variant="caption" color="accentText">
                  Listen, then fix the words below
                </T>
              </View>
              <Icon name="headphones" size={18} color={theme.accentText} />
            </Pressable>
          ) : target && !fixingTranscript ? (
            <PreviousTurn messages={chat.messages} before={target} />
          ) : null
        }
        onSubmit={(fixed) => (target ? chat.correct(target, fixed) : false)}
        onClose={() => {
          stopMine();
          setTarget(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  said: { gap: 2, padding: 12, borderRadius: 14 },
  clip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  clipButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  endPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5 },
  endedCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endedIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
