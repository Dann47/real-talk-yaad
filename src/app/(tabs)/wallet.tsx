import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear, Button, Card, Icon, IconTile, Notice, ProgressBar, Screen, SectionHeader, T, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { money } from '@/lib/format';
import { cancelPayout, dayLabel, methodLabel, useWallet, type EarningRow, type Payout, type PayoutStatus } from '@/lib/wallet';
import { HIDDEN, useHideAmounts } from '@/lib/hide-amounts';

/** Counts up to a new amount instead of jumping (and down after a cash-out). */
function useCountUp(target: number | undefined, duration = 700) {
  const [value, setValue] = useState(target ?? 0);
  const from = useRef(target ?? 0);
  useEffect(() => {
    if (target === undefined) return;
    const start = from.current;
    const began = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(start + (target - start) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const fullDate = (iso: string) =>
  new Intl.DateTimeFormat('en-JM', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Jamaica',
  }).format(new Date(iso));

const DASH = '—';
const PAGE = 25;

type Filter = 'all' | 'earned' | 'review' | 'cashouts';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Paid' },
  { id: 'review', label: 'In review' },
  { id: 'cashouts', label: 'Cash-outs' },
];

const TASK: Record<string, { icon: IconName; label: string; short: string }> = {
  talk: { icon: 'chat', label: 'Fixed the AI', short: 'Talk' },
  voice: { icon: 'mic', label: 'Voice chat fix', short: 'Voice' },
  record: { icon: 'waveform', label: 'Recorded a line', short: 'Record' },
  verify: { icon: 'check', label: 'Checked work', short: 'Verify' },
  teach: { icon: 'video', label: 'Described a post', short: 'Teach' },
};

/** This month's earnings by kind of work, as one bar. */
function MonthBreakdown({ earnings, hidden }: { earnings: EarningRow[]; hidden: boolean }) {
  const theme = useTheme();
  const colours: Record<string, string> = {
    talk: theme.accent,
    voice: theme.accentText,
    record: theme.reward,
    verify: theme.rewardText,
    teach: theme.danger,
  };
  const monthKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica', year: 'numeric', month: '2-digit' }).format(new Date(iso));
  const thisMonth = monthKey(new Date().toISOString());
  const byTask = new Map<string, number>();
  for (const e of earnings) {
    if (e.status === 'rejected' || monthKey(e.created_at) !== thisMonth) continue;
    byTask.set(e.task, (byTask.get(e.task) ?? 0) + e.amount_jmd);
  }
  const total = [...byTask.values()].reduce((a, b) => a + b, 0);
  const monthName = new Intl.DateTimeFormat('en-JM', { month: 'long', timeZone: 'America/Jamaica' }).format(new Date());
  const parts = [...byTask.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card style={styles.month}>
      <View style={styles.monthTop}>
        <View style={styles.flex}>
          <T variant="overline" color="textSecondary">
            Earned in {monthName}
          </T>
          <T variant="title">{hidden ? HIDDEN : money(total, 0)}</T>
        </View>
        <T variant="caption" color="textSecondary">
          Paid + in review
        </T>
      </View>
      {total > 0 ? (
        <>
          <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
            {parts.map(([task, amount]) => (
              <View key={task} style={{ flex: amount, backgroundColor: colours[task] ?? theme.textSecondary }} />
            ))}
          </View>
          <View style={styles.legend}>
            {parts.map(([task, amount]) => (
              <View key={task} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colours[task] ?? theme.textSecondary }]} />
                <T variant="caption" color="textSecondary">
                  {TASK[task]?.short ?? task} {hidden ? '' : money(amount, 0)}
                </T>
              </View>
            ))}
          </View>
        </>
      ) : (
        <T variant="caption" color="textSecondary">
          Nothing yet this month. Every task you do adds to this bar.
        </T>
      )}
    </Card>
  );
}

