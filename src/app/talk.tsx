import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AiBadge, MessageRow } from '@/components/chat-bubbles';
import { Appear, Button, Card, Chip, Header, Icon, IconButton, Notice, Screen, T, inputText } from '@/components/kit';
import { TopicPicker } from '@/components/topic-picker';
import { TypingDots } from '@/components/typing-dots';
import { money } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/lib/chat';
import { perUnitLabel, useRates } from '@/lib/rates';
import { useChat } from '@/lib/use-chat';

const MAX_LENGTH = 1000;

export default function TalkScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { topic: topicParam, conversation: resumeId } = useLocalSearchParams<{ topic?: string; conversation?: string }>();
  const chat = useChat('text');

  const [picking, setPicking] = useState(!resumeId && !topicParam);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState<ChatMessage | null>(null);

  const { begin, resume } = chat;
  useEffect(() => {
    if (resumeId) resume(resumeId);
    else if (topicParam) begin(topicParam);
  }, [begin, resume, resumeId, topicParam]);

  const pickTopic = (topicId?: string) => {
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

  const text = draft.trim();

  const submit = async () => {
    if (!text || !chat.conversation || chat.waiting) return;
    if (target) {
      if (await chat.correct(target, text)) {
        setDraft('');
        setTarget(null);
      }
      return;
    }
    setDraft('');
    const reply = await chat.sendText(text);
    if (!reply) setDraft(text); // keep their words if sending failed
  };

  if (picking) {
    return (
      <Screen title="Talk with the AI" header={<Header title="Talk with the AI" subtitle="Choose a topic" />}>
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
          subtitle={loading ? 'Getting ready...' : waiting && !target ? 'Typing...' : 'Chatting in Patois'}
          right={
            <View style={styles.row}>
              <Chip label={`${money(chat.earned, 0)} so far`} />
              <IconButton icon="plus" label="New topic" onPress={newTopic} />
            </View>
          }
        />
      }
      footer={
        <View style={styles.footer}>
          {target ? (
            <View style={[styles.quote, { backgroundColor: theme.accentSoft, borderLeftColor: theme.accent }]}>
              <View style={styles.flex}>
                <T variant="caption" color="accentText">
                  Correcting the AI
                </T>
                <T variant="small" numberOfLines={2}>
                  {target.content}
                </T>
              </View>
              <IconButton icon="back" label="Stop correcting" size={36} onPress={() => setTarget(null)} />
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel={target ? 'Your correction' : 'Message'}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              editable={!loading && !!conversation}
              placeholder={target ? 'How would a Jamaican say it?' : 'Type in Patois...'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="send"
              multiline
              maxLength={MAX_LENGTH}
              style={[
                styles.input,
                inputText,
                { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: target ? theme.accent : theme.backgroundSelected },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={target ? 'Send correction' : 'Send'}
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
                <Icon name={target ? 'check' : 'send'} size={20} color={text ? theme.onAccent : theme.textSecondary} />
              )}
            </Pressable>
          </View>
          {draft.length > MAX_LENGTH - 200 ? (
            <T variant="caption" color="textSecondary" style={styles.counter}>
              {draft.length} / {MAX_LENGTH}
            </T>
          ) : null}
        </View>
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
                If the AI says something that doesn't sound Jamaican, tap Correct under it.
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
  footer: { gap: 10 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 12, paddingRight: 6, borderRadius: 14, borderLeftWidth: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  counter: { alignSelf: 'flex-end' },
});
