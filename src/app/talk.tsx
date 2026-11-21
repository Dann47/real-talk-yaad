import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Appear, Button, Chip, Header, Icon, IconButton, Screen, T, inputText } from '@/components/kit';
import { aiReplies, openingChat, talkTopic, type ChatMessage } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

const PAY_PER_CORRECTION = 15;

function Bubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  if (message.from === 'correction') {
    return (
      <View style={[styles.correction, { backgroundColor: theme.accentSoft, borderColor: theme.backgroundSelected }]}>
        <View style={styles.row}>
          <Icon name="edit" size={14} color={theme.accentText} />
          <T variant="caption" color="accentText">
            Your correction
          </T>
        </View>
        <T variant="bodyStrong">{message.text}</T>
        <T variant="caption" color="textSecondary">
          Waiting for other speakers to verify · +J${PAY_PER_CORRECTION}
        </T>
      </View>
    );
  }
  const mine = message.from === 'me';
  return (
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
          {message.text}
        </T>
      </View>
      {message.flagged ? (
        <T variant="caption" color="textSecondary">
          You marked this reply as wrong
        </T>
      ) : null}
    </View>
  );
}

export default function TalkScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>(openingChat);
  const [draft, setDraft] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [earned, setEarned] = useState(45);
  const [typing, setTyping] = useState(false);
  const replyIndex = useRef(0);

  const lastAi = [...messages].reverse().find((m) => m.from === 'ai');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');

    if (correcting && lastAi) {
      setCorrecting(false);
      setEarned((e) => e + PAY_PER_CORRECTION);
      setMessages((prev) => [
        ...prev.map((m) => (m.id === lastAi.id ? { ...m, flagged: true } : m)),
        { id: `c${Date.now()}`, from: 'correction', text },
      ]);
      return;
    }

    const reply = aiReplies[replyIndex.current % aiReplies.length];
    replyIndex.current += 1;
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, from: 'me', text }]);
    setTyping(true);
    // Placeholder reply until the AI backend is connected.
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { id: `a${Date.now()}`, from: 'ai', text: reply }]);
    }, 1100);
  };

  return (
    <Screen
      title="Talk with the AI"
      header={
        <Header title="Talk with the AI" subtitle={`Topic: ${talkTopic}`} right={<Chip label={`J$${earned} so far`} />} />
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
            <Button
              label="Correct the last reply"
              icon="edit"
              variant="secondary"
              compact
              style={styles.correctButton}
              disabled={!lastAi}
              onPress={() => setCorrecting(true)}
            />
          )}
          <View style={styles.row}>
            <TextInput
              accessibilityLabel={correcting ? 'Your correction' : 'Message'}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              placeholder={correcting ? 'Dat sound nice, yuh see!' : 'Type in Patois...'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="send"
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
            <IconButton icon="send" label={correcting ? 'Send correction' : 'Send'} filled onPress={send} />
          </View>
        </View>
      }>
      {messages.map((message) => (
        <Appear key={message.id}>
          <Bubble message={message} />
        </Appear>
      ))}
      {typing ? (
        <Appear>
          <View
            accessibilityLabel="The AI is typing"
            style={[styles.typing, { backgroundColor: theme.backgroundElement }]}>
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
  messageWrap: { alignSelf: 'flex-start', maxWidth: '85%', gap: 4 },
  mineWrap: { alignSelf: 'flex-end' },
  bubble: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 },
  aiTail: { borderBottomLeftRadius: 6 },
  myTail: { borderBottomRightRadius: 6 },
  typing: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  correction: { alignSelf: 'flex-end', maxWidth: '88%', padding: 14, borderRadius: 20, borderBottomRightRadius: 6, borderWidth: 1, gap: 4 },
  footer: { gap: 10 },
  correctButton: { alignSelf: 'flex-start' },
  input: { flex: 1, minHeight: 48, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 16 },
});