const PAYOUT_TEXT: Record<PayoutStatus, string> = {
  requested: 'Requested',
  processing: 'Being paid',
  paid: 'Paid',
  failed: 'Failed · money returned',
  cancelled: 'Cancelled',
};

type Line =
  | { kind: 'earning'; key: string; at: string; row: EarningRow }
  | { kind: 'payout'; key: string; at: string; row: Payout };

function StatusPill({ tone, label }: { tone: 'good' | 'wait' | 'off'; label: string }) {
  const theme = useTheme();
  const look = {
    good: { bg: theme.accentSoft, fg: theme.accentText },
    wait: { bg: theme.rewardSoft, fg: theme.rewardText },
    off: { bg: theme.backgroundSelected, fg: theme.textSecondary },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]}>
      <T variant="caption" style={{ color: look.fg }}>
        {label}
      </T>
    </View>
  );
}

/** Requested → Being paid → Paid, for the cash-out on the way. */
function PayoutSteps({ status }: { status: PayoutStatus }) {
  const theme = useTheme();
  const steps = ['Requested', 'Being paid', 'Paid'];
  const at = status === 'paid' ? 2 : status === 'processing' ? 1 : 0;
  return (
    <View style={styles.steps}>
      {steps.map((step, i) => (
        <View key={step} style={styles.step}>
          <View style={styles.stepTop}>
            {i > 0 ? <View style={[styles.stepLine, { backgroundColor: i <= at ? theme.accent : theme.backgroundSelected }]} /> : <View style={styles.stepLineSpacer} />}
            <View style={[styles.stepDot, { backgroundColor: i <= at ? theme.accent : theme.backgroundSelected }]}>
              {i < at || (i === at && status === 'paid') ? <Icon name="check" size={12} color={theme.onAccent} /> : null}
            </View>
            {i < steps.length - 1 ? (
              <View style={[styles.stepLine, { backgroundColor: i < at ? theme.accent : theme.backgroundSelected }]} />
            ) : (
              <View style={styles.stepLineSpacer} />
            )}
          </View>
          <T variant="caption" color={i <= at ? 'accentText' : 'textSecondary'}>
            {step}
          </T>
        </View>
      ))}
    </View>
  );
}

