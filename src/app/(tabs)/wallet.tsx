import { type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Screen, T } from '@/components/kit';
import { history, money, wallet } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

export default function WalletScreen() {
  const theme = useTheme();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Screen tabs>
      <T variant="title">Wallet</T>

      <Card tone="accent" style={styles.balance}>
        <T variant="smallStrong" style={{ color: theme.onAccent }}>
          Available to cash out
        </T>
        <T variant="display" style={{ color: theme.onAccent }}>
          {money(wallet.balance)}
        </T>
        <T variant="small" style={{ color: theme.onAccent }}>
          {money(wallet.pending, 0)} waiting for review
        </T>
      </Card>

      <View style={styles.row}>
        <Button
          label="Cash out"
          style={styles.flex}
          onPress={() => setNotice('Cash-out opens once our licensed payout partner is connected.')}
        />
        <Button label="Store" icon="bag" variant="secondary" style={styles.flex} href={'/store' as Href} />
      </View>
      {notice ? (
        <Card tone="soft">
          <T variant="small" accessibilityLiveRegion="polite">
            {notice}
          </T>
        </Card>
      ) : null}

      <Card style={styles.payout}>
        <Icon name="shield" color={theme.accentText} />
        <View style={styles.flex}>
          <T variant="bodyStrong">{wallet.payoutMethod}</T>
          <T variant="small" color="textSecondary">
            ID verified · paid through our licensed partner
          </T>
        </View>
      </Card>

      <T variant="heading">History</T>
      <View>
        {history.map((item) => (
          <View key={item.id} style={[styles.historyRow, { borderBottomColor: theme.backgroundSelected }]}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balance: { gap: 4, padding: 22 },
  row: { flexDirection: 'row', gap: 10 },
  payout: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
