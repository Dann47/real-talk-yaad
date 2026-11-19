import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Chip, Icon, Screen, T, type IconName } from '@/components/kit';
import { feedPost } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

function SideAction({ icon, label, count }: { icon: IconName; label: string; count: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.sideAction}>
      <Icon name={icon} size={26} color="#FFFFFF" />
      <T variant="caption" style={{ color: '#FFFFFF' }}>
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
    <Screen tabs>
      <View style={[styles.video, { backgroundColor: theme.media }]}>
        <View style={styles.play} accessibilityElementsHidden>
          <Icon name="play" size={34} color="#FFFFFF" />
        </View>
        <View style={styles.sideActions}>
          <SideAction icon="heart" label="Like" count={feedPost.likes} />
          <SideAction icon="chat" label="Comments" count={feedPost.comments} />
          <SideAction icon="share" label="Share" count="Share" />
        </View>
        <View style={styles.caption}>
          <T variant="bodyStrong" style={{ color: '#FFFFFF' }}>
            {feedPost.author}
          </T>
          <T variant="small" style={{ color: '#FFFFFF' }}>
            {feedPost.caption} {feedPost.scene}
          </T>
          <Chip label="AI training on · creator earns a share" />
        </View>
      </View>

      <Card style={styles.teach}>
        <View style={styles.teachHeader}>
          <T variant="heading">Teach the AI</T>
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
            <T variant="small" color="textSecondary" nativeID="teach-label">
              What's happening here? Say it in Patois.
            </T>
            <TextInput
              accessibilityLabelledBy="teach-label"
              accessibilityLabel="What's happening here? Say it in Patois."
              value={answer}
              onChangeText={setAnswer}
              placeholder="Di higgler a sell ackee an mango..."
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.accent, backgroundColor: theme.background },
              ]}
            />
            <Button
              label="Send for review"
              disabled={answer.trim().length < 5}
              onPress={() => setSent(true)}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  video: { height: 440, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' },
  play: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideActions: { position: 'absolute', right: 12, bottom: 20, gap: 14, alignItems: 'center' },
  sideAction: { minWidth: 48, minHeight: 48, alignItems: 'center', gap: 2 },
  caption: { padding: 18, paddingRight: 80, gap: 6 },
  teach: { gap: 10 },
  teachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { minHeight: 72, borderWidth: 1.5, borderRadius: 14, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
