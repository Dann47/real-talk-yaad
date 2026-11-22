import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Appear, Avatar, Button, Card, Header, Icon, IconTile, NameBadge, Notice, Screen, T } from '@/components/kit';
import { Skeleton } from '@/components/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { loadLeaderboard, nextTarget, type LeaderPeriod, type LeaderRow, type LeaderScope } from '@/lib/profile';

function Toggle<V extends string>({ value, options, onChange }: { value: V; options: { id: V; label: string }[]; onChange: (v: V) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.toggle, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[styles.toggleItem, on && { backgroundColor: theme.accent }]}>
            <T variant="smallStrong" style={{ color: on ? theme.onAccent : theme.text }} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Top three, biggest in the middle. */
function Podium({ rows }: { rows: LeaderRow[] }) {
  const theme = useTheme();
  const medal = [theme.reward, '#A8B0BA', '#C47A3D'];
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as LeaderRow[];
  return (
    <View style={styles.podium}>
      {order.map((row) => {
        const first = row.rank === 1;
        return (
          <View key={`${row.rank}-${row.name}`} style={[styles.step, first && styles.stepFirst]}>
            <Avatar letter={row.name[0]?.toUpperCase() ?? 'R'} size={first ? 64 : 48} frame={row.frame?.colors} />
            <T variant={first ? 'heading' : 'bodyStrong'} numberOfLines={1}>
              {row.is_me ? 'You' : row.name}
            </T>
            <NameBadge badge={row.badge} small />
            <View style={[styles.block, { backgroundColor: medal[row.rank - 1] ?? theme.backgroundSelected, height: first ? 70 : 48 }]}>
              <T variant="title" style={{ color: row.rank === 1 ? theme.onReward : '#FFFFFF' }}>
                {row.rank}
              </T>
            </View>
            <T variant="caption" color="textSecondary">
              {row.approved} approved
            </T>
          </View>
        );
      })}
    </View>
  );
}

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [period, setPeriod] = useState<LeaderPeriod>('week');
  const [scope, setScope] = useState<LeaderScope>(profile?.parish ? 'parish' : 'all');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (s: LeaderScope, p: LeaderPeriod) => {
    setRefreshing(true);
    try {
      setRows(await loadLeaderboard(s, p, 50));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setRows((r) => r ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope, period);
    }, [load, scope, period]),
  );

  const change = (s: LeaderScope, p: LeaderPeriod) => {
    setRows(null);
    setScope(s);
    setPeriod(p);
  };

  const me = rows?.find((r) => r.is_me) ?? null;
  const target = rows ? nextTarget(rows) : null;
  const top = rows?.filter((r) => r.rank <= 3) ?? [];
  const rest = rows?.filter((r) => r.rank > 3) ?? [];
  const where = rows?.[0]?.scope_label ?? (scope === 'parish' && profile?.parish ? profile.parish : 'Jamaica');

  return (
    <Screen
      title="Leaderboard"
      onRefresh={() => load(scope, period)}
      refreshing={refreshing && !!rows}
      header={<Header title="Leaderboard" subtitle={`${period === 'week' ? 'This week' : 'All time'} · ${where}`} />}>
      <Appear style={styles.toggles}>
        <Toggle
          value={period}
          options={[
            { id: 'week', label: 'This week' },
            { id: 'all', label: 'All time' },
          ]}
          onChange={(p) => change(scope, p)}
        />
        <Toggle
          value={scope}
          options={[
            { id: 'parish', label: profile?.parish ?? 'My parish' },
            { id: 'all', label: 'All Jamaica' },
          ]}
          onChange={(s) => change(s, period)}
        />
      </Appear>
      {scope === 'parish' && !profile?.parish ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/edit-profile' as Href)}>
          <Notice tone="info" text="Add your parish in Edit profile to see the board for people near you. Showing all Jamaica for now." />
        </Pressable>
      ) : null}
      {error ? <Notice tone="error" text={error} /> : null}

      {/* Where you stand */}
      {rows ? (
        <Appear index={1}>
          <Card tone="hero" style={styles.you}>
            <IconTile icon="trend" tone="reward" size={44} />
            <View style={styles.flex}>
              <T variant="overline" style={{ color: theme.onAccent, opacity: 0.85 }}>
                Where you stand
              </T>
              <T variant="title" style={{ color: theme.onAccent }}>
                {me ? `#${me.rank} · ${me.approved} approved` : 'Not on the board yet'}
              </T>
              <T variant="small" style={{ color: theme.onAccent }}>
                {!me
                  ? 'Get work approved and you show up here.'
                  : me.rank === 1
                    ? 'You lead! Keep it up to stay on top.'
                    : target
                      ? `${target.need} more approved to pass ${target.name}.`
                      : 'Keep going!'}
              </T>
            </View>
          </Card>
        </Appear>
      ) : null}

      {!rows ? (
        <View style={styles.loading}>
          <Skeleton height={150} radius={20} />
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </View>
      ) : rows.length === 0 ? (
        <Card style={styles.empty}>
          <IconTile icon="trend" tone="reward" size={48} />
          <T variant="heading">No one on the board yet</T>
          <T variant="small" color="textSecondary" style={styles.center}>
            Work counts once other speakers approve it. Be the first!
          </T>
          <Button label="Find work" icon="bolt" href={'/work' as Href} />
        </Card>
      ) : (
        <>
          <Appear index={2}>
            <Podium rows={top} />
          </Appear>
          {rest.length ? (
            <Appear index={3}>
              <Card style={styles.list}>
                {rest.map((row, i) => {
                  const gap = i > 0 && row.rank - rest[i - 1].rank > 1;
                  return (
                    <View key={`${row.rank}-${row.name}-${i}`}>
                      {gap ? (
                        <T variant="caption" color="textSecondary" style={styles.gap}>
                          ···
                        </T>
                      ) : null}
                      <View style={[styles.row, row.is_me && { backgroundColor: theme.accentSoft }]}>
                        <T variant="smallStrong" color="textSecondary" style={styles.rank}>
                          {row.rank}
                        </T>
                        <Avatar letter={row.name[0]?.toUpperCase() ?? 'R'} size={32} frame={row.frame?.colors} />
                        <View style={[styles.flex, styles.name]}>
                          <T variant={row.is_me ? 'bodyStrong' : 'body'}>{row.is_me ? `${row.name} (you)` : row.name}</T>
                          <NameBadge badge={row.badge} small />
                        </View>
                        <T variant="smallStrong">{row.approved}</T>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </Appear>
          ) : null}
        </>
      )}

      <View style={styles.foot}>
        <Icon name="info" size={13} color={theme.textSecondary} />
        <T variant="caption" color="textSecondary" style={styles.flex}>
          Counts approved work only. "This week" starts fresh every Monday. Frames and badges come from the Store.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  toggles: { gap: 8 },
  toggle: { flexDirection: 'row', padding: 4, borderRadius: 999, gap: 4 },
  toggleItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  you: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  loading: { gap: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, paddingTop: 8 },
  step: { flex: 1, alignItems: 'center', gap: 4, maxWidth: 130 },
  stepFirst: { marginBottom: 0 },
  block: { alignSelf: 'stretch', borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  list: { padding: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14 },
  rank: { width: 26, textAlign: 'center' },
  name: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  gap: { textAlign: 'center', paddingVertical: 2 },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});
