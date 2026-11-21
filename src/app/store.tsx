import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Header, Screen, T } from '@/components/kit';
import { money, storeItems, wallet, type StoreCategory } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

const FILTERS: ('All' | StoreCategory)[] = ['All', 'Themes', 'Badges', 'Stickers', 'Sounds'];

export default function StoreScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [bought, setBought] = useState<string[]>([]);
  const [balance, setBalance] = useState(wallet.balance);

  const items = storeItems.filter((item) => filter === 'All' || item.category === filter);
  const chosen = storeItems.find((item) => item.id === selected);
  const toneColor = { reward: theme.reward, accent: theme.accent, soft: theme.accentSoft, media: theme.media };

  return (
    <Screen
      title="Store"
      header={<Header title="Store" right={<Chip tone="soft" icon="wallet" label={money(balance, 0)} />} />}
      footer={
        chosen ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <T variant="bodyStrong">{chosen.name}</T>
              <T variant="small" color="textSecondary">
                {bought.includes(chosen.id) ? 'You own this' : money(chosen.price, 0)}
              </T>
            </View>
            <Button
              label={bought.includes(chosen.id) ? 'Owned' : 'Buy'}
              compact
              disabled={bought.includes(chosen.id) || balance < chosen.price}
              onPress={() => {
                setBought([...bought, chosen.id]);
                setBalance(balance - chosen.price);
              }}
            />
          </View>
        ) : undefined
      }>
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f)}
              style={[
                styles.filter,
                {
                  backgroundColor: active ? theme.text : 'transparent',
                  borderColor: active ? theme.text : theme.backgroundSelected,
                },
              ]}>
              <T variant="smallStrong" style={{ color: active ? theme.background : theme.text }}>
                {f}
              </T>
            </Pressable>
          );
        })}
      </View>

      <Card tone="hero" style={styles.banner}>
        <Chip label="Artist drop" />
        <T variant="title" style={{ color: theme.onAccent }}>
          Kingston Nights stickers
        </T>
        <T variant="small" style={{ color: theme.onAccent }}>
          By [Artist name] · artists earn a share of every sale
        </T>
      </Card>

      <View style={styles.grid}>
        {items.map((item) => {
          const isSelected = item.id === selected;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${item.name}, ${money(item.price, 0)}`}
              onPress={() => setSelected(item.id)}
              style={({ pressed }) => [
                styles.item,
                {
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  backgroundColor: theme.background,
                  borderColor: isSelected ? theme.accent : theme.backgroundSelected,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}>
              <View style={[styles.thumb, { backgroundColor: toneColor[item.tone] }]}>
                <View style={[styles.ring, { borderColor: theme.background }]} />
              </View>
              <T variant="smallStrong">{item.name}</T>
              <View style={styles.itemMeta}>
                <T variant="caption" color="textSecondary">
                  {item.category}
                </T>
                <T variant="smallStrong" color="accentText">
                  {bought.includes(item.id) ? 'Owned' : money(item.price, 0)}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center' },
  banner: { gap: 6, padding: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { width: '47.5%', flexGrow: 1, padding: 10, borderRadius: 20, gap: 8 },
  thumb: { height: 110, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 6 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
