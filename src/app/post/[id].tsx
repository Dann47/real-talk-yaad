import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Confetti, FloatUp } from '@/components/celebrate';
import { Appear, Avatar, Button, Card, Header, Icon, IconTile, Notice, Screen, T, inputText } from '@/components/kit';
import { PostActions } from '@/components/post-actions';
import { PostMedia } from '@/components/post-media';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { useRates } from '@/lib/rates';
import {
  MAX_DESCRIPTION,
  MIN_DESCRIPTION_WORDS,
  addDescription,
  descriptionProblem,
  loadDescriptions,
  loadPost,
  setLiked,
  timeAgo,
  type Description,
  type FeedPost,
} from '@/lib/teach';

const PROMPTS = ['Who is there?', 'What are they doing?', 'Where is it?', 'How does it feel?'];

const STATUS: Record<Description['status'], { label: string; tone: 'good' | 'wait' | 'off' }> = {
  pending: { label: 'In review', tone: 'wait' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Not approved', tone: 'off' },
};

export default function PostScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { user } = useAuth();
  const { id, describe } = useLocalSearchParams<{ id: string; describe?: string }>();
  const postId = Number(id);

  const [post, setPost] = useState<FeedPost | null | undefined>(undefined);
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [earned, setEarned] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const pay = rates.teach?.amount_jmd ?? null;

  const load = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([loadPost(postId), loadDescriptions(postId)]);
      setPost(p);
      setDescriptions(d);
    } catch (e) {
      setError((e as Error).message);
      setPost((p) => p ?? null);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const words = draft.trim().split(/\s+/).filter(Boolean).length;
  const problem = descriptionProblem(draft);

  const send = async () => {
    if (!user || !post) return;
    if (problem) return setError(problem);
    setSending(true);
    setError(null);
    try {
      const result = await addDescription(post.id, user.id, draft);
      setEarned(result.amount);
      setBurst((b) => b + 1);
      setDraft('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const like = async () => {
    if (!user || !post) return;
    const liked = !post.liked;
    setPost({ ...post, liked, like_count: post.like_count + (liked ? 1 : -1) });
    try {
      await setLiked(post.id, user.id, liked);
    } catch {
      setPost(post);
    }
  };

  if (post === undefined) {
    return (
      <Screen title="Post" header={<Header title="Post" />}>
        <ActivityIndicator color={theme.accentText} />
      </Screen>
    );
  }
  if (post === null) {
    return (
      <Screen title="Post" header={<Header title="Post" />}>
        <Card style={styles.gone}>
          <IconTile icon="close" size={44} />
          <T variant="heading">This post is gone</T>
          <T variant="small" color="textSecondary" style={styles.center}>
            It was deleted or hidden after reports.
          </T>
        </Card>
      </Screen>
    );
  }

  const mine = descriptions.find((d) => d.is_mine);
  const others = descriptions.filter((d) => !d.is_mine);
  const canDescribe = !post.is_mine && !post.my_status && !mine;
  const unlocked = post.is_mine || !!mine;

  return (
    <Screen
      title="Post"
      header={
        <Header
          title={post.is_mine ? 'Your post' : `${post.author}'s post`}
          subtitle={timeAgo(post.created_at)}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={post.is_mine ? 'Post options' : 'Report post'} onPress={() => setMenu(true)} hitSlop={10} style={styles.menu}>
              <T variant="heading" color="textSecondary">
                ⋯
              </T>
            </Pressable>
          }
        />
      }>
      <Confetti burst={burst} />
      <Appear>
        <PostMedia kind={post.kind} path={post.media_path} width={post.width} height={post.height} autoPlay />
      </Appear>

      <Appear index={1} style={styles.metaRow}>
        <Avatar letter={post.author[0]?.toUpperCase() ?? 'R'} size={32} />
        <View style={styles.flex}>
          {post.caption ? <T variant="body">{post.caption}</T> : <T variant="small" color="textSecondary">No caption</T>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={post.liked ? 'Unlike' : 'Like'} onPress={like} hitSlop={8} style={styles.like}>
          <Icon name="heart" size={22} color={post.liked ? theme.danger : theme.textSecondary} />
          <T variant="smallStrong" color="textSecondary">
            {post.like_count}
          </T>
        </Pressable>
      </Appear>

      {/* Describe it */}
      {canDescribe ? (
        <Appear index={2}>
          <Card style={[styles.composer, { borderColor: theme.reward, borderWidth: 2 }]}>
            <View style={styles.composerTop}>
              <IconTile icon="edit" tone="reward" size={36} />
              <View style={styles.flex}>
                <T variant="heading">Wah gwaan inna dis?</T>
                <T variant="caption" color="textSecondary">
                  Describe what's happening, in Patois, the way you'd tell a friend.
                </T>
              </View>
              {pay ? (
                <View style={[styles.pay, { backgroundColor: theme.reward }]}>
                  <T variant="smallStrong" style={{ color: theme.onReward }}>
                    +{money(pay, 0)}
                  </T>
                </View>
              ) : null}
            </View>
            <View style={styles.prompts}>
              {PROMPTS.map((p) => (
                <View key={p} style={[styles.prompt, { backgroundColor: theme.rewardSoft }]}>
                  <T variant="caption" color="rewardText">
                    {p}
                  </T>
                </View>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Your description in Patois"
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                setError(null);
              }}
              autoFocus={describe === '1'}
              multiline
              maxLength={MAX_DESCRIPTION}
              placeholder="Mi see one higgler a sell mango an..."
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                inputText,
                { color: theme.text, backgroundColor: theme.background, borderColor: problem && draft ? theme.backgroundSelected : theme.accent },
                Platform.OS === 'web' && ({ outlineWidth: 0 } as object),
              ]}
            />
            <View style={styles.counterRow}>
              <T variant="caption" color={words >= MIN_DESCRIPTION_WORDS ? 'accentText' : 'textSecondary'}>
                {words >= MIN_DESCRIPTION_WORDS ? '✓ ' : ''}
                {words} {words === 1 ? 'word' : 'words'}
                {words < MIN_DESCRIPTION_WORDS ? ` · at least ${MIN_DESCRIPTION_WORDS}` : ''}
              </T>
              <T variant="caption" color="textSecondary">
                {draft.length}/{MAX_DESCRIPTION}
              </T>
            </View>
            {error ? <Notice tone="error" text={error} /> : null}
            <Button
              label={sending ? 'Sending...' : pay ? `Send · +${money(pay, 0)}` : 'Send'}
              icon="send"
              variant="reward"
              disabled={sending || !!problem}
              onPress={send}
            />
            <T variant="caption" color="textSecondary">
              Paid once other speakers agree it describes the post in real Patois. One description per post.
            </T>
          </Card>
        </Appear>
      ) : null}

      {earned !== null ? (
        <Appear>
          <View style={[styles.thanks, { backgroundColor: theme.accentSoft }]}>
            <FloatUp trigger={burst} label={earned ? `+${money(earned, 0)}` : 'Sent!'} />
            <Icon name="check" size={18} color={theme.accentText} />
            <T variant="small" color="accentText" style={styles.flex}>
              {earned
                ? `Big up! ${money(earned, 0)} is waiting for other speakers to check it.`
                : "Thanks! You've reached today's paid limit, but your description still teaches the AI."}
            </T>
          </View>
        </Appear>
      ) : null}

      {/* What people said */}
      {mine ? (
        <Appear index={3}>
          <Card style={styles.mine}>
            <View style={styles.row}>
              <T variant="overline" color="accentText" style={styles.flex}>
                Your description
              </T>
              <Pill {...STATUS[mine.status]} />
            </View>
            <T variant="body">{mine.text}</T>
          </Card>
        </Appear>
      ) : null}

      <Appear index={4}>
        <T variant="heading">{post.is_mine ? 'What people said about it' : 'What others said'}</T>
      </Appear>
      {!unlocked ? (
        <Card style={styles.locked}>
          <Icon name="shield" size={20} color={theme.textSecondary} />
          <T variant="small" color="textSecondary" style={styles.flex}>
            {post.description_count
              ? `${post.description_count} ${post.description_count === 1 ? 'person has' : 'people have'} described this. Add yours to see what they said.`
              : 'Nobody has described this yet. Be the first!'}
          </T>
        </Card>
      ) : others.length === 0 ? (
        <T variant="small" color="textSecondary">
          {post.is_mine ? 'No approved descriptions yet. They show here once other speakers check them.' : 'No other approved descriptions yet.'}
        </T>
      ) : (
        others.map((d, i) => (
          <Appear key={d.id} index={5 + Math.min(i, 5)}>
            <View style={[styles.description, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <Avatar letter={d.author[0]?.toUpperCase() ?? 'R'} size={30} />
              <View style={styles.flex}>
                <T variant="smallStrong">
                  {d.author} <T variant="caption" color="textSecondary">· {timeAgo(d.created_at)}</T>
                </T>
                <T variant="body">{d.text}</T>
              </View>
            </View>
          </Appear>
        ))
      )}

      {menu ? (
        <PostActions
          post={post}
          userId={user?.id}
          onClose={() => setMenu(false)}
          onDone={() => {
            setMenu(false);
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}

function Pill({ label, tone }: { label: string; tone: 'good' | 'wait' | 'off' }) {
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menu: { paddingHorizontal: 10 },
  gone: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  composer: { gap: 12 },
  composerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pay: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prompt: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  input: { minHeight: 96, maxHeight: 200, borderWidth: 1.5, borderRadius: 16, padding: 14, textAlignVertical: 'top' },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16 },
  mine: { gap: 8 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  description: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 18, borderWidth: 1 },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
});
