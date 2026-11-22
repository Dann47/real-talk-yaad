/** Conversation state shared by Talk (typed) and Voice chat. */
import { useCallback, useState } from 'react';

import { uploadRecording } from '@/lib/audio-upload';
import { useAuth } from '@/lib/auth';
import {
  correctMessage,
  loadConversation,
  sendMessage,
  sendVoiceMessage,
  startConversation,
  type ChatMessage,
  type ChatMode,
  type Conversation,
  type Correction,
} from '@/lib/chat';

export function useChat(mode: ChatMode) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [corrections, setCorrections] = useState<Record<number, Correction>>({});
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setConversation(null);
    setMessages([]);
    setCorrections({});
    setError(null);
  }, []);

  const begin = useCallback(
    async (topicId?: string) => {
      clear();
      setLoading(true);
      try {
        const result = await startConversation(topicId, mode);
        setConversation(result.conversation);
        setMessages(result.messages);
        return result.messages[0] ?? null;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [clear, mode],
  );

  const resume = useCallback(
    async (conversationId: string) => {
      clear();
      setLoading(true);
      try {
        const saved = await loadConversation(conversationId);
        setConversation(saved.conversation);
        setMessages(saved.messages);
        setCorrections(Object.fromEntries(saved.corrections.map((c) => [c.message_id, c])));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [clear],
  );

  /** Shows a placeholder bubble straight away, then swaps in the saved message and the AI reply. */
  const exchange = useCallback(
    async (placeholder: Omit<ChatMessage, 'id' | 'created_at' | 'flagged'>, run: () => Promise<{ userMessage: ChatMessage; reply: ChatMessage }>) => {
      const tempId = -Date.now();
      setError(null);
      setMessages((prev) => [...prev, { ...placeholder, id: tempId, flagged: false, created_at: new Date().toISOString() }]);
      setWaiting(true);
      try {
        const { userMessage, reply } = await run();
        setMessages((prev) => [...prev.filter((m) => m.id !== tempId), userMessage, reply]);
        return reply;
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError((e as Error).message);
        return null;
      } finally {
        setWaiting(false);
      }
    },
    [],
  );

  const sendText = useCallback(
    (text: string) => {
      if (!conversation) return Promise.resolve(null);
      return exchange({ role: 'user', content: text }, () => sendMessage(conversation.id, text));
    },
    [conversation, exchange],
  );

  /** Voice progress for the screen to show: uploading the file, then speech-to-text and the AI reply. */
  const [voiceStage, setVoiceStage] = useState<'idle' | 'uploading' | 'thinking'>('idle');

  const sendVoice = useCallback(
    async (recordingUri: string) => {
      if (!conversation || !user) {
        setError('Your chat is not ready yet. Please wait a moment and try again.');
        return null;
      }
      try {
        return await exchange({ role: 'user', content: '...', audio_path: 'uploading' }, async () => {
          setVoiceStage('uploading');
          const path = await uploadRecording(recordingUri, `${user.id}/${conversation.id}`);
          setVoiceStage('thinking');
          return sendVoiceMessage(conversation.id, path);
        });
      } finally {
        setVoiceStage('idle');
      }
    },
    [conversation, exchange, user],
  );

  const correct = useCallback(async (message: ChatMessage, text: string) => {
    setError(null);
    setWaiting(true);
    try {
      const { correction } = await correctMessage(message.id, text);
      const fixed = { ...correction, amount_jmd: Number(correction.amount_jmd) };
      setCorrections((prev) => ({ ...prev, [message.id]: fixed }));
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, flagged: true } : m)));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setWaiting(false);
    }
  }, []);

  const earned = Object.values(corrections).reduce((sum, c) => sum + c.amount_jmd, 0);

  return {
    conversation,
    messages,
    corrections,
    loading,
    waiting,
    error,
    setError,
    earned,
    clear,
    begin,
    resume,
    sendText,
    sendVoice,
    voiceStage,
    correct,
  };
}
