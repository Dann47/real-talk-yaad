import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Appear, Avatar, Button, Card, Icon, IconTile, NameBadge, Notice, Screen, T } from '@/components/kit';
import { PostActions } from '@/components/post-actions';
import { PostMedia } from '@/components/post-media';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { usePeopleLooks, type Look } from '@/lib/cosmetics';
import { money } from '@/lib/format';
import { useRates } from '@/lib/rates';
import { FEED_PAGE, loadFeed, setLiked, timeAgo, type FeedFilter, type FeedPost } from '@/lib/teach';

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'For you' },
  { id: 'teach', label: 'To teach' },
  { id: 'mine', label: 'My posts' },
];

const STATUS: Record<NonNullable<FeedPost['my_status']>, string> = {
  pending: 'You taught · in review',
  approved: 'You taught · paid',
  rejected: 'You taught · not approved',
};

function PostCard({
  post,
  pay,
  look,
  onLike,
  onMenu,
}: {
  post: FeedPost;
  look: Look;
  pay: number | null;
  onLike: () => void;
  onMenu: () => void;
}) {
  const theme = useTheme();
  const open = (describe = false) => router.push(`/post/${post.id}${describe ? '?describe=1' : ''}` as Href);

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <View style={styles.author}>
        <Avatar letter={post.author[0]?.toUpperCase() ?? 'R'} size={34} frame={look.frame?.colors} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <T variant="bodyStrong">{post.is_mine ? 'You' : post.author}</T>
            <NameBadge badge={look.badge} small />
          </View>
          <T variant="caption" color="textSecondary">
            {timeAgo(post.created_at)}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={post.is_mine ? 'Post options' : 'Report post'} onPress={onMenu} hitSlop={10} style={styles.menu}>
          <T variant="heading" color="textSecondary">
            ⋯
          </T>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Open post" onPress={() => open()}>
        <PostMedia kind={post.kind} path={post.media_path} width={post.width} height={post.height} rounded={18} />
      </Pressable>

      {post.caption ? (
        <T variant="body" numberOfLines={3}>
          {post.caption}
        </T>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: post.liked }}
          onPress={onLike}
          hitSlop={6}
          style={({ pressed }) => [styles.action, { transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
          <Icon name="heart" size={20} color={post.liked ? theme.danger : theme.textSecondary} />
          <T variant="smallStrong" color={post.liked ? 'text' : 'textSecondary'}>
            {post.like_count}
          </T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${post.description_count} descriptions`} onPress={() => open()} hitSlop={6} style={styles.action}>
          <Icon name="chat" size={20} color={theme.textSecondary} />
          <T variant="smallStrong" color="textSecondary">
            {post.description_count}
          </T>
        </Pressable>
        <View style={styles.flex} />
        {post.is_mine ? (
          <T variant="caption" color="textSecondary">
            Your post
          </T>
        ) : post.my_status ? (
          <View style={[styles.status, { backgroundColor: post.my_status === 'approved' ? theme.accentSoft : theme.rewardSoft }]}>
            <Icon name="check" size={12} color={post.my_status === 'approved' ? theme.accentText : theme.rewardText} />
            <T variant="caption" color={post.my_status === 'approved' ? 'accentText' : 'rewardText'}>
              {STATUS[post.my_status]}
            </T>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Describe this post in Patois${pay ? ` and earn ${money(pay, 0)}` : ''}`}
            onPress={() => open(true)}
            style={({ pressed }) => [styles.teach, { backgroundColor: theme.reward, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <Icon name="edit" size={14} color={theme.onReward} />
            <T variant="smallStrong" style={{ color: theme.onReward }}>
              Describe{pay ? ` · +${money(pay, 0)}` : ''}
            </T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const theme = useTheme();
  const rates = useRates();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<FeedFilter>(params.filter === 'teach' || params.filter === 'mine' ? params.filter : 'all');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pay = rates.teach?.amount_jmd ?? null;
  const lookOf = usePeopleLooks((posts ?? []).map((p) => p.author_id));

  const load = useCallback(async (which: FeedFilter) => {
    setRefreshing(true);
    try {
      const page = await loadFeed(which);
      setPosts(page);
      setMore(page.length === FEED_PAGE);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setPosts((p) => p ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Follow ?filter= from links (Work > Teach opens "To teach").
  useFocusEffect(
    useCallback(() => {
      const wanted = params.filter === 'teach' || params.filter === 'mine' ? params.filter : null;
      if (wanted && wanted !== filter) {
        setFilter(wanted);
        setPosts(null);
        load(wanted);
      } else load(filter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.filter]),
  );

  const choose = (which: FeedFilter) => {
    if (which === filter) return;
    setFilter(which);
    setPosts(null);
    load(which);
    router.setParams({ filter: which === 'all' ? undefined : which } as never);
  };

  const loadMore = async () => {
    if (!posts?.length) return;
    setLoadingMore(true);
    try {
      const page = await loadFeed(filter, posts[posts.length - 1].id);
      setPosts([...posts, ...page]);
      setMore(page.length === FEED_PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const like = async (post: FeedPost) => {
    if (!user) return;
    const liked = !post.liked;
    const update = (p: FeedPost) => (p.id === post.id ? { ...p, liked, like_count: p.like_count + (liked ? 1 : -1) } : p);
    setPosts((list) => list?.map(update) ?? null);
    try {
      await setLiked(post.id, user.id, liked);
    } catch {
      // Put it back if it didn't save.
      setPosts((list) => list?.map((p) => (p.id === post.id ? post : p)) ?? null);
    }
  };

  return (
    <Screen tabs title="Feed" onRefresh={() => load(filter)} refreshing={refreshing && !!posts}>
      <Appear style={styles.top}>
        <View style={styles.flex}>
          <T variant="title">Feed</T>
          <T variant="small" color="textSecondary">
            Describe what's happening in Patois{pay ? ` · ${money(pay, 0)} each` : ''}
          </T>
        </View>
        <Button label="Post" icon="plus" compact href={'/new-post' as Href} />
      </Appear>

      <Appear index={1} style={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => choose(f.id)}
              style={[styles.filter, { backgroundColor: on ? theme.accent : theme.backgroundElement, borderColor: on ? theme.accent : theme.backgroundSelected }]}>
              <T variant="smallStrong" style={{ color: on ? theme.onAccent : theme.text }}>
                {f.label}
              </T>
            </Pressable>
          );
        })}
      </Appear>

      {notice ? <Notice tone="success" text={notice} /> : null}
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => load(filter)}>
          <Notice tone="error" text={`${error} Tap to try again.`} />
        </Pressable>
      ) : null}

      {!posts ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accentText} />
        </View>
      ) : posts.length === 0 ? (
        <Card style={styles.empty}>
          <IconTile icon={filter === 'mine' ? 'plus' : filter === 'teach' ? 'check' : 'video'} tone="reward" size={48} />
          <T variant="heading">
            {filter === 'mine' ? 'No posts yet' : filter === 'teach' ? "You've described everything!" : 'The feed is quiet'}
          </T>
          <T variant="small" color="textSecondary" style={styles.center}>
            {filter === 'mine'
              ? 'Share a photo or short video of everyday Jamaica: market, food, a street, a game. Others earn by describing it.'
              : filter === 'teach'
                ? 'New posts show up here for you to describe. Check back soon, or post something yourself.'
                : 'Be the first: post a photo or short video of everyday Jamaica.'}
          </T>
          <Button label="Make a post" icon="plus" variant={filter === 'teach' ? 'secondary' : 'primary'} href={'/new-post' as Href} />
        </Card>
      ) : (
        posts.map((post, i) => (
          <Appear key={post.id} index={Math.min(i, 4) + 2}>
            <PostCard post={post} pay={pay} look={lookOf(post.author_id)} onLike={() => like(post)} onMenu={() => setMenuPost(post)} />
          </Appear>
        ))
      )}

      {posts && more ? (
        <Button label={loadingMore ? 'Loading...' : 'Show more posts'} variant="secondary" disabled={loadingMore} onPress={loadMore} />
      ) : null}

      <PostActions
        post={menuPost}
        userId={user?.id}
        onClose={() => setMenuPost(null)}
        onDone={(post, what) => {
          setPosts((list) => list?.filter((p) => p.id !== post.id) ?? null);
          setNotice(what === 'deleted' ? 'Your post was deleted.' : "Thanks. We'll take a look, and you won't see it here again.");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  card: { gap: 12, padding: 12, borderRadius: 24, borderWidth: 1 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  menu: { paddingHorizontal: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  teach: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
});
