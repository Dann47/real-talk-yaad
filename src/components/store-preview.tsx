/** What a Store item looks like, drawn from its colours (no images needed). */
import { StyleSheet, View } from 'react-native';

import { Avatar, Decor, NameBadge, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import type { Badge, CardSkin, Frame } from '@/lib/cosmetics';
import type { StoreItem } from '@/lib/store';

export function StorePreview({ item, name, large, size }: { item: StoreItem; name: string; large?: boolean; size?: number }) {
  const theme = useTheme();
  const height = size ?? (large ? 150 : 96);
  if (item.category === 'card') {
    const skin = item.payload as CardSkin;
    return (
      <View style={[styles.card, { backgroundColor: skin.background, height }]}>
        <Decor color={skin.text} pattern={skin.pattern} />
        {/* Placeholder lines instead of an amount, so the only price you see is the item's. */}
        <View style={[styles.bar, { backgroundColor: skin.text, width: '38%', opacity: 0.55 }]} />
        <View style={[styles.bar, { backgroundColor: skin.text, width: '62%', height: large ? 14 : 10, marginTop: 6 }]} />
      </View>
    );
  }
  if (item.category === 'frame') {
    return (
      <View style={[styles.center, { height, backgroundColor: theme.accentSoft, borderRadius: 14 }]}>
        <Avatar letter={name[0]?.toUpperCase() ?? 'R'} size={large ? 72 : Math.max(24, Math.round(height * 0.5))} frame={(item.payload as Frame).colors} />
      </View>
    );
  }
  return (
    <View style={[styles.center, styles.badge, { height, backgroundColor: theme.accentSoft }]}>
      {height >= 80 ? <T variant={large ? 'heading' : 'smallStrong'}>{name}</T> : null}
      <NameBadge badge={item.payload as Badge} small={height < 80} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, padding: 12, justifyContent: 'flex-end', overflow: 'hidden' },
  badge: { borderRadius: 14, gap: 8, paddingHorizontal: 6 },
  bar: { height: 6, borderRadius: 4 },
});
