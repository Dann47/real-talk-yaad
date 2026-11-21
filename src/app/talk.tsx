import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Appear, Button, Chip, Header, Icon, IconButton, Notice, Screen, T, inputText } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import {
  correctMessage,
  loadConversation,
  sendMessage,
  startConversation,
  type ChatMessage,
  type Conversation,
  type Correction,
} from '@/lib/chat';

/** What a verified correction is worth. Display only: real pay comes from the ledger later. */
const PAY_PER_CORRECTION = 15;

function Bubble({ message, correction }: { message: ChatMessage; correction?: Correction }) {
  const theme = useTheme();
  const mine = message.role === 'user';

  return (
    <View style={styles.group}>
      <View style={[styles.messageWrap, mine && styles.mineWrap]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.myTail : styles.aiTail,
            mine
              ? { backgroundColor: theme.accent }
              : {
                  backgroundColor: theme.backgroundElement,
                  borderWidth: message.flagged ? 2 : 1,
                  borderColor: message.flagged ? theme.reward : theme.backgroundSelected,
                },
          ]}>
          <T variant="body" style={mine ? { color: theme.onAccent } : undefined}>
            {message.content}
          </T>
        </View>
        {message.flagged ? (
          <T variant="caption" color="textSecondary">
            You marked this reply as wrong
          </T>
        ) : null}
      </View>

      {correction ? (
        <View style={[styles.correction, { backgroundColor: theme.accentSoft, borderColor: theme.backgroundSelected }]}>
          <View style={styles.row}>
            <Icon name="edit" size={14} color={theme.accentText} />
            <T variant="caption" color="accentText">
              Your correction
            </T>
          </View>
          <T variant="bodyStrong">{correction.corrected}</T>
          <T variant="caption" color="textSecondary">
            {correction.status === 'pending'
              ? `Waiting for other speakers to verify · +J$${PAY_PER_CORRECTION}`
              : correction.status === 'approved'
                ? `Verified · +J$${PAY_PER_CORRECTION}`
                : 'Not accepted by reviewers'}
          </T>
        </View>
      ) : null}
    </View>
  );
}

