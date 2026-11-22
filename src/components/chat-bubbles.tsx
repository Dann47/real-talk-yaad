/** Message bubbles shared by Talk (typed) and Voice chat. */
import { Pressable, StyleSheet, View } from 'react-native';

import { Appear, Icon, T, type IconName } from '@/components/kit';
import { DiffText } from '@/components/fix-editor';
import { money } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage, Correction } from '@/lib/chat';

const STATUS_TEXT: Record<Correction['status'], string> = {
  pending: 'Waiting for other speakers to check it',
  approved: 'Checked and accepted',
  rejected: 'Not accepted by reviewers',
};

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AiBadge() {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.accent }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <T variant="caption" style={{ color: theme.onAccent }}>
        AI
      </T>
    </View>
  );
}

function SmallAction({
  icon,
  label,
  active,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: active ? theme.accent : theme.accentSoft, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name={icon} size={13} color={active ? theme.onAccent : theme.accentText} />
      <T variant="caption" style={{ color: active ? theme.onAccent : theme.accentText }}>
        {label}
      </T>
    </Pressable>
  );
}

export function CorrectionCard({ correction }: { correction: Correction }) {
  const theme = useTheme();
  const paid = correction.amount_jmd > 0;
  return (
    <Appear style={[styles.correction, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <View style={styles.row}>
        <Icon name="edit" size={14} color={theme.accentText} />
        <T variant="caption" color="accentText" style={styles.flex}>
          {correction.kind === 'transcript' ? 'What you really said' : 'Your correction'}
        </T>
        {paid ? (
          <View style={[styles.pay, { backgroundColor: theme.reward }]}>
            <T variant="caption" style={{ color: theme.onReward }}>
              +{money(correction.amount_jmd, 0)}
            </T>
          </View>
        ) : null}
      </View>
      {correction.original ? (
        <DiffText original={correction.original} fixed={correction.corrected} size="small" />
      ) : (
        <T variant="bodyStrong">{correction.corrected}</T>
      )}
      <View style={styles.row}>
        <Icon name={correction.status === 'approved' ? 'check' : 'shield'} size={13} color={theme.textSecondary} />
        <T variant="caption" color="textSecondary" style={styles.flex}>
          {STATUS_TEXT[correction.status]}
          {paid
            ? correction.status === 'pending'
              ? ` · ${money(correction.amount_jmd, 0)} when verified`
              : ''
            : ' · over this chat’s paid limit'}
        </T>
      </View>
    </Appear>
  );
}

export function MessageRow({
  message,
  correction,
  selected,
  canCorrect,
  onCorrect,
  onReplay,
  onPlayMine,
  playingMine,
}: {
  message: ChatMessage;
  correction?: Correction;
  selected: boolean;
  canCorrect: boolean;
  onCorrect: () => void;
  /** Voice chat: read an AI reply aloud again. */
  onReplay?: () => void;
  /** Voice chat: play back what you recorded, so you can check what we heard. */
  onPlayMine?: () => void;
  playingMine?: boolean;
}) {
  const theme = useTheme();
  const mine = message.role === 'user';
  const pending = message.id < 0;
  const spoken = !!message.audio_path;

  if (mine) {
    return (
      <View style={styles.group}>
        <View style={[styles.mineWrap, pending && styles.pending]}>
          <View
            style={[
              styles.bubble,
              styles.myTail,
              { backgroundColor: theme.accent, borderWidth: selected ? 2 : 0, borderColor: theme.reward },
            ]}>
            {spoken ? (
              <View style={styles.row}>
                <Icon name="mic" size={13} color={theme.onAccent} />
                <T variant="caption" style={{ color: theme.onAccent, opacity: 0.85 }}>
                  We heard
                </T>
              </View>
            ) : null}
            <T variant="body" style={{ color: theme.onAccent }}>
              {correction?.kind === 'transcript' ? correction.corrected : message.content}
            </T>
          </View>
          <View style={styles.mineMeta}>
            {spoken && onPlayMine && !pending ? (
              <SmallAction
                icon={playingMine ? 'stop' : 'play'}
                label={playingMine ? 'Stop' : 'Play'}
                active={playingMine}
                accessibilityLabel={playingMine ? 'Stop your recording' : 'Play your recording'}
                onPress={onPlayMine}
              />
            ) : null}
            {spoken && canCorrect && !pending ? (
              <SmallAction
                icon="edit"
                label={selected ? 'Fixing' : 'Fix the words'}
                active={selected}
                accessibilityLabel="Fix the words we heard"
                onPress={onCorrect}
              />
            ) : null}
            <T variant="caption" color="textSecondary">
              {pending ? (spoken ? 'Listening...' : 'Sending...') : clockTime(message.created_at)}
            </T>
          </View>
        </View>
        {correction ? <CorrectionCard correction={correction} /> : null}
      </View>
    );
  }

  const highlight = selected ? theme.accent : message.flagged ? theme.reward : theme.backgroundSelected;

  return (
    <View style={styles.group}>
      <View style={styles.aiRow}>
        <AiBadge />
        <View style={styles.aiColumn}>
          <View
            style={[
              styles.bubble,
              styles.aiTail,
              { backgroundColor: theme.backgroundElement, borderWidth: selected || message.flagged ? 2 : 1, borderColor: highlight },
            ]}>
            <T variant="body">{message.content}</T>
          </View>
          <View style={styles.aiMeta}>
            <T variant="caption" color="textSecondary">
              {clockTime(message.created_at)}
            </T>
            {onReplay ? (
              <SmallAction icon="play" label="Play" accessibilityLabel="Play this reply again" onPress={onReplay} />
            ) : null}
            {canCorrect ? (
              <SmallAction
                icon="edit"
                label={selected ? 'Correcting' : 'Correct'}
                active={selected}
                accessibilityLabel="Correct this reply"
                onPress={onCorrect}
              />
            ) : null}
          </View>
        </View>
      </View>
      {correction ? <CorrectionCard correction={correction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  group: { gap: 8 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aiColumn: { flexShrink: 1, maxWidth: '85%', gap: 4 },
  aiMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, flexWrap: 'wrap' },
  mineWrap: { alignSelf: 'flex-end', maxWidth: '82%', gap: 4 },
  mineMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', paddingRight: 4 },
  pending: { opacity: 0.6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  bubble: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20, gap: 4 },
  aiTail: { borderBottomLeftRadius: 6 },
  myTail: { borderBottomRightRadius: 6 },
  correction: { alignSelf: 'flex-end', maxWidth: '86%', padding: 14, borderRadius: 20, borderBottomRightRadius: 6, borderWidth: 1.5, gap: 6 },
  pay: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
});