/** Everything about one history item. */
function DetailSheet({
  line,
  onClose,
  onCancel,
  cancelling,
}: {
  line: Line | null;
  onClose: () => void;
  onCancel: (p: Payout) => void;
  cancelling: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!line) return null;
  const isPayout = line.kind === 'payout';
  const rows: { label: string; value: string }[] = [];
  let title = '';
  let amount = '';
  let status = '';
  let explain = '';
  if (line.kind === 'payout') {
    const p = line.row;
    title = 'Cash out';
    amount = `−${money(p.amount_jmd)}`;
    status = PAYOUT_TEXT[p.status];
    rows.push({ label: 'Sent to', value: methodLabel(p.method) });
    if (p.method.holder_name) rows.push({ label: 'Name', value: p.method.holder_name });
    if (p.fee_jmd) rows.push({ label: 'Fee', value: money(p.fee_jmd) });
    rows.push({ label: 'You get', value: money(p.amount_jmd - p.fee_jmd) });
    rows.push({ label: 'Requested', value: fullDate(p.created_at) });
    if (p.note) rows.push({ label: 'Note', value: p.note });
    rows.push({ label: 'Reference', value: `RTY-${String(p.id).padStart(6, '0')}` });
    explain =
      p.status === 'failed'
        ? 'This cash-out did not go through, so the money is back in your balance.'
        : p.status === 'cancelled'
          ? 'You cancelled this cash-out. The money is back in your balance.'
          : p.status === 'paid'
            ? 'Paid. If you can’t see it in your account after 3 working days, contact us with the reference.'
            : 'On its way. It leaves your available balance until it is paid.';
  } else {
    const e = line.row;
    title = TASK[e.task]?.label ?? 'Work';
    amount = `+${money(e.amount_jmd)}`;
    status = e.status === 'approved' ? 'Paid to your balance' : e.status === 'pending' ? 'In review' : 'Not approved';
    if (e.detail) rows.push({ label: 'What you did', value: e.detail });
    rows.push({ label: 'When', value: fullDate(e.created_at) });
    explain =
      e.status === 'approved'
        ? 'Other speakers agreed, so this is in your balance.'
        : e.status === 'pending'
          ? 'Waiting for other speakers to check it. Once they agree, it moves into your balance.'
          : "Other speakers didn't agree with this one, so it wasn't paid. It doesn't count against you.";
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
        <View style={styles.sheetTop}>
          <IconTile icon={isPayout ? 'cashout' : (TASK[(line.row as EarningRow).task]?.icon ?? 'sparkles')} tone={isPayout ? 'reward' : 'accent'} size={44} />
          <View style={styles.flex}>
            <T variant="heading">{title}</T>
            <T variant="caption" color="textSecondary">
              {status}
            </T>
          </View>
          <T variant="title" color={isPayout ? 'text' : 'rewardText'}>
            {amount}
          </T>
        </View>
        <Card style={styles.sheetRows}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.sheetRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
              <T variant="small" color="textSecondary">
                {r.label}
              </T>
              <T variant="smallStrong" style={styles.sheetValue}>
                {r.value}
              </T>
            </View>
          ))}
        </Card>
        <View style={[styles.explain, { backgroundColor: theme.accentSoft }]}>
          <Icon name="info" size={16} color={theme.accentText} />
          <T variant="small" style={styles.flex}>
            {explain}
          </T>
        </View>
        {line.kind === 'payout' && line.row.status === 'requested' ? (
          <Button
            label={cancelling ? 'Cancelling...' : 'Cancel this cash-out'}
            variant="secondary"
            disabled={cancelling}
            onPress={() => onCancel(line.row as Payout)}
          />
        ) : null}
        <Button label="Close" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

