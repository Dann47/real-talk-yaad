import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Appear, Avatar, Button, Card, Chip, Icon, Screen, T, inputText, type IconName } from '@/components/kit';
import { feedPost } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

const WHITE = '#FFFFFF';

function SideAction({ icon, label, count }: { icon: IconName; label: string; count: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.sideAction, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
      <View style={styles.sideIcon}>
        <Icon name={icon} size={24} color={WHITE} />
      </View>
      <T variant="caption" style={{ color: WHITE }}>
        {count}
      </T>
    </Pressable>
  );
}

export default function FeedScreen() {
  const theme = useTheme();
  const [answer, setAnswer] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <Screen tabs title="Feed">
      <Appear style={styles.feedTabs}>
        <T variant="bodyStrong" color="textSecondary">
          Following
        </T>
        <View style={[styles.activeTab, { borderBottomColor: theme.accent }]}>
          <T variant="bodyStrong">For you</T>
        </View>
      </Appear>

      <Appear index={1}>
        <View style={[styles.video, { backgroundColor: theme.media }]}>
          <View style={styles.play} accessibilityElementsHidden>
            <Icon name="play" size={32} color={WHITE} />
          </View>
          <View style={styles.sideActions}>
            <SideAction icon="heart" label="Like" count={feedPost.likes} />
            <SideAction icon="chat" label="Comments" count={feedPost.comments} />
            <SideAction icon="share" label="Share" count="Share" />
          </View>
          <View style={styles.caption}>
            <View style={styles.author}>
              <Avatar letter="K" size={32} ring={WHITE} />
              <T variant="bodyStrong" style={{ color: WHITE }}>
                {feedPost.author}
              </T>
            </View>
            <T variant="small" style={{ color: WHITE }}>
              {feedPost.caption}
            </T>
            <T variant="caption" style={{ color: WHITE, opacity: 0.8 }}>
              {feedPost.scene}
            </T>
            <Chip icon="sparkles" label="AI training on · creator earns a share" />
          </View>
        </View>
      </Appear>

      <Appear index={2}>
        <Card style={styles.teach}>
          <View style={styles.teachHeader}>
            <View>
              <T variant="overline" color="accentText">
                Paid task
              </T>
              <T variant="heading">Teach the AI</T>
            </View>
            <Chip label={feedPost.teachPay} />
          </View>
          {sent ? (
            <View style={styles.sent} accessibilityLiveRegion="polite">
              <Icon name="check" color={theme.accentText} />
              <T variant="bodyStrong" color="accentText">
                Sent for review. Thanks!
              </T>
            </View>
          ) : (
            <>
              <T variant="small" color="textSecondary">
                What's happening here? Say it in Patois.
              </T>
              <TextInput
                accessibilityLabel="What's happening here? Say it in Patois."
                value={answer}
                onChangeText={setAnswer}
                placeholder="Di higgler a sell ackee an mango..."
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.input,
                  inputText,
                  { color: theme.text, borderColor: theme.accent, backgroundColor: theme.backgroundElement },
                ]}
              />
              <Button label="Send for review" icon="send" disabled={answer.trim().length < 5} onPress={() => setSent(true)} />
            </>
          )}
        </Card>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  feedTabs: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  activeTab: { borderBottomWidth: 3, paddingBottom: 4 },
  video: { height: 460, borderRadius: 28, overflow: 'hidden', justifyContent: 'flex-end' },
  play: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideActions: { position: 'absolute', right: 12, bottom: 24, gap: 14, alignItems: 'center' },
  sideAction: { minWidth: 48, alignItems: 'center', gap: 4 },
  sideIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  caption: { padding: 18, paddingRight: 84, gap: 6, backgroundColor: 'rgba(0,0,0,0.45)' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teach: { gap: 12 },
  teachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { minHeight: 80, borderWidth: 1.5, borderRadius: 16, padding: 14, textAlignVertical: 'top' },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
