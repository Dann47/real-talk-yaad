import { type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Appear, Button, Card, IconTile, Screen, SectionHeader, T, type IconName } from '@/components/kit';
import { history, money, wallet } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

const KIND: Record<(typeof history)[number]['kind'], { icon: IconName; tone: 'accent' | 'reward' }> = {
  earn: { icon: 'plus', tone: 'accent' },
  store: { icon: 'bag', tone: 'reward' },
  cashout: { icon: 'cashout', tone: 'accent' },
};

export default function WalletScreen() {
  const theme = useTheme();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Screen tabs title="Wallet">
      <Appear>
        <T variant="title">Wallet</T>
      </Appear>

      <Appear index={1}>
        <Card tone="hero" style={styles.hero}>
          <T variant="overline" style={{ color: theme.onAccent, opacity: 0.85 }}>
            Available to cash out
          </T>
          <T variant="display" style={{ color: theme.onAccent }}>
            {money(wallet.balance)}
          </T>
          <T variant="small" style={{ color: theme.onAccent }}>
            {money(wallet.pending, 0)} waiting for review
          </T>
        </Card>
      </Appear>

      <Appear index={2} style={styles.row}>
        <Button
          label="Cash out"
          icon="cashout"
          style={styles.flex}
          onPress={() => setNotice('Cash-out opens once our licensed payout partner is connected.')}
        />
        <Button label="Store" icon="bag" variant="secondary" style={styles.flex} href={'/store' as Href} />
      </Appear>
      {notice ? (
        <Appear>
          <Card tone="soft">
            <T variant="small" accessibilityLiveRegion="polite">
              {notice}
            </T>
          </Card>
        </Appear>
      ) : null}

      <Appear index={3}>
        <Card style={styles.payout}>
          <IconTile icon="shield" />
          <View style={styles.flex}>
            <T variant="bodyStrong">{wallet.payoutMethod}</T>
            <T variant="small" color="textSecondary">
              ID verified · paid through our licensed partner
            </T>
          </View>
        </Card>
      </Appear>

      <Appear index={4}>
        <SectionHeader title="History" />
      </Appear>
      <Appear index={5}>
        <Card style={styles.history}>
          {history.map((item, i) => (
            <View
              key={item.id}
              style={[
                styles.historyRow,
                i < history.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundSelected },
              ]}>
              <IconTile icon={KIND[item.kind].icon} tone={KIND[item.kind].tone} size={40} />
              <View style={styles.flex}>
                <T variant="bodyStrong">{item.label}</T>
                <T variant="small" color="textSecondary">
                  {item.when}
                </T>
              </View>
              <T variant="bodyStrong" color={item.amount > 0 ? 'accentText' : 'text'}>
                {item.amount > 0 ? '+' : ''}
                {money(item.amount, 0)}
              </T>
            </View>
          ))}
        </Card>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: 4, padding: 24 },
  row: { flexDirection: 'row', gap: 10 },
  payout: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  history: { paddingVertical: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
