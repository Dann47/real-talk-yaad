/** The "⋯" sheet on a post: report it (others' posts) or delete it (your own). */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_REASONS, deletePost, reportPost, type FeedPost } from '@/lib/teach';

export function PostActions({
  post,
  userId,
  onClose,
  onDone,
}: {
  post: FeedPost | null;
  userId: string | undefined;
  onClose: () => void;
  /** Called after a report or delete: 'reported' hides it for this person, 'deleted' removes it. */
  onDone: (post: FeedPost, what: 'reported' | 'deleted') => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!post) return null;

  const close = () => {
    setConfirmDelete(false);
    setError(null);
    onClose();
  };

  const report = async (reason: string) => {
    if (!userId) return;
    setBusy(true);
    try {
      await reportPost(post.id, userId, reason);
      onDone(post, 'reported');
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deletePost(post);
      onDone(post, 'deleted');
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
        {post.is_mine ? (
          <>
            <T variant="heading">Your post</T>
            <T variant="small" color="textSecondary">
              Deleting removes the photo or video for everyone. Descriptions people already wrote stay paid.
            </T>
            {confirmDelete ? (
              <View style={styles.row}>
                <Button label="Keep it" variant="secondary" style={styles.flex} onPress={() => setConfirmDelete(false)} />
                <Button label={busy ? 'Deleting...' : 'Delete'} icon="trash" style={styles.flex} disabled={busy} onPress={remove} />
              </View>
            ) : (
              <Button label="Delete post" icon="trash" variant="secondary" onPress={() => setConfirmDelete(true)} />
            )}
          </>
        ) : (
          <>
            <T variant="heading">Report this post</T>
            <T variant="small" color="textSecondary">
              What's wrong with it? Posts with several reports are hidden while we take a look.
            </T>
            <View style={styles.reasons}>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => report(r.id)}
                  style={({ pressed }) => [styles.reason, { borderColor: theme.backgroundSelected, opacity: pressed || busy ? 0.6 : 1 }]}>
                  <T variant="body" style={styles.flex}>
                    {r.label}
                  </T>
                  <Icon name="chevron" size={14} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </>
        )}
        {error ? (
          <T variant="caption" style={{ color: theme.danger }}>
            {error}
          </T>
        ) : null}
        <Button label="Cancel" variant="ghost" onPress={close} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { gap: 12, paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 720, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3 },
  reasons: { gap: 0 },
  reason: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
});
