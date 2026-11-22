/**
 * "Pick a handle": asked once, after someone's first approved task (they're engaged by then).
 * Comes with a free suggestion filled in. "Not now" hides it for good; Edit profile still has the field.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Confetti } from '@/components/celebrate';
import { Appear, Button, Card, Icon, IconTile, T, inputText } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { displayName, useAuth } from '@/lib/auth';
import { handleAvailable, handleIdeas, handleProblem } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { storage } from '@/theme/storage';

const DONE_KEY = 'handlePrompt.done';

type Check = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

export function HandlePrompt({ approvedCount, index = 0 }: { approvedCount: number; index?: number }) {
  const theme = useTheme();
  const { user, profile, refresh } = useAuth();
  const [done, setDone] = useState(() => storage.get(DONE_KEY) === '1');
  const [handle, setHandle] = useState('');
  const [check, setCheck] = useState<Check>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [saved, setSaved] = useState(false);
  const [ideas, setIdeas] = useState<string[]>([]);
  const loadedIdeas = useRef(false);

  const show = !!user && !!profile && !profile.handle && approvedCount >= 1 && !done;

  // A few free ideas to tap (the box itself starts empty: the handle is theirs to choose).
  useEffect(() => {
    if (!show || loadedIdeas.current || !user) return;
    loadedIdeas.current = true;
    const candidates = handleIdeas(displayName(profile, user), profile?.parish ?? null);
    Promise.all(candidates.map(async (h) => ((await handleAvailable(h)) ? h : null))).then((free) =>
      setIdeas(free.filter((h): h is string => !!h).slice(0, 3)),
    );
  }, [show, profile, user]);

  // Check what they type, a moment after they stop.
  useEffect(() => {
    if (!show) return;
    if (!handle) {
      setCheck('idle');
      return;
    }
    if (handleProblem(handle)) {
      setCheck('invalid');
      return;
    }
    setCheck('checking');
    const timer = setTimeout(() => {
      handleAvailable(handle).then((free) => setCheck(free ? 'free' : 'taken'));
    }, 400);
    return () => clearTimeout(timer);
  }, [handle, show]);

  if (saved) {
    return (
      <Appear>
        <Confetti burst={burst} />
        <View style={[styles.saved, { backgroundColor: theme.accentSoft }]}>
          <Icon name="check" size={16} color={theme.accentText} />
          <T variant="smallStrong" color="accentText">
            You're @{handle} now. Big up!
          </T>
        </View>
      </Appear>
    );
  }
  if (!show) return null;

  const dismiss = () => {
    storage.set(DONE_KEY, '1');
    setDone(true);
  };

  const save = async () => {
    if (!user || check !== 'free') return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from('profiles').update({ handle, updated_at: new Date().toISOString() }).eq('id', user.id);
    setSaving(false);
    if (saveError) {
      if (saveError.code === '23505') {
        setCheck('taken');
        return;
      }
      setError('That did not save. Try again.');
      return;
    }
    storage.set(DONE_KEY, '1');
    setBurst((b) => b + 1);
    setSaved(true);
    refresh();
  };

  const status =
    check === 'checking'
      ? { text: 'Checking...', color: theme.textSecondary, icon: null }
      : check === 'free'
        ? { text: 'Available', color: theme.accentText, icon: 'check' as const }
        : check === 'taken'
          ? { text: `@${handle} is taken. Try another or tap an idea below.`, color: theme.danger, icon: 'close' as const }
          : check === 'invalid'
            ? { text: 'Small letters, numbers or _ · 3 to 24 characters', color: theme.danger, icon: 'info' as const }
            : null;

  return (
    <Appear index={index}>
      <Card style={[styles.card, { borderColor: theme.accent, borderWidth: 1.5 }]}>
        <View style={styles.top}>
          <IconTile icon="person" size={40} />
          <View style={styles.flex}>
            <T variant="heading">Claim your handle</T>
            <T variant="caption" color="textSecondary">
              Your first work got approved! Grab your @ before someone else does.
            </T>
          </View>
        </View>

        <View style={[styles.field, { backgroundColor: theme.background, borderColor: check === 'taken' || check === 'invalid' ? theme.danger : check === 'free' ? theme.accent : theme.backgroundSelected }]}>
          <T variant="bodyStrong" color="textSecondary">
            @
          </T>
          <TextInput
            accessibilityLabel="Your handle"
            value={handle}
            onChangeText={(t) => {
              setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24));
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
            autoFocus={false}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, inputText, { color: theme.text }, Platform.OS === 'web' && ({ outlineWidth: 0 } as object)]}
          />
          {check === 'checking' ? <ActivityIndicator size="small" color={theme.textSecondary} /> : null}
          {check === 'free' ? <Icon name="check" size={18} color={theme.accentText} /> : null}
        </View>
        {status ? (
          <View style={styles.status}>
            {status.icon ? <Icon name={status.icon} size={13} color={status.color} /> : null}
            <T variant="caption" style={{ color: status.color }}>
              {status.text}
            </T>
          </View>
        ) : null}
        {error ? (
          <T variant="caption" style={{ color: theme.danger }}>
            {error}
          </T>
        ) : null}

        {ideas.length ? (
          <View style={styles.ideas}>
            <T variant="caption" color="textSecondary">
              Free right now:
            </T>
            {ideas.map((idea) => (
              <Pressable
                key={idea}
                accessibilityRole="button"
                accessibilityLabel={`Use @${idea}`}
                onPress={() => setHandle(idea)}
                style={({ pressed }) => [
                  styles.idea,
                  {
                    backgroundColor: handle === idea ? theme.accent : theme.accentSoft,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}>
                <T variant="caption" style={{ color: handle === idea ? theme.onAccent : theme.accentText }}>
                  @{idea}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" onPress={dismiss} hitSlop={8} style={styles.notNow}>
            <T variant="smallStrong" color="textSecondary">
              Not now
            </T>
          </Pressable>
          <Button label={saving ? 'Saving...' : 'Use this handle'} icon="check" compact disabled={saving || check !== 'free'} onPress={save} style={styles.flex} />
        </View>
        <T variant="caption" color="textSecondary">
          You can change it any time in Edit profile.
        </T>
      </Card>
    </Appear>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, minHeight: 48 },
  input: { flex: 1, paddingVertical: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  notNow: { paddingVertical: 8, paddingHorizontal: 4 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  idea: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14 },
});
