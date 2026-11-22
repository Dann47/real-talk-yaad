import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti } from '@/components/celebrate';
import { Appear, Avatar, Button, Card, Chip, Decor, Header, Icon, IconTile, NameBadge, Notice, Screen, T } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { useMyLook, type Badge, type CardSkin, type Frame } from '@/lib/cosmetics';
import { money } from '@/lib/format';
import { HIDDEN, useHideAmounts } from '@/lib/hide-amounts';
import {
  CATEGORY_HELP,
  CATEGORY_LABEL,
  buyItem,
  equipItem,
  loadAvailable,
  loadCatalog,
  stockLeft,
  type StoreCategory,
  type StoreItem,
} from '@/lib/store';

type Filter = 'all' | StoreCategory | 'owned';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'card', label: 'Card skins' },
  { id: 'frame', label: 'Frames' },
  { id: 'badge', label: 'Badges' },
  { id: 'owned', label: 'Yours' },
];

/** What an item looks like, drawn from its colours (no images needed). */
function Preview({ item, name, large }: { item: StoreItem; name: string; large?: boolean }) {
  const theme = useTheme();
  if (item.category === 'card') {
    const skin = item.payload as CardSkin;
    return (
      <View style={[styles.cardPreview, { backgroundColor: skin.background, height: large ? 150 : 96 }]}>
        <Decor color={skin.text} pattern={skin.pattern} />
        <T variant="caption" style={{ color: skin.text, opacity: 0.85 }}>
          Available
        </T>
        <T variant={large ? 'display' : 'heading'} style={{ color: skin.text }}>
          J$1,250
        </T>
      </View>
    );
  }
  if (item.category === 'frame') {
    return (
      <View style={[styles.center, { height: large ? 150 : 96, backgroundColor: theme.accentSoft, borderRadius: 14 }]}>
        <Avatar letter={name[0]?.toUpperCase() ?? 'R'} size={large ? 72 : 48} frame={(item.payload as Frame).colors} />
      </View>
    );
  }
  return (
    <View style={[styles.center, styles.badgePreview, { height: large ? 150 : 96, backgroundColor: theme.accentSoft }]}>
      <T variant={large ? 'heading' : 'smallStrong'}>{name}</T>
      <NameBadge badge={item.payload as Badge} />
    </View>
  );
}

