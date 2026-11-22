/** A Feed post's photo or video. Videos start paused and muted; tap to play, tap the speaker for sound. */
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { mediaUrl } from '@/lib/teach';

const WHITE = '#FFFFFF';

/** Keeps tall photos and wide videos from taking over the screen. */
export function mediaAspect(width: number | null | undefined, height: number | null | undefined) {
  if (!width || !height) return 1;
  return Math.min(1.6, Math.max(0.8, width / height));
}

function Video({ url, autoPlay }: { url: string; autoPlay: boolean }) {
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer({ uri: url }, (p: { loop: boolean; muted: boolean; play: () => void }) => {
    p.loop = true;
    p.muted = true;
    if (autoPlay) p.play();
  });

  const toggle = () => {
    if (playing) player.pause();
    else player.play();
    setPlaying(!playing);
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause video' : 'Play video'} onPress={toggle} style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {!playing ? (
        <View style={styles.center} pointerEvents="none">
          <View style={styles.play}>
            <Icon name="play" size={30} color={WHITE} />
          </View>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
        onPress={() => {
          player.muted = !muted;
          setMuted(!muted);
        }}
        hitSlop={8}
        style={styles.sound}>
        <Icon name={muted ? 'muted' : 'speaker'} size={16} color={WHITE} />
      </Pressable>
    </Pressable>
  );
}

export function PostMedia({
  kind,
  path,
  url: givenUrl,
  width,
  height,
  autoPlay = false,
  rounded = 22,
}: {
  kind: 'photo' | 'video';
  /** A path in the media bucket (a link is made for it), or pass `url` directly. */
  path?: string;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  autoPlay?: boolean;
  rounded?: number;
}) {
  const theme = useTheme();
  const [url, setUrl] = useState<string | null>(givenUrl ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (givenUrl !== undefined) {
      setUrl(givenUrl);
      return;
    }
    if (!path) return;
    let active = true;
    mediaUrl(path).then((u) => {
      if (!active) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [path, givenUrl]);

  return (
    <View style={[styles.frame, { aspectRatio: mediaAspect(width, height), borderRadius: rounded, backgroundColor: theme.media }]}>
      {failed ? (
        <View style={styles.center}>
          <Icon name="close" size={24} color={WHITE} />
        </View>
      ) : !url ? (
        <View style={styles.center}>
          <ActivityIndicator color={WHITE} />
        </View>
      ) : kind === 'video' ? (
        <Video url={url} autoPlay={autoPlay} />
      ) : (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      )}
      {kind === 'video' && url ? (
        <View style={styles.badge} pointerEvents="none">
          <Icon name="video" size={12} color={WHITE} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  sound: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
