import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Confetti, FloatUp } from "@/components/celebrate";
import { DiffText } from "@/components/fix-editor";
import { PostMedia } from "@/components/post-media";
import {
  Appear,
  Button,
  Card,
  Chip,
  Header,
  Icon,
  IconTile,
  Notice,
  Screen,
  T,
  goBack,
  type IconName,
} from "@/components/kit";
import { useTheme } from "@/hooks/use-theme";
import { money } from "@/lib/format";
import { clock } from "@/lib/use-recorder";
import {
  castVote,
  loadVerifyQueue,
  verifyKey,
  type VerifyItem,
  type VerifyQueue,
  type VoteResult,
} from "@/lib/verify";

/** How much of a clip must be heard before you can vote on it. */
const HEARD_FRACTION = 0.9;

type Outcome = {
  key: string;
  item: VerifyItem;
  verdict: "yes" | "no";
  result: VoteResult;
};

/** Wording for each kind of item. */
function describe(item: VerifyItem): {
  label: string;
  icon: IconName;
  question: string;
  yes: string;
  no: string;
} {
  if (item.kind === "description") {
    return {
      label: "Post description",
      icon: "video",
      question: "Does this describe the post, in real Patois?",
      yes: "Yes, it fits",
      no: "No",
    };
  }
  if (item.kind === "recording") {
    return {
      label: "Recorded line",
      icon: "waveform",
      question: "Did they read the line clearly, word for word?",
      yes: "Yes, clear",
      no: "No",
    };
  }
  if (item.type === "transcript") {
    return {
      label: "Voice chat fix",
      icon: "mic",
      question: "Do these words match what you hear?",
      yes: "Yes, it matches",
      no: "No",
    };
  }
  return {
    label: "Chat fix",
    icon: "chat",
    question: "Is the fix real, natural Patois?",
    yes: "Yes, sounds right",
    no: "No",
  };
}

function needsAudio(item: VerifyItem) {
  if (item.kind === "description") return false;
  return (
    item.kind === "recording" ||
    (item.type === "transcript" && !!item.audio_url)
  );
}

/** Play button with progress for a clip someone recorded. */
function Clip({
  playing,
  progress,
  current,
  duration,
  heard,
  onToggle,
}: {
  playing: boolean;
  progress: number;
  current: number;
  duration: number;
  heard: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.clip, { backgroundColor: theme.accentSoft }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause the clip" : "Play the clip"}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.clipButton,
          {
            backgroundColor: theme.accent,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Icon
          name={playing ? "stop" : "play"}
          size={22}
          color={theme.onAccent}
        />
      </Pressable>
      <View style={styles.flex}>
        <View style={[styles.clipTrack, { backgroundColor: theme.background }]}>
          <View
            style={[
              styles.clipFill,
              {
                backgroundColor: theme.accent,
                width: `${Math.round(progress * 100)}%`,
              },
            ]}
          />
        </View>
        <View style={styles.clipLabels}>
          <T variant="caption" color="accentText">
            {heard ? "Heard" : playing ? "Listening..." : "Tap play to listen"}
          </T>
          <T variant="caption" color="accentText">
            {clock(current * 1000)} / {clock(duration * 1000)}
          </T>
        </View>
      </View>
      {heard ? (
        <Icon name="check" size={18} color={theme.accentText} />
      ) : (
        <Icon name="headphones" size={18} color={theme.accentText} />
      )}
    </View>
  );
}

/** One line of text with a small label above it. */
function Said({
  label,
  text,
  tone = "plain",
  struck = false,
}: {
  label: string;
  text: string;
  tone?: "plain" | "main";
  struck?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.said}>
      <T
        variant="overline"
        color={tone === "main" ? "accentText" : "textSecondary"}
      >
        {label}
      </T>
      <T
        variant={tone === "main" ? "title" : "body"}
        color={tone === "main" ? "text" : "textSecondary"}
        style={
          struck
            ? {
                textDecorationLine: "line-through",
                textDecorationColor: theme.danger,
              }
            : undefined
        }
      >
        {text}
      </T>
    </View>
  );
}

