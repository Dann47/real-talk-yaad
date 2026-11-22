/**
 * A small, friendly Store suggestion: the best thing you can afford right now,
 * or how close you are to the cheapest thing you don't own. Hides when there's nothing to suggest.
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Appear, Icon, ProgressBar, T } from '@/components/kit';
import { StorePreview } from '@/components/store-preview';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { useHideAmounts } from '@/lib/hide-amounts';
import { loadAvailable, loadCatalog, stockLeft, type StoreItem } from '@/lib/store';
import { useStoreGoal } from '@/lib/store-goal';

type Pick = { item: StoreItem; affordable: boolean; short: number; available: number; isGoal: boolean };

function choose(items: StoreItem[], available: number, goalId: number | null): Pick | null {
  const forSale = items.filter((i) => !i.owned && stockLeft(i) !== 0);
  if (!forSale.length) return null;
  // The item you chose to save for always comes first.
  const goal = forSale.find((i) => i.id === goalId);
  if (goal) {
    return { item: goal, affordable: goal.price_jmd <= available, short: Math.max(0, goal.price_jmd - available), available, isGoal: true };
  }
  // Most exciting thing you can afford (featured first, then the priciest).
  const affordable = forSale
    .filter((i) => i.price_jmd <= available)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.price_jmd - a.price_jmd)[0];
  if (affordable) return { item: affordable, affordable: true, short: 0, available, isGoal: false };
  const cheapest = [...forSale].sort((a, b) => a.price_jmd - b.price_jmd)[0];
  return { item: cheapest, affordable: false, short: cheapest.price_jmd - available, available, isGoal: false };
}

export function StoreNudge({ index = 0, compact = false }: { index?: number; compact?: boolean }) {
  const theme = useTheme();
  const { user, profile } = useAuth();
  const [hidden] = useHideAmounts();
  const [pick, setPick] = useState<Pick | null>(null);
  const [goalId] = useStoreGoal();
  const name = displayName(profile, user);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([loadCatalog(), loadAvailable()])
        .then(([items, available]) => {
          if (active) setPick(available === null ? null : choose(items, available, goalId));
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [goalId]),
  );

  if (!pick) return null;
  const { item, affordable, short, available, isGoal } = pick;

  return (
    <Appear index={index}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={affordable ? `Store: you can get ${item.name}` : `Store: ${item.name}`}
        onPress={() => router.push(`/store?item=${item.id}` as Href)}
        style={({ pressed }) => [
          styles.nudge,
          {
            backgroundColor: affordable ? theme.rewardSoft : theme.backgroundElement,
            borderColor: affordable ? theme.reward : theme.backgroundSelected,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}>
        <View style={styles.preview}>
          <StorePreview item={item} name={name} size={compact ? 48 : 58} />
        </View>
        <View style={styles.flex}>
          <View style={styles.top}>
            <Icon name="bag" size={12} color={affordable ? theme.rewardText : theme.textSecondary} />
            <T variant="caption" color={affordable ? 'rewardText' : 'textSecondary'}>
              {isGoal ? (affordable ? 'Your goal is ready!' : 'Your goal') : affordable ? 'Treat yourself' : 'In the Store'}
            </T>
          </View>
          <T variant="bodyStrong" numberOfLines={1}>
            {affordable ? `${item.name} is in reach` : isGoal ? `Saving for ${item.name}` : `${item.name} · ${money(item.price_jmd, 0)}`}
          </T>
          {affordable ? (
            <T variant="caption" color="textSecondary" numberOfLines={1}>
              {money(item.price_jmd, 0)} · {item.featured ? 'Featured in the Store' : 'Tap to see it on you'}
            </T>
          ) : (
            <View style={styles.progress}>
              <ProgressBar value={available / item.price_jmd} label={`Saving for ${item.name}`} color={theme.reward} />
              <T variant="caption" color="textSecondary" numberOfLines={1}>
                {hidden ? 'Keep going' : `${money(short, 0)} to go`}
                {isGoal ? '' : ' · tap to pick a goal'}
              </T>
            </View>
          )}
        </View>
        <Icon name="chevron" size={16} color={theme.textSecondary} />
      </Pressable>
    </Appear>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1.5 },
  preview: { width: 74, borderRadius: 12, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progress: { gap: 4, marginTop: 4 },
});
