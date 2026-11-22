import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AiBadge, MessageRow } from '@/components/chat-bubbles';
import { FixSheet } from '@/components/fix-editor';
import { Appear, Button, Card, Chip, Header, Icon, IconButton, Notice, Screen, T, inputText } from '@/components/kit';
import { TopicPicker } from '@/components/topic-picker';
import { TypingDots } from '@/components/typing-dots';
import { StoreNudge } from '@/components/store-nudge';
import { NextUp } from '@/components/next-up';
import { money } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/lib/chat';
import { perUnitLabel, useRates } from '@/lib/rates';
import { useChat } from '@/lib/use-chat';

const MAX_LENGTH = 1000;

/** What you said just before the reply you're fixing, so the fix has context. */
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

export default function TalkScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { topic: topicParam, conversation: resumeId } = useLocalSearchParams<{ topic?: string; conversation?: string }>();
  const chat = useChat('text');

  const [picking, setPicking] = useState(!resumeId && !topicParam);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState<ChatMessage | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ended, setEnded] = useState<{ topic: string; earned: number; fixes: number } | null>(null);

  const { begin, resume } = chat;
  useEffect(() => {
    if (resumeId) resume(resumeId);
    else if (topicParam) begin(topicParam);
  }, [begin, resume, resumeId, topicParam]);

  const pickTopic = (topicId?: string) => {
    setEnded(null);
    setPicking(false);
    setTarget(null);
    begin(topicId);
  };

  const newTopic = () => {
    chat.clear();
    setTarget(null);
    setDraft('');
    setPicking(true);
    if (resumeId || topicParam) router.setParams({ conversation: undefined, topic: undefined } as never);
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

  const text = draft.trim();

  const submit = async () => {
    if (!text || !chat.conversation || chat.waiting) return;
    setDraft('');
    const reply = await chat.sendText(text);
    if (!reply) setDraft(text); // keep their words if sending failed
  };

  if (picking) {
    return (
      <Screen title="Talk with the AI" header={<Header title="Talk with the AI" subtitle="Choose a topic" />}>
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
        {ended ? <NextUp after="talk" index={1} /> : null}
        {ended ? <StoreNudge index={2} compact /> : null}
        {ended ? <T variant="heading">Or chat again</T> : null}
        <TopicPicker onPick={pickTopic} />
      </Screen>
    );
  }

  const { conversation, loading, waiting, error } = chat;
  const rateLine = perUnitLabel(rates.talk);

  return (
    <Screen
      stickToBottom
      title={conversation ? `${conversation.topic.title} · Talk` : 'Talk with the AI'}
      header={
        <Header
          title={conversation?.topic.title ?? 'Talk with the AI'}
          subtitle={
            loading ? 'Getting ready...' : waiting ? 'Typing...' : chat.earned ? `${money(chat.earned, 0)} earned in this chat` : 'Chatting in Patois'
          }
          right={
            <View style={styles.row}>
              {conversation && !loading ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="End this chat"
                  onPress={() => setConfirmEnd(true)}
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
                End this chat?
              </T>
            </View>
            <T variant="small" color="textSecondary">
              {Object.keys(chat.corrections).length
                ? `Your ${Object.keys(chat.corrections).length === 1 ? 'fix stays' : 'fixes stay'} saved and still ${Object.keys(chat.corrections).length === 1 ? 'pays' : 'pay'} once other speakers agree.`
                : "You haven't fixed anything in this chat yet. You can still start a new topic after."}
            </T>
            <View style={styles.row}>
              <Button label="Keep chatting" variant="secondary" style={styles.flex} disabled={waiting} onPress={() => setConfirmEnd(false)} />
              <Button label={waiting ? 'Ending...' : 'End chat'} icon="check" style={styles.flex} disabled={waiting} onPress={endChat} />
            </View>
          </Appear>
        ) : (
        <View style={styles.footer}>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="Message"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              editable={!loading && !!conversation}
              placeholder="Type in Patois..."
              placeholderTextColor={theme.textSecondary}
              returnKeyType="send"
              multiline
              maxLength={MAX_LENGTH}
              style={[
                styles.input,
                inputText,
                { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !text || waiting }}
              disabled={!text || waiting}
              onPress={submit}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: text && !waiting ? theme.accent : theme.backgroundSelected, transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}>
              {waiting ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Icon name="send" size={20} color={text ? theme.onAccent : theme.textSecondary} />
              )}
            </Pressable>
          </View>
          {draft.length > MAX_LENGTH - 200 ? (
            <T variant="caption" color="textSecondary" style={styles.counter}>
              {draft.length} / {MAX_LENGTH}
            </T>
          ) : null}
        </View>
        )
      }>
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
                If the AI says something that doesn't sound Jamaican, tap "Correct this" under it.
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
              <Button label="Try again" variant="secondary" compact onPress={() => (resumeId ? resume(resumeId) : begin(topicParam))} />
              <Button label="Pick a topic" variant="ghost" compact onPress={newTopic} />
            </View>
          ) : null}
        </Appear>
      ) : null}

      {loading ? (
        <View style={styles.loading} accessibilityLabel={resumeId ? 'Loading your chat' : 'Starting a conversation'}>
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
            canCorrect={message.role === 'assistant' && !chat.corrections[message.id] && !waiting}
            onCorrect={() => setTarget(target?.id === message.id ? null : message)}
          />
        </Appear>
      ))}

      {waiting && !target ? (
        <Appear style={styles.aiRow}>
          <AiBadge />
          <TypingDots />
        </Appear>
      ) : null}
      <FixSheet
        visible={!!target}
        title="Fix the AI's reply"
        label="How a Jamaican would say it"
        original={target?.content ?? ''}
        submitLabel={rates.talk ? `Send fix · +${money(rates.talk.amount_jmd, 0)}` : 'Send fix'}
        context={
          target ? (
            <PreviousTurn messages={chat.messages} before={target} />
          ) : null
        }
        onSubmit={(fixed) => (target ? chat.correct(target, fixed) : false)}
        onClose={() => setTarget(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  said: { gap: 2, padding: 12, borderRadius: 14 },
  endPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5 },
  endedCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endedIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topicCard: { gap: 4 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  errorBlock: { gap: 10 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  footer: { gap: 10 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 12, paddingRight: 6, borderRadius: 14, borderLeftWidth: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  counter: { alignSelf: 'flex-end' },
});