export default function TalkScreen() {
  const theme = useTheme();
  const { topic: topicParam, conversation: resumeId } = useLocalSearchParams<{ topic?: string; conversation?: string }>();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [corrections, setCorrections] = useState<Record<number, Correction>>({});
  const [draft, setDraft] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [starting, setStarting] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async (topicId?: string) => {
    setStarting(true);
    setError(null);
    setMessages([]);
    setCorrections({});
    setCorrecting(false);
    try {
      const result = await startConversation(topicId);
      setConversation(result.conversation);
      setMessages(result.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }, []);

  const resume = useCallback(async (conversationId: string) => {
    setStarting(true);
    setError(null);
    try {
      const saved = await loadConversation(conversationId);
      setConversation(saved.conversation);
      setMessages(saved.messages);
      setCorrections(Object.fromEntries(saved.corrections.map((c) => [c.message_id, c])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (resumeId) resume(resumeId);
    else begin(topicParam);
  }, [begin, resume, resumeId, topicParam]);

  const lastAi = [...messages].reverse().find((m) => m.role === 'assistant');
  const canCorrect = !!lastAi && !corrections[lastAi.id];
  const earned = Object.keys(corrections).length * PAY_PER_CORRECTION;

  const submit = async () => {
    const text = draft.trim();
    if (!text || !conversation || waiting) return;
    setError(null);

    if (correcting && lastAi) {
      setWaiting(true);
      try {
        const { correction } = await correctMessage(lastAi.id, text);
        setCorrections((prev) => ({ ...prev, [lastAi.id]: correction }));
        setMessages((prev) => prev.map((m) => (m.id === lastAi.id ? { ...m, flagged: true } : m)));
        setDraft('');
        setCorrecting(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setWaiting(false);
      }
      return;
    }

    // Show the user's message straight away, then swap in the saved copy.
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', content: text, flagged: false, created_at: new Date().toISOString() },
    ]);
    setDraft('');
    setWaiting(true);
    try {
      const { userMessage, reply } = await sendMessage(conversation.id, text);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), userMessage, reply]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      setError((e as Error).message);
    } finally {
      setWaiting(false);
    }
  };

  const topicTitle = conversation?.topic.title;

  return (
    <Screen
      stickToBottom
      title="Talk with the AI"
      header={
        <Header
          title="Talk with the AI"
          subtitle={topicTitle ? `Topic: ${topicTitle}` : 'Finding a topic...'}
          right={<Chip label={`J$${earned} so far`} />}
        />
      }
      footer={
        <View style={styles.footer}>
          {correcting ? (
            <View style={styles.row}>
              <T variant="smallStrong" color="accentText" style={styles.flex}>
                Write how a Jamaican would say the last reply
              </T>
              <Button label="Cancel" variant="ghost" compact onPress={() => setCorrecting(false)} />
            </View>
          ) : (
            <View style={styles.row}>
              <Button
                label="Correct the last reply"
                icon="edit"
                variant="secondary"
                compact
                disabled={!canCorrect || waiting || starting}
                // Keep anything already typed: people often start writing the fix before tapping this.
                onPress={() => setCorrecting(true)}
              />
              <Button label="New topic" variant="ghost" compact disabled={starting || waiting} onPress={() => begin()} />
            </View>
          )}
          <View style={styles.row}>
            <TextInput
              accessibilityLabel={correcting ? 'Your correction' : 'Message'}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              editable={!starting && !!conversation}
              placeholder={correcting ? 'How would you say it?' : 'Type in Patois...'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="send"
              maxLength={1000}
              style={[
                styles.input,
                inputText,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: correcting ? theme.accent : theme.backgroundSelected,
                },
              ]}
            />
            <IconButton
              icon="send"
              label={correcting ? 'Send correction' : 'Send'}
              filled
              onPress={submit}
            />
          </View>
        </View>
      }>
      {error ? (
        <Appear>
          <Notice tone="error" text={error} />
          {!conversation ? (
            <Button
              label="Try again"
              variant="secondary"
              compact
              style={styles.retry}
              onPress={() => (resumeId ? resume(resumeId) : begin(topicParam))}
            />
          ) : null}
        </Appear>
      ) : null}

      {starting ? (
        <View style={styles.loading} accessibilityLabel="Starting a conversation">
          <ActivityIndicator color={theme.accentText} />
          <T variant="small" color="textSecondary">
            {resumeId ? 'Loading your chat...' : 'Starting a conversation...'}
          </T>
        </View>
      ) : null}

      {messages.map((message) => (
        <Appear key={message.id}>
          <Bubble message={message} correction={corrections[message.id]} />
        </Appear>
      ))}

      {waiting && !correcting ? (
        <Appear>
          <View accessibilityLabel="The AI is typing" style={[styles.typing, { backgroundColor: theme.backgroundElement }]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, { backgroundColor: theme.textSecondary, opacity: 0.5 + i * 0.2 }]} />
            ))}
          </View>
        </Appear>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  group: { gap: 8 },
  messageWrap: { alignSelf: 'flex-start', maxWidth: '85%', gap: 4 },
  mineWrap: { alignSelf: 'flex-end' },
  bubble: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 },
  aiTail: { borderBottomLeftRadius: 6 },
  myTail: { borderBottomRightRadius: 6 },
  correction: { alignSelf: 'flex-end', maxWidth: '88%', padding: 14, borderRadius: 20, borderBottomRightRadius: 6, borderWidth: 1, gap: 4 },
  typing: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  retry: { alignSelf: 'flex-start', marginTop: 8 },
  footer: { gap: 10 },
  input: { flex: 1, minHeight: 48, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 16 },
});