/** Exactly what changed, word by word: crossed out = removed, highlighted = added. */
function Changes({
  original,
  fixed,
  label,
}: {
  original: string;
  fixed: string;
  label: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.changes,
        {
          backgroundColor: theme.background,
          borderColor: theme.backgroundSelected,
        },
      ]}
    >
      <T variant="overline" color="textSecondary">
        {label}
      </T>
      <DiffText original={original} fixed={fixed} size="small" />
    </View>
  );
}

export default function VerifyScreen() {
  const theme = useTheme();
  const player = useAudioPlayer();
  const playback = useAudioPlayerStatus(player);

  const [items, setItems] = useState<VerifyItem[] | null>(null);
  const [rates, setRates] = useState<VerifyQueue["rates"] | null>(null);
  const [reason, setReason] = useState<"empty" | "limit" | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [floatLabel, setFloatLabel] = useState("");
  const loadedUri = useRef<string | null>(null);

  /* ---------- Card animation ---------- */
  const cardX = useSharedValue(0);
  const cardY = useSharedValue(0);
  const cardTilt = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: cardX.value },
      { translateY: cardY.value },
      { rotate: `${cardTilt.value}deg` },
    ],
  }));

  /** Yes flicks right, no flicks left, skip drops down. */
  const nextCard = (direction: 1 | -1 | 0) => {
    if (direction === 0) cardY.value = withTiming(40, { duration: 220 });
    else {
      cardX.value = withTiming(direction * 420, {
        duration: 260,
        easing: Easing.in(Easing.quad),
      });
      cardTilt.value = withTiming(direction * 12, { duration: 260 });
    }
    cardOpacity.value = withTiming(0, { duration: 240 });
    setTimeout(() => {
      setIndex((i) => i + 1);
      cardX.value = 0;
      cardTilt.value = 0;
      cardY.value = 18;
      cardOpacity.value = withTiming(1, { duration: 180 });
      cardY.value = withSpring(0, { damping: 14 });
    }, 270);
  };

  /* ---------- Loading ---------- */
  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    setIndex(0);
    setOutcomes([]);
    setSkipped(0);
    setHeard(new Set());
    try {
      const queue = await loadVerifyQueue();
      setItems(queue.items);
      setRates(queue.rates);
      setReason(queue.reason);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const item = items?.[index];
  const key = item ? verifyKey(item) : "";
  const audioUrl =
    item && item.kind !== "description" ? item.audio_url ?? null : null;

  /* ---------- Playback ---------- */
  const isLoaded = !!audioUrl && loadedUri.current === audioUrl;
  const duration = isLoaded
    ? playback.duration || 0
    : item?.kind === "recording"
      ? item.duration_ms / 1000
      : 0;
  const current = isLoaded ? playback.currentTime : 0;
  const progress = duration ? Math.min(1, current / duration) : 0;
  const playing = isLoaded && playback.playing;

  useEffect(() => {
    if (!isLoaded || !key) return;
    if (
      playback.didJustFinish ||
      (duration && current / duration >= HEARD_FRACTION)
    ) {
      setHeard((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    }
  }, [isLoaded, key, playback.didJustFinish, current, duration]);

  const toggleClip = () => {
    if (!audioUrl) return;
    if (loadedUri.current !== audioUrl) {
      player.replace({ uri: audioUrl });
      loadedUri.current = audioUrl;
      player.play();
      return;
    }
    if (playback.playing) player.pause();
    else {
      if (playback.didJustFinish || (duration && current >= duration - 0.05))
        player.seekTo(0);
      player.play();
    }
  };

  const stopClip = () => {
    if (playback.playing) player.pause();
  };

  /* ---------- Voting ---------- */
  const mustListen = !!item && needsAudio(item) && !heard.has(key);

  const vote = async (verdict: "yes" | "no") => {
    if (!item || voting) return;
    if (mustListen) return setError("Listen to the clip first, then vote.");
    stopClip();
    setVoting(verdict);
    setError(null);
    try {
      const result = await castVote(item, verdict);
      setOutcomes((prev) => [...prev, { key, item, verdict, result }]);
      setFloatLabel(
        result.status === "approved"
          ? `+${money(result.amount_jmd, 0)} matched!`
          : result.status === "rejected"
            ? "Didn't match"
            : `+${money(result.amount_jmd, 0)} pending`,
      );
      setBurst((b) => b + 1);
      nextCard(verdict === "yes" ? 1 : -1);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      // Settled by others or already voted: nothing to do here, so move on.
      if (/already/i.test(message)) setTimeout(() => nextCard(0), 900);
    } finally {
      setVoting(null);
    }
  };

  const skip = () => {
    stopClip();
    setError(null);
    setSkipped((s) => s + 1);
    nextCard(0);
  };

  const matched = outcomes.filter((o) => o.result.status === "approved");
  const waiting = outcomes.filter((o) => o.result.status === "pending");
  const missed = outcomes.filter((o) => o.result.status === "rejected");
  const earnedNow = matched.reduce((sum, o) => sum + o.result.amount_jmd, 0);
  const earnedLater = waiting.reduce((sum, o) => sum + o.result.amount_jmd, 0);

  /* ---------- Loading screen ---------- */
  if (!items) {
    return (
      <Screen title="Verify" header={<Header title="Verify work" />}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
          <T variant="small" color="textSecondary">
            Finding work to check...
          </T>
        </View>
      </Screen>
    );
  }

  /* ---------- Finished, or nothing to check ---------- */
  if (!item) {
    const finished = outcomes.length > 0;
    return (
      <Screen
        title="Verify"
        header={
          <Header
            title="Verify work"
            subtitle={finished ? "Set complete" : "All caught up"}
          />
        }
        footer={
          <View style={styles.footerGap}>
            {finished || skipped > 0 || error ? (
              <Button label="Check more" icon="check" onPress={load} />
            ) : null}
            <Button
              label="Back to work"
              variant={finished ? "secondary" : "primary"}
              onPress={goBack}
            />
          </View>
        }
      >
        <Confetti burst={finished ? 1 : 0} />
        {error ? <Notice tone="error" text={error} /> : null}
        <Appear>
          <Card tone="hero" style={styles.recap}>
            <T variant="overline" style={{ color: theme.onAccent }}>
              {finished
                ? "Thanks for checking"
                : reason === "limit"
                  ? "Today's checks done"
                  : "Nothing to check"}
            </T>
            <T variant="display" style={{ color: theme.onAccent }}>
              {finished
                ? `+${money(earnedNow + earnedLater, 0)}`
                : reason === "limit"
                  ? "Big up!"
                  : "All quiet"}
            </T>
            <T variant="body" style={{ color: theme.onAccent }}>
              {finished
                ? `You checked ${outcomes.length} ${outcomes.length === 1 ? "item" : "items"}. Votes that match other speakers get paid.`
                : reason === "limit"
                  ? "You've reached today's limit. Come back tomorrow for more."
                  : "When other people record lines and fix the AI, their work shows up here for you to check."}
            </T>
          </Card>
        </Appear>

        {finished ? (
          <>
            <Appear index={1} style={styles.tally}>
              {[
                {
                  label: "Matched",
                  value: matched.length,
                  sub: money(earnedNow, 0),
                  color: theme.accentText,
                  icon: "check" as IconName,
                },
                {
                  label: "Waiting",
                  value: waiting.length,
                  sub: money(earnedLater, 0),
                  color: theme.rewardText,
                  icon: "sparkles" as IconName,
                },
                {
                  label: "No match",
                  value: missed.length,
                  sub: "J$0",
                  color: theme.textSecondary,
                  icon: "back" as IconName,
                },
              ].map((cell) => (
                <View
                  key={cell.label}
                  style={[
                    styles.tallyCell,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                >
                  <Icon name={cell.icon} size={16} color={cell.color} />
                  <T variant="title" style={{ color: cell.color }}>
                    {cell.value}
                  </T>
                  <T variant="caption" color="textSecondary">
                    {cell.label} · {cell.sub}
                  </T>
                </View>
              ))}
            </Appear>
            <T variant="small" color="textSecondary">
              "Waiting" votes are paid when another speaker agrees with you.
              You'll see it on Home.
            </T>
            {outcomes.map((o, i) => {
              const text =
                o.item.kind === "correction" ? o.item.corrected : o.item.text;
              const status = o.result.status;
              return (
                <Appear key={o.key} index={i + 2}>
                  <View
                    style={[
                      styles.recapRow,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <IconTile
                      icon={describe(o.item).icon}
                      tone={status === "pending" ? "reward" : "accent"}
                      size={36}
                    />
                    <View style={styles.flex}>
                      <T variant="bodyStrong" numberOfLines={2}>
                        {text}
                      </T>
                      <T variant="caption" color="textSecondary">
                        You said {o.verdict === "yes" ? "yes" : "no"} ·{" "}
                        {status === "approved"
                          ? "matched"
                          : status === "rejected"
                            ? "others disagreed"
                            : "waiting for others"}
                      </T>
                    </View>
                    <T
                      variant="smallStrong"
                      color={
                        status === "rejected" ? "textSecondary" : "rewardText"
                      }
                    >
                      {status === "rejected"
                        ? "J$0"
                        : `+${money(o.result.amount_jmd, 0)}`}
                    </T>
                  </View>
                </Appear>
              );
            })}
          </>
        ) : null}
      </Screen>
    );
  }

  /* ---------- Checking an item ---------- */
  const words = describe(item);
  const deck = items.slice(index + 1, index + 3);

  return (
    <Screen
      title="Verify"
      header={
        <Header
          title="Verify work"
          subtitle={
            rates && rates[item.kind]
              ? `${money(rates[item.kind], 0)} for this one if your vote matches`
              : `${index + 1} of ${items.length}`
          }
          right={<Chip label={`${money(earnedNow + earnedLater, 0)} so far`} />}
        />
      }
      footer={
        <View style={styles.footerGap}>
          <View style={styles.voteRow}>
            <Button
              label={voting === "no" ? "Saving..." : words.no}
              icon="back"
              variant="secondary"
              style={styles.flex}
              disabled={!!voting || mustListen}
              onPress={() => vote("no")}
            />
            <Button
              label={voting === "yes" ? "Saving..." : words.yes}
              icon="check"
              style={styles.flex2}
              disabled={!!voting || mustListen}
              onPress={() => vote("yes")}
            />
          </View>
          <Button
            label={mustListen ? "Listen to the clip to vote · Skip" : "Skip"}
            variant="ghost"
            compact
            disabled={!!voting}
            onPress={skip}
          />
        </View>
      }
    >
      <View style={styles.progressBlock}>
        <View style={styles.progressTop}>
          <T variant="smallStrong">
            {index + 1}{" "}
            <T variant="small" color="textSecondary">
              of {items.length}
            </T>
          </T>
          {matched.length >= 2 ? (
            <Chip
              tone="reward"
              icon="flame"
              label={`${matched.length} matched`}
            />
          ) : null}
        </View>
        <View
          style={styles.progress}
          accessibilityLabel={`Item ${index + 1} of ${items.length}`}
        >
          {items.map((it, i) => {
            const done = outcomes.find((o) => o.key === verifyKey(it));
            const color = done
              ? done.result.status === "rejected"
                ? theme.textSecondary
                : theme.accent
              : i === index
                ? theme.reward
                : theme.backgroundSelected;
            return (
              <View
                key={verifyKey(it)}
                style={[styles.segment, { backgroundColor: color }]}
              />
            );
          })}
        </View>
        <FloatUp trigger={burst} label={floatLabel} />
      </View>

      {error ? <Notice tone="error" text={error} /> : null}

      <View style={styles.deck}>
        {deck
          .map((next, i) => (
            <View
              key={verifyKey(next)}
              pointerEvents="none"
              style={[
                styles.deckCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                  transform: [
                    { translateY: 10 * (i + 1) },
                    { scale: 1 - 0.04 * (i + 1) },
                  ],
                  opacity: 0.7 - i * 0.25,
                },
              ]}
            />
          ))
          .reverse()}
        <Animated.View style={cardStyle}>
          <Card style={styles.card}>
            <View style={styles.cardTop}>
              <IconTile
                icon={words.icon}
                size={36}
                tone={item.kind === "recording" ? "reward" : "accent"}
              />
              <T variant="overline" color="accentText" style={styles.flex}>
                {words.label}
              </T>
              {item.kind === "recording" && item.fixed ? (
                <Chip tone="soft" icon="edit" label="They fixed the AI" />
              ) : null}
            </View>

            {item.kind === "description" ? (
              <>
                <PostMedia
                  kind={item.media_kind}
                  url={item.media_url}
                  rounded={16}
                />
                {item.caption ? (
                  <T variant="caption" color="textSecondary">
                    Caption: {item.caption}
                  </T>
                ) : null}
                <Said
                  label="They described it as"
                  text={item.text}
                  tone="main"
                />
              </>
            ) : item.kind === "recording" ? (
              <>
                <Said label="They were reading" text={item.text} tone="main" />
                {item.fixed && item.original ? (
                  <Changes
                    label="How they changed the AI's line"
                    original={item.original}
                    fixed={item.text}
                  />
                ) : null}
              </>
            ) : item.type === "transcript" ? (
              <>
                <Said
                  label="They say they said"
                  text={item.corrected}
                  tone="main"
                />
                <Changes
                  label="Changed from what speech-to-text heard"
                  original={item.original}
                  fixed={item.corrected}
                />
              </>
            ) : (
              <>
                {item.context ? (
                  <View
                    style={[
                      styles.context,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  >
                    <T variant="caption" color="textSecondary">
                      They said
                    </T>
                    <T variant="small">{item.context}</T>
                  </View>
                ) : null}
                <Said
                  label="They fixed the AI's reply to"
                  text={item.corrected}
                  tone="main"
                />
                <Changes
                  label="What they changed"
                  original={item.original}
                  fixed={item.corrected}
                />
              </>
            )}

            {audioUrl ? (
              <Clip
                playing={playing}
                progress={progress}
                current={current}
                duration={duration}
                heard={heard.has(key)}
                onToggle={toggleClip}
              />
            ) : null}
          </Card>
        </Animated.View>
        <Confetti burst={burst} />
      </View>

      <View style={[styles.question, { backgroundColor: theme.rewardSoft }]}>
        <Icon name="sparkles" size={18} color={theme.rewardText} />
        <View style={styles.flex}>
          <T variant="bodyStrong" color="rewardText">
            {words.question}
          </T>
          <T variant="caption" color="rewardText">
            {mustListen
              ? "Play the clip first. The vote buttons unlock once you have heard it."
              : "Be honest: you get paid when your vote matches other speakers."}
          </T>
        </View>
      </View>
      <T variant="small" color="textSecondary">
        <Text style={{ fontWeight: "700" }}>Tip:</Text> spelling can differ (yuh
        / you, di / the). Say no only when the words or meaning are wrong, or it
        doesn't sound like real Patois.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 1.6 },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  footerGap: { gap: 8 },
  voteRow: { flexDirection: "row", gap: 10 },
  progressBlock: { gap: 8 },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 30,
  },
  progress: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  deck: { paddingBottom: 20 },
  deckCard: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 20,
    borderRadius: 22,
    borderWidth: 1,
  },
  card: { gap: 14, padding: 20, minHeight: 200 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  said: { gap: 4 },
  changes: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1 },
  context: { gap: 2, padding: 12, borderRadius: 14, borderWidth: 1 },
  clip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
  },
  clipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  clipTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  clipFill: { height: 8, borderRadius: 4 },
  clipLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  question: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 18,
  },
  recap: { gap: 6, padding: 22 },
  tally: { flexDirection: "row", gap: 10 },
  tallyCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
});