export default function WalletScreen() {
  const theme = useTheme();
  const { data, error, refreshing, refresh } = useWallet();
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hidden, toggleHidden] = useHideAmounts();
  const [selected, setSelected] = useState<Line | null>(null);

  const summary = data?.summary;
  const method = data?.method ?? null;
  const onTheWay = data?.payouts.find((p) => p.status === 'requested' || p.status === 'processing') ?? null;
  const short = summary ? Math.max(0, summary.minCashout - summary.available) : 0;
  const canCashOut = !!summary && !onTheWay && short === 0 && summary.available > summary.fee;
  const shownBalance = useCountUp(summary?.available);
  const lockedReason = !summary
    ? null
    : onTheWay
      ? 'One cash-out at a time. You can cash out again once this one is paid.'
      : short > 0
        ? null // the progress bar explains it
        : summary.available <= summary.fee
          ? 'Your balance is smaller than the cash-out fee.'
          : null;

  const lines = useMemo<Line[]>(() => {
    if (!data) return [];
    const earned: Line[] = data.earnings.map((row) => ({ kind: 'earning', key: `e-${row.task}-${row.ref_id}`, at: row.created_at, row }));
    const paid: Line[] = data.payouts.map((row) => ({ kind: 'payout', key: `p-${row.id}`, at: row.created_at, row }));
    const all = [...earned, ...paid].sort((a, b) => (a.at < b.at ? 1 : -1));
    return all.filter((line) => {
      if (filter === 'cashouts') return line.kind === 'payout';
      if (filter === 'earned') return line.kind === 'earning' && line.row.status === 'approved';
      if (filter === 'review') return line.kind === 'earning' && line.row.status === 'pending';
      return true;
    });
  }, [data, filter]);

  const counts = useMemo(() => {
    if (!data) return {} as Record<Filter, number>;
    return {
      all: data.earnings.length + data.payouts.length,
      earned: data.earnings.filter((e) => e.status === 'approved').length,
      review: data.earnings.filter((e) => e.status === 'pending').length,
      cashouts: data.payouts.length,
    } as Record<Filter, number>;
  }, [data]);

  // Group the visible lines by day.
  const groups = useMemo(() => {
    const out: { day: string; lines: Line[] }[] = [];
    for (const line of lines.slice(0, shown)) {
      const day = dayLabel(line.at);
      const last = out[out.length - 1];
      if (last?.day === day) last.lines.push(line);
      else out.push({ day, lines: [line] });
    }
    return out;
  }, [lines, shown]);

  const cancel = async (payout: Payout | null = onTheWay) => {
    if (!payout) return;
    setCancelling(true);
    setActionError(null);
    try {
      await cancelPayout(payout.id);
      setSelected(null);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen tabs title="Wallet" onRefresh={refresh} refreshing={refreshing && !!data}>
      <Appear>
        <T variant="title">Wallet</T>
      </Appear>

      {error ? (
        <Pressable accessibilityRole="button" onPress={refresh}>
          <Notice tone="error" text={`${error} Tap to try again.`} />
        </Pressable>
      ) : null}

      {/* Balance */}
      <Appear index={1}>
        <Card tone="hero" style={styles.hero}>
          <View style={styles.heroTop}>
            <T variant="overline" style={[styles.flex, { color: theme.onAccent, opacity: 0.85 }]}>
              Available to cash out
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
              onPress={toggleHidden}
              hitSlop={10}
              style={[styles.eye, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
              <Icon name={hidden ? 'eye' : 'eyeOff'} size={16} color={theme.onAccent} />
            </Pressable>
          </View>
          <T variant="display" style={{ color: theme.onAccent }} accessibilityLabel={hidden ? 'Balance hidden' : undefined}>
            {!summary ? DASH : hidden ? HIDDEN : money(shownBalance)}
          </T>
          <T variant="small" style={{ color: theme.onAccent }}>
            {!summary
              ? 'Loading your wallet...'
              : hidden
                ? 'Amounts hidden · tap the eye to show them'
                : [
                  summary.pending ? `${money(summary.pending, 0)} in review` : null,
                  summary.onTheWay ? `${money(summary.onTheWay, 0)} on the way to you` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Everything you earn shows up here'}
          </T>
          {summary && short > 0 ? (
            <View style={styles.minBlock}>
              <ProgressBar value={summary.available / summary.minCashout} label="Progress to the smallest cash-out" color={theme.reward} />
              <T variant="caption" style={{ color: theme.onAccent }}>
                {hidden
                  ? 'Keep going to reach the smallest cash-out'
                  : `${money(short, 0)} more to cash out (smallest cash-out is ${money(summary.minCashout, 0)})`}
              </T>
            </View>
          ) : null}
          <View style={styles.heroButtons}>
            <Button
              label="Cash out"
              icon="cashout"
              variant="reward"
              compact
              disabled={!canCashOut}
              onPress={() => router.push((method ? '/cash-out' : '/payout-method?next=cash-out') as Href)}
              style={styles.flex}
            />
            <Button label="Store" icon="bag" variant="onAccent" compact href={'/store' as Href} style={styles.flex} />
          </View>
          {lockedReason ? (
            <View style={styles.locked}>
              <Icon name="info" size={13} color={theme.onAccent} />
              <T variant="caption" style={[styles.flex, { color: theme.onAccent }]}>
                {lockedReason}
              </T>
            </View>
          ) : null}
        </Card>
      </Appear>

      {actionError ? <Notice tone="error" text={actionError} /> : null}

      {/* Cash-out on the way */}
      {onTheWay ? (
        <Appear index={2}>
          <Card style={styles.onTheWay}>
            <View style={styles.row}>
              <IconTile icon="cashout" tone="reward" size={40} />
              <View style={styles.flex}>
                <T variant="bodyStrong">{money(onTheWay.amount_jmd - onTheWay.fee_jmd)} on the way</T>
                <T variant="caption" color="textSecondary" numberOfLines={1}>
                  To {methodLabel(onTheWay.method)} · {dayLabel(onTheWay.created_at)}
                </T>
              </View>
            </View>
            <PayoutSteps status={onTheWay.status} />
            <T variant="caption" color="textSecondary">
              {summary?.payoutsLive
                ? 'Payouts usually arrive within 1 to 3 working days.'
                : 'During testing, cash-outs are paid by hand. You will see it change to Paid here.'}
            </T>
            {onTheWay.status === 'requested' ? (
              <Button label={cancelling ? 'Cancelling...' : 'Cancel this cash-out'} variant="ghost" compact disabled={cancelling} onPress={() => cancel()} />
            ) : null}
          </Card>
        </Appear>
      ) : null}

      {/* Payout method */}
      <Appear index={3}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={method ? `Payout method: ${methodLabel(method)}. Change it` : 'Add a payout method'}
          onPress={() => router.push('/payout-method' as Href)}
          style={({ pressed }) => [
            styles.method,
            {
              backgroundColor: method ? theme.backgroundElement : theme.accentSoft,
              borderColor: method ? theme.backgroundSelected : theme.accent,
              borderStyle: method ? 'solid' : 'dashed',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}>
          <IconTile icon={method ? 'wallet' : 'plus'} size={40} />
          <View style={styles.flex}>
            <T variant="bodyStrong">{method ? methodLabel(method) : 'Add a payout method'}</T>
            <T variant="caption" color="textSecondary">
              {method ? `${method.holder_name} · Tap to change` : 'Your bank account or Lynk wallet'}
            </T>
          </View>
          <Icon name="chevron" size={16} color={theme.textSecondary} />
        </Pressable>
      </Appear>

      {/* This month */}
      {data ? (
        <Appear index={4}>
          <MonthBreakdown earnings={data.earnings} hidden={hidden} />
        </Appear>
      ) : null}
      {summary && (summary.lifetime > 0 || summary.paidOut > 0) ? (
        <Appear index={4} style={styles.lifetime}>
          <T variant="caption" color="textSecondary">
            All time: {hidden ? HIDDEN : money(summary.lifetime, 0)} earned · {hidden ? HIDDEN : money(summary.paidOut, 0)} cashed out
          </T>
        </Appear>
      ) : null}

      {/* History */}
      <Appear index={5}>
        <SectionHeader title="History" />
      </Appear>
      <Appear index={5} style={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setFilter(f.id);
                setShown(PAGE);
              }}
              style={[styles.filter, { backgroundColor: on ? theme.accent : theme.backgroundElement, borderColor: on ? theme.accent : theme.backgroundSelected }]}>
              <T variant="smallStrong" style={{ color: on ? theme.onAccent : theme.text }}>
                {f.label}
                {counts[f.id] ? <T variant="caption" style={{ color: on ? theme.onAccent : theme.textSecondary }}>{`  ${counts[f.id]}`}</T> : null}
              </T>
            </Pressable>
          );
        })}
      </Appear>

      {data && !lines.length ? (
        <Card style={styles.empty}>
          <IconTile icon="wallet" tone="reward" size={44} />
          <T variant="bodyStrong">Nothing here yet</T>
          <T variant="caption" color="textSecondary" style={styles.center}>
            {filter === 'cashouts' ? 'Your cash-outs will show here.' : 'Do a task from Work and it shows up here right away.'}
          </T>
        </Card>
      ) : null}

      {groups.map((group, gi) => (
        <Appear key={group.day} index={6 + gi} style={styles.group}>
          <T variant="overline" color="textSecondary">
            {group.day}
          </T>
          <Card style={styles.history}>
            {group.lines.map((line, i) => {
              const divider = i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected };
              if (line.kind === 'payout') {
                const p = line.row;
                const gone = p.status === 'failed' || p.status === 'cancelled';
                return (
                  <Pressable
                    key={line.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Cash out ${money(p.amount_jmd, 0)}, ${PAYOUT_TEXT[p.status]}. Details`}
                    onPress={() => setSelected(line)}
                    style={({ pressed }) => [styles.historyRow, divider, { opacity: pressed ? 0.6 : 1 }]}>
                    <IconTile icon="cashout" tone="reward" size={36} />
                    <View style={styles.flex}>
                      <T variant="bodyStrong" numberOfLines={1}>
                        Cash out
                      </T>
                      <T variant="caption" color="textSecondary" numberOfLines={1}>
                        {methodLabel(p.method)}
                        {p.note ? ` · ${p.note}` : ''}
                      </T>
                    </View>
                    <View style={styles.right}>
                      <T variant="smallStrong" color={gone ? 'textSecondary' : 'text'} style={gone ? styles.struck : undefined}>
                        {hidden ? '−J$ •••' : `−${money(p.amount_jmd, 0)}`}
                      </T>
                      <StatusPill tone={p.status === 'paid' ? 'good' : gone ? 'off' : 'wait'} label={PAYOUT_TEXT[p.status]} />
                    </View>
                  </Pressable>
                );
              }
              const e = line.row;
              const task = TASK[e.task] ?? { icon: 'sparkles' as IconName, label: 'Work' };
              return (
                <Pressable
                  key={line.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${task.label}, ${money(e.amount_jmd, 0)}. Details`}
                  onPress={() => setSelected(line)}
                  style={({ pressed }) => [styles.historyRow, divider, { opacity: pressed ? 0.6 : 1 }]}>
                  <IconTile icon={task.icon} tone={e.task === 'record' ? 'reward' : 'accent'} size={36} />
                  <View style={styles.flex}>
                    <T variant="bodyStrong" numberOfLines={1}>
                      {task.label}
                    </T>
                    {e.detail ? (
                      <T variant="caption" color="textSecondary" numberOfLines={1}>
                        {e.detail}
                      </T>
                    ) : null}
                  </View>
                  <View style={styles.right}>
                    <T
                      variant="smallStrong"
                      color={e.status === 'rejected' ? 'textSecondary' : e.status === 'approved' ? 'accentText' : 'rewardText'}
                      style={e.status === 'rejected' ? styles.struck : undefined}>
                      {hidden ? '+J$ •••' : `+${money(e.amount_jmd, 0)}`}
                    </T>
                    <StatusPill
                      tone={e.status === 'approved' ? 'good' : e.status === 'pending' ? 'wait' : 'off'}
                      label={e.status === 'approved' ? 'Paid' : e.status === 'pending' ? 'In review' : 'Not approved'}
                    />
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </Appear>
      ))}

      {lines.length > shown ? <Button label={`Show more (${lines.length - shown})`} variant="secondary" onPress={() => setShown((n) => n + PAGE)} /> : null}

      <T variant="caption" color="textSecondary" style={styles.center}>
        "Paid" work counts toward your balance. "In review" is added once other speakers agree.
      </T>
      <DetailSheet line={selected} onClose={() => setSelected(null)} onCancel={(p) => cancel(p)} cancelling={cancelling} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  struck: { textDecorationLine: 'line-through' },
  hero: { gap: 4, padding: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eye: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  month: { gap: 12 },
  monthTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  lifetime: { alignItems: 'center', marginTop: -6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { gap: 14, paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 720, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetRows: { padding: 4 },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 11, paddingHorizontal: 12 },
  sheetValue: { flex: 1, textAlign: 'right' },
  explain: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 14 },
  minBlock: { gap: 6, marginTop: 12 },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  onTheWay: { gap: 14 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepTop: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 3, borderRadius: 2 },
  stepLineSpacer: { flex: 1 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  group: { gap: 6 },
  history: { padding: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
  right: { alignItems: 'flex-end', gap: 4 },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
});
