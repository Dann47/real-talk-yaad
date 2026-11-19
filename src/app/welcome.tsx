import { type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Icon, Screen, T, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'chat', text: 'Talk with the AI and correct it' },
  { icon: 'wallet', text: 'Get paid in J$ or US$' },
  { icon: 'bag', text: 'Spend in the store or cash out' },
];

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Get started" href={'/consent' as Href} />
          <Button label="I already have an account" variant="secondary" href={'/consent' as Href} />
          <T variant="caption" color="textSecondary" style={styles.center}>
            18+ only. Your voice is used only with your permission.
          </T>
        </View>
      }>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: theme.accent }]}>
          <T variant="bodyStrong" style={{ color: theme.onAccent }}>
            RT
          </T>
        </View>
        <T variant="heading">Real Talk Yaad</T>
      </View>

      <T variant="display">Teach AI real Jamaican. Get paid.</T>
      <T variant="body" color="textSecondary">
        Chat, talk and correct the AI in Patois. Earn money for every answer other speakers verify.
      </T>

      <Card style={styles.demo}>
        <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <T variant="small">That sound very delicious, mi friend.</T>
        </View>
        <View style={[styles.bubble, styles.mine, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
          <T variant="smallStrong" style={{ color: theme.onAccent }}>
            We'd say: "Dat sound nice, yuh see!"
          </T>
        </View>
        <View style={styles.mineChip}>
          <Chip label="+J$15 when verified" />
        </View>
      </Card>

      <View style={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <View key={benefit.text} style={styles.benefit}>
            <Icon name={benefit.icon} color={theme.accentText} />
            <T variant="bodyStrong">{benefit.text}</T>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  demo: { gap: 10 },
  bubble: { alignSelf: 'flex-start', maxWidth: '85%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  mine: { alignSelf: 'flex-end' },
  mineChip: { alignSelf: 'flex-end' },
  benefits: { gap: 12 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { gap: 12 },
  center: { textAlign: 'center' },
});
