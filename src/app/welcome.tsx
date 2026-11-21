import { type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Appear, Button, Card, Chip, IconTile, Screen, T, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';

const BENEFITS: { icon: IconName; title: string; text: string; tone: 'accent' | 'reward' }[] = [
  { icon: 'chat', title: 'Talk and correct', text: 'Chat with the AI and fix its Patois.', tone: 'accent' },
  { icon: 'wallet', title: 'Get paid', text: 'Earn J$ for every verified answer.', tone: 'reward' },
  { icon: 'bag', title: 'Spend or cash out', text: 'Use the store or send it to your card.', tone: 'accent' },
];

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <Screen
      title="Welcome"
      footer={
        <View style={styles.footer}>
          <Button label="Get started" href={'/consent' as Href} />
          <Button label="I already have an account" variant="secondary" href={'/consent' as Href} />
          <T variant="caption" color="textSecondary" style={styles.center}>
            18+ only. Your voice is used only with your permission.
          </T>
        </View>
      }>
      <Appear style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: theme.accent }]}>
          <T variant="bodyStrong" style={{ color: theme.onAccent }}>
            RT
          </T>
        </View>
        <T variant="heading">Real Talk Yaad</T>
      </Appear>

      <Appear index={1}>
        <T variant="display">
          Teach AI real Jamaican.{' '}
          <T variant="display" color="accentText">
            Get paid.
          </T>
        </T>
      </Appear>
      <Appear index={2}>
        <T variant="body" color="textSecondary">
          Chat, talk and correct the AI in Patois. Earn money for every answer other speakers verify.
        </T>
      </Appear>

      <Appear index={3}>
        <Card tone="hero" style={styles.demo}>
          <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.background }]}>
            <T variant="caption" color="textSecondary">
              AI
            </T>
            <T variant="small">That sound very delicious, mi friend.</T>
          </View>
          <View style={[styles.bubble, styles.myBubble, { backgroundColor: theme.reward }]}>
            <T variant="caption" style={{ color: theme.onReward }}>
              You
            </T>
            <T variant="smallStrong" style={{ color: theme.onReward }}>
              We'd say: "Dat sound nice, yuh see!"
            </T>
          </View>
          <View style={styles.end}>
            <Chip tone="onAccent" icon="check" label="+J$15 when verified" />
          </View>
        </Card>
      </Appear>

      {BENEFITS.map((benefit, i) => (
        <Appear key={benefit.title} index={4 + i} style={styles.benefit}>
          <IconTile icon={benefit.icon} tone={benefit.tone} />
          <View style={styles.flex}>
            <T variant="bodyStrong">{benefit.title}</T>
            <T variant="small" color="textSecondary">
              {benefit.text}
            </T>
          </View>
        </Appear>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logo: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  demo: { gap: 10, padding: 20 },
  bubble: { maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, gap: 2 },
  aiBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  myBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  end: { alignSelf: 'flex-end' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  footer: { gap: 12 },
  center: { textAlign: 'center' },
});