function ItemSheet({
  item,
  name,
  available,
  hidden,
  onClose,
  onChanged,
}: {
  item: StoreItem | null;
  name: string;
  available: number | null;
  hidden: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useMyLook();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [justBought, setJustBought] = useState(false);

  if (!item) return null;
  const left = stockLeft(item);
  const short = available !== null ? Math.max(0, item.price_jmd - available) : 0;
  const owned = item.owned || justBought;

  const close = () => {
    setConfirming(false);
    setError(null);
    setJustBought(false);
    onClose();
  };

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      await buyItem(item.id);
      setJustBought(true);
      setConfirming(false);
      setBurst((b) => b + 1);
      onChanged(`${item.name} is yours!`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const wear = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await equipItem(on ? item.id : null, item.category);
      await refresh();
      onChanged(on ? `You're wearing ${item.name}.` : `${item.name} taken off.`);
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
        <Confetti burst={burst} />
        <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
        <Preview item={item} name={name} large />
        <View style={styles.sheetTitle}>
          <View style={styles.flex}>
            <T variant="title">{item.name}</T>
            <T variant="caption" color="textSecondary">
              {CATEGORY_LABEL[item.category]}
              {item.artist_name ? ` · by ${item.artist_name}` : ''}
            </T>
          </View>
          <T variant="title" color={owned ? 'accentText' : 'rewardText'}>
            {owned ? 'Yours' : money(item.price_jmd, 0)}
          </T>
        </View>
        {item.description ? <T variant="body">{item.description}</T> : null}
        <T variant="small" color="textSecondary">
          {CATEGORY_HELP[item.category]}
        </T>
        {left !== null && !owned ? (
          <Chip tone="reward" icon="flame" label={left === 0 ? 'Sold out' : `Limited: only ${left} left`} />
        ) : null}
        {error ? <Notice tone="error" text={error} /> : null}

        {owned ? (
          item.equipped && !justBought ? (
            <Button label={busy ? 'Saving...' : 'Take it off'} variant="secondary" disabled={busy} onPress={() => wear(false)} />
          ) : (
            <Button label={busy ? 'Saving...' : 'Wear it now'} icon="check" disabled={busy} onPress={() => wear(true)} />
          )
        ) : confirming ? (
          <View style={styles.confirm}>
            <T variant="small" color="textSecondary">
              {money(item.price_jmd, 0)} comes out of your balance. Store items can't be refunded or cashed out.
            </T>
            <View style={styles.row}>
              <Button label="Not now" variant="secondary" style={styles.flex} disabled={busy} onPress={() => setConfirming(false)} />
              <Button label={busy ? 'Buying...' : 'Buy it'} icon="bag" variant="reward" style={styles.flex} disabled={busy} onPress={buy} />
            </View>
          </View>
        ) : short > 0 ? (
          <View style={styles.confirm}>
            <Button label={`${hidden ? 'A bit' : money(short, 0)} more needed`} variant="secondary" disabled onPress={() => {}} />
            <Button label="Earn more" icon="bolt" variant="ghost" onPress={() => { close(); router.push('/work' as Href); }} />
          </View>
        ) : (
          <Button label={`Buy for ${money(item.price_jmd, 0)}`} icon="bag" variant="reward" disabled={left === 0} onPress={() => setConfirming(true)} />
        )}
        <Button label="Close" variant="ghost" onPress={close} />
      </View>
    </Modal>
  );
}

export default function StoreScreen() {
  const theme = useTheme();
  const { user, profile } = useAuth();
  const [hidden] = useHideAmounts();
  const name = displayName(profile, user);
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<StoreItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [catalog, balance] = await Promise.all([loadCatalog(), loadAvailable()]);
      setItems(catalog);
      setAvailable(balance);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setItems((list) => list ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = (items ?? []).filter((item) => (filter === 'all' ? true : filter === 'owned' ? item.owned : item.category === filter));
  const featured = (items ?? []).find((item) => item.featured && !item.owned);

  return (
    <Screen
      title="Store"
      onRefresh={load}
      refreshing={refreshing && !!items}
      header={
        <Header
          title="Store"
          subtitle="Spend what you earn on your look"
          right={<Chip tone="soft" icon="wallet" label={available === null ? '—' : hidden ? HIDDEN : money(available, 0)} />}
        />
      }>
      {error ? (
        <Pressable accessibilityRole="button" onPress={load}>
          <Notice tone="error" text={`${error} Tap to try again.`} />
        </Pressable>
      ) : null}
      {notice ? <Notice tone="success" text={notice} /> : null}

      {featured ? (
        <Appear>
          <Pressable accessibilityRole="button" accessibilityLabel={`Featured: ${featured.name}`} onPress={() => setOpen(featured)}>
            <Card tone="hero" style={styles.featured}>
              <View style={styles.flex}>
                <Chip label="Featured" icon="sparkles" />
                <T variant="title" style={{ color: theme.onAccent, marginTop: 8 }}>
                  {featured.name}
                </T>
                <T variant="small" style={{ color: theme.onAccent }}>
                  {CATEGORY_LABEL[featured.category]} · {money(featured.price_jmd, 0)}
                </T>
              </View>
              <View style={styles.featuredPreview}>
                <Preview item={featured} name={name} />
              </View>
            </Card>
          </Pressable>
        </Appear>
      ) : null}

      <Appear index={1} style={styles.filters}>
        {FILTERS.map((f) => {
          const on = f.id === filter;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f.id)}
              style={[styles.filter, { backgroundColor: on ? theme.accent : theme.backgroundElement, borderColor: on ? theme.accent : theme.backgroundSelected }]}>
              <T variant="smallStrong" style={{ color: on ? theme.onAccent : theme.text }}>
                {f.label}
              </T>
            </Pressable>
          );
        })}
      </Appear>

      {!items ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
        </View>
      ) : shown.length === 0 ? (
        <Card style={styles.empty}>
          <IconTile icon="bag" tone="reward" size={44} />
          <T variant="heading">{filter === 'owned' ? 'Nothing yet' : 'Nothing here right now'}</T>
          <T variant="small" color="textSecondary" style={styles.centerText}>
            {filter === 'owned' ? 'Things you buy show up here, ready to wear.' : 'New things drop regularly. Check back soon.'}
          </T>
        </Card>
      ) : (
        <View style={styles.grid}>
          {shown.map((item, i) => {
            const left = stockLeft(item);
            return (
              <Appear key={item.id} index={2 + Math.min(i, 6)} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.owned ? 'yours' : money(item.price_jmd, 0)}`}
                  onPress={() => setOpen(item)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: item.equipped ? theme.accent : theme.backgroundSelected,
                      borderWidth: item.equipped ? 2 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}>
                  <Preview item={item} name={name} />
                  <T variant="smallStrong" numberOfLines={1}>
                    {item.name}
                  </T>
                  <View style={styles.itemMeta}>
                    <T variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
                      {left !== null && !item.owned ? (left === 0 ? 'Sold out' : `${left} left`) : CATEGORY_LABEL[item.category]}
                    </T>
                    {item.equipped ? (
                      <Icon name="check" size={14} color={theme.accentText} />
                    ) : (
                      <T variant="smallStrong" color={item.owned ? 'accentText' : 'rewardText'}>
                        {item.owned ? 'Yours' : money(item.price_jmd, 0)}
                      </T>
                    )}
                  </View>
                </Pressable>
              </Appear>
            );
          })}
        </View>
      )}

      <T variant="caption" color="textSecondary" style={styles.centerText}>
        Store items are just for looks: they never change what you earn. No refunds.
      </T>

      <ItemSheet
        item={open}
        name={name}
        available={available}
        hidden={hidden}
        onClose={() => setOpen(null)}
        onChanged={(message) => {
          setNotice(message);
          load();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  loading: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  featured: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  featuredPreview: { width: 130 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47.5%', flexGrow: 1 },
  item: { padding: 10, borderRadius: 20, gap: 8 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardPreview: { borderRadius: 14, padding: 12, justifyContent: 'flex-end', overflow: 'hidden' },
  badgePreview: { borderRadius: 14, gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { gap: 12, paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 720, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3 },
  sheetTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirm: { gap: 10 },
});
