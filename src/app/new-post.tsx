import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Appear, Button, Card, Header, Icon, IconTile, Notice, Screen, T, TextField } from '@/components/kit';
import { PostMedia } from '@/components/post-media';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { MAX_CAPTION, MAX_VIDEO_SECONDS, createPost } from '@/lib/teach';

const MAX_BYTES = 50 * 1024 * 1024;

type Picked = { uri: string; mimeType: string; kind: 'photo' | 'video'; width?: number; height?: number; durationMs?: number };

const RULES = [
  'Everyday Jamaica: food, markets, streets, music, sports, nature',
  'Only people who are OK being in it. No children without a parent saying yes',
  'Nothing private: no ID cards, addresses, licence plates or screens with personal info',
  'Nothing rude, violent or sexual',
];

export default function NewPostScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const use = (asset: {
    uri: string;
    type?: string | null;
    mimeType?: string | null;
    width?: number;
    height?: number;
    duration?: number | null;
    fileSize?: number | null;
  }) => {
    const kind = asset.type === 'video' ? 'video' : 'photo';
    if (kind === 'video' && asset.duration && asset.duration > (MAX_VIDEO_SECONDS + 0.5) * 1000) {
      return setError(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`);
    }
    if (asset.fileSize && asset.fileSize > MAX_BYTES) return setError('That file is too big (over 50 MB). Try a shorter video.');
    setError(null);
    setPicked({
      uri: asset.uri,
      kind,
      mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      width: asset.width,
      height: asset.height,
      durationMs: asset.duration ?? undefined,
    });
  };

  const fromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: MAX_VIDEO_SECONDS,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]) use(result.assets[0]);
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError('Allow the camera in your phone settings, or pick from your gallery.');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (!result.canceled && result.assets?.[0]) use(result.assets[0]);
  };

  const post = async () => {
    if (!user || !picked) return;
    setPosting(true);
    setError(null);
    try {
      const id = await createPost(user.id, picked, caption);
      router.replace(`/post/${id}` as Href);
    } catch (e) {
      setError((e as Error).message);
      setPosting(false);
    }
  };

  return (
    <Screen
      title="New post"
      header={<Header title="New post" subtitle="Others earn by describing it in Patois" />}
      footer={
        <Button
          label={posting ? (picked?.kind === 'video' ? 'Uploading video...' : 'Posting...') : 'Post'}
          icon="send"
          disabled={!picked || posting}
          onPress={post}
        />
      }>
      {picked ? (
        <Appear style={styles.previewBlock}>
          <PostMedia kind={picked.kind} url={picked.uri} width={picked.width} height={picked.height} autoPlay />
          <Pressable accessibilityRole="button" onPress={() => setPicked(null)} hitSlop={8} style={styles.change}>
            <Icon name="undo" size={14} color={theme.accentText} />
            <T variant="smallStrong" color="accentText">
              Choose something else
            </T>
          </Pressable>
        </Appear>
      ) : (
        <Appear style={styles.pickers}>
          {[
            { icon: 'bag' as const, title: 'From gallery', detail: 'Photo or video', onPress: fromLibrary },
            ...(Platform.OS === 'web' ? [] : [{ icon: 'video' as const, title: 'Use camera', detail: `Photo or up to ${MAX_VIDEO_SECONDS}s video`, onPress: fromCamera }]),
          ].map((option) => (
            <Pressable
              key={option.title}
              accessibilityRole="button"
              onPress={option.onPress}
              style={({ pressed }) => [
                styles.picker,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}>
              <IconTile icon={option.icon} size={48} />
              <T variant="heading">{option.title}</T>
              <T variant="caption" color="textSecondary">
                {option.detail}
              </T>
            </Pressable>
          ))}
        </Appear>
      )}

      {error ? <Notice tone="error" text={error} /> : null}

      <Appear index={1}>
        <TextField
          label="Caption (optional)"
          value={caption}
          onChangeText={setCaption}
          maxLength={MAX_CAPTION}
          placeholder="Coronation Market inna di mawnin"
          hint="Short is fine. Don't describe everything: that's what others get paid for."
          multiline
        />
      </Appear>

      <Appear index={2}>
        <Card tone="soft" style={styles.rules}>
          <View style={styles.row}>
            <Icon name="shield" size={18} color={theme.accentText} />
            <T variant="bodyStrong">What to post</T>
          </View>
          {RULES.map((rule) => (
            <View key={rule} style={styles.rule}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <T variant="small" style={styles.flex}>
                {rule}
              </T>
            </View>
          ))}
          <T variant="caption" color="textSecondary">
            Posts that get reported by several people are hidden. Your post is used to teach AI, as in the terms you agreed to.
          </T>
        </Card>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBlock: { gap: 10 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  pickers: { flexDirection: 'row', gap: 12 },
  picker: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 28, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed' },
  rules: { gap: 10 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
});
