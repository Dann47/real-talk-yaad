/**
 * The one way people correct text in Real Talk Yaad (Talk, Voice, Record and anywhere else):
 *
 *   1. The sheet opens with the original already in the box, so the parts the AI got right stay as they are.
 *   2. Tap any word in "Tap a word to change it" and it gets selected in the box: just type over it.
 *   3. As they type, the same view shows exactly what changed: old words crossed out, new words highlighted.
 *   4. "Start over" puts the original back. The send button stays off until something really changed.
 *
 * DiffText (below) shows a fix the same way everywhere else (chat cards, Verify).
 */
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, IconButton, T, inputText } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { changeCount, wordDiff, type DiffPart } from '@/lib/diff';

const MAX_LENGTH = 1000;

/** A fix shown inline: crossed-out old words, highlighted new ones. Tap handlers make words selectable. */
export function DiffText({
  original,
  fixed,
  parts: given,
  onPressWord,
  size = 'body',
}: {
  original?: string;
  fixed?: string;
  parts?: DiffPart[];
  onPressWord?: (part: Extract<DiffPart, { start: number }>) => void;
  size?: 'body' | 'small';
}) {
  const theme = useTheme();
  const parts = given ?? wordDiff(original ?? '', fixed ?? '');
  const fontSize = size === 'body' ? 17 : 14;
  const lineHeight = size === 'body' ? 28 : 22;

  return (
    <View style={styles.diff} accessibilityLabel={parts.filter((p) => p.type !== 'del').map((p) => p.text).join(' ')}>
      {parts.map((part, i) => {
        const look =
          part.type === 'del'
            ? { color: theme.danger, textDecorationLine: 'line-through' as const, opacity: 0.8 }
            : part.type === 'add'
              ? { color: theme.accentText, backgroundColor: theme.accentSoft, fontWeight: '700' as const }
              : { color: theme.text };
        const word = (
          <Text style={[styles.word, { fontSize, lineHeight }, look]}>
            {part.text}
          </Text>
        );
        if (part.type === 'del' || !onPressWord) {
          return (
            <View key={i} style={styles.wordBox}>
              {word}
            </View>
          );
        }
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Change "${part.text}"`}
            onPress={() => onPressWord(part)}
            hitSlop={4}
            style={({ pressed }) => [styles.wordBox, styles.tappable, { borderColor: pressed ? theme.accent : theme.backgroundSelected }]}>
            {word}
          </Pressable>
        );
      })}
    </View>
  );
}

export function FixSheet({
  visible,
  title,
  label = 'Your fix',
  original,
  initial,
  context,
  submitLabel = 'Send fix',
  hint = 'Keep what the AI got right. Only change what sounds wrong.',
  validate,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  label?: string;
  original: string;
  /** Start from an earlier fix instead of the original (editing a fix). The comparison is still with the original. */
  initial?: string;
  /** Shown above the editor: what was said before, a play button, etc. */
  context?: ReactNode;
  submitLabel?: string;
  hint?: string;
  /** Extra rules (Record: "keep the same meaning and length"). Return a message to block sending. */
  validate?: (original: string, fixed: string) => string | null;
  /** Return true to close the sheet. */
  onSubmit: (fixed: string) => Promise<boolean> | boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [draft, setDraft] = useState(initial ?? original);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Each time the sheet opens, start from the original.
  useEffect(() => {
    if (visible) {
      setDraft(initial ?? original);
      setError(null);
      setSelection(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, original]);

  const parts = useMemo(() => wordDiff(original, draft), [original, draft]);
  const changes = changeCount(parts);
  const clean = draft.trim().replace(/\s+/g, ' ');

  const pickWord = (part: { start: number; end: number }) => {
    const box = input.current;
    if (!box) return;
    // If the box still has focus but the keyboard was closed (back button / swipe down), focus() alone does
    // nothing. Blur first, then focus on the next frame so the keyboard opens again.
    if (box.isFocused()) box.blur();
    setTimeout(() => {
      box.focus();
      // Select the word so typing replaces it. Released right after, so the cursor moves freely.
      setSelection({ start: part.start, end: part.end });
      setTimeout(() => setSelection(undefined), 150);
    }, 60);
  };

  const send = async () => {
    if (!clean) return setError('Type how it should be said.');
    if (!changes) return setError('Change at least one word first, or close this if it was right.');
    const problem = validate?.(original, clean);
    if (problem) return setError(problem);
    setSending(true);
    setError(null);
    try {
      if (await onSubmit(clean)) onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="edit" size={18} color={theme.accentText} />
            </View>
            <T variant="heading" style={styles.flex}>
              {title}
            </T>
            <IconButton icon="close" label="Close" size={36} onPress={onClose} />
          </View>

          {context}

          <View style={[styles.preview, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <View style={styles.previewTop}>
              <T variant="overline" color="textSecondary" style={styles.flex}>
                {changes ? `${changes} ${changes === 1 ? 'word' : 'words'} changed` : 'Tap a word to change it'}
              </T>
              {changes ? (
                <Pressable accessibilityRole="button" onPress={() => setDraft(original)} hitSlop={8} style={styles.reset}>
                  <Icon name="undo" size={12} color={theme.accentText} />
                  <T variant="caption" color="accentText">
                    Start over
                  </T>
                </Pressable>
              ) : null}
            </View>
            <DiffText parts={parts} onPressWord={pickWord} />
          </View>

          <T variant="smallStrong">{label}</T>
          <TextInput
            ref={input}
            accessibilityLabel={label}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            selection={selection}
            multiline
            maxLength={MAX_LENGTH}
            autoCorrect={false}
            autoCapitalize="sentences"
            placeholder="How would a Jamaican say it?"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              inputText,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : changes ? theme.accent : theme.backgroundSelected },
              Platform.OS === 'web' && ({ outlineWidth: 0 } as object),
            ]}
          />
          {error ? (
            <T variant="caption" style={{ color: theme.danger }}>
              {error}
            </T>
          ) : (
            <T variant="caption" color="textSecondary">
              {hint}
            </T>
          )}
          <Button label={sending ? 'Sending...' : submitLabel} icon="check" disabled={sending || !changes} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    maxHeight: '92%',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  preview: { gap: 8, padding: 14, borderRadius: 18, borderWidth: 1 },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  diff: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordBox: { borderRadius: 8 },
  tappable: { borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 4 },
  word: { paddingHorizontal: 2, borderRadius: 6 },
  input: { minHeight: 70, maxHeight: 150, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
});
