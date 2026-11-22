/**
 * Terms of use and privacy, written from how the app actually works.
 * Live numbers (pay, daily limit, smallest cash-out) come from the database when you're signed in.
 * Have a Jamaican lawyer review this text before launch (Data Protection Act, 2020).
 */
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Appear, Card, Header, Icon, IconTile, Screen, T, type IconName } from '@/components/kit';
import { useTheme } from '@/hooks/use-theme';
import { TERMS_VERSION, useAuth } from '@/lib/auth';
import { loadPayLimits } from '@/lib/earnings';
import { money } from '@/lib/format';
import { COMPANY, CONTACT_EMAIL, TERMS_UPDATED } from '@/lib/legal';
import { useRates } from '@/lib/rates';
import { supabase } from '@/lib/supabase';

type Section = { id: string; icon: IconName; title: string; short: string; points: string[] };

function Accordion({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundElement, borderColor: open ? theme.accent : theme.backgroundSelected }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.sectionTop}>
        <IconTile icon={section.icon} size={36} />
        <View style={styles.flex}>
          <T variant="bodyStrong">{section.title}</T>
          <T variant="caption" color="textSecondary">
            {section.short}
          </T>
        </View>
        <Icon name={open ? 'chevronUp' : 'chevron'} size={16} color={theme.textSecondary} />
      </Pressable>
      {open ? (
        <View style={[styles.points, { borderTopColor: theme.backgroundSelected }]}>
          {section.points.map((point) => (
            <View key={point} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <T variant="small" style={styles.flex}>
                {point}
              </T>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function TermsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const rates = useRates();
  const [cap, setCap] = useState<number | null>(null);
  const [minCashout, setMinCashout] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Live numbers, when signed in. Signed out, the text refers to "the amount shown in the app".
  useEffect(() => {
    if (!session) return;
    loadPayLimits().then((l) => setCap(l?.dailyCap ?? null));
    supabase.rpc('wallet_summary').then(({ data }) => {
      const v = Number((data as Record<string, unknown> | null)?.min_cashout ?? 0);
      if (v) setMinCashout(v);
    });
  }, [session]);

  const pay = (id: string, unit: string) => (rates[id] ? `${money(rates[id].amount_jmd, 0)} per ${unit}` : null);
  const payLines = [
    pay('talk', 'fix in a chat'),
    pay('voice', 'fix in a voice chat'),
    rates.record ? `${money(rates.record.amount_jmd, 0)} per recorded line${rates.record_fix ? ` (+${money(rates.record_fix.amount_jmd, 0)} if you fixed the line first)` : ''}` : null,
    pay('teach', 'Feed description'),
    rates.verify_recording && rates.verify_description
      ? `${money(rates.verify_recording.amount_jmd, 0)} to ${money(rates.verify_description.amount_jmd, 0)} per verify vote that matches other speakers`
      : null,
  ].filter(Boolean) as string[];

  const sections: Section[] = [
    {
      id: 'who',
      icon: 'person',
      title: 'Who can use it',
      short: 'Adults 18+, one account each.',
      points: [
        'You must be 18 or older to use Real Talk Yaad.',
        'One account per person. Extra accounts, shared accounts and bots are not allowed and can lose their earnings.',
        'Keep your password private. You are responsible for what is done with your account.',
      ],
    },
    {
      id: 'work',
      icon: 'bolt',
      title: 'The work you do',
      short: 'Chat, record, fix, verify and describe in Patois.',
      points: [
        'Talk and Voice chat: you chat with an AI in Patois and fix its replies, or fix the words it heard you say.',
        'Record lines: you check a line (some written by AI), fix it if needed, and read it aloud.',
        'Verify: you listen to and read other people\'s work and vote yes or no.',
        'Teach: you post photos or short videos of everyday Jamaica, and describe other people\'s posts in Patois.',
        'You are not our employee. You choose when and how much to work. You are responsible for any tax on what you earn.',
      ],
    },
    {
      id: 'pay',
      icon: 'wallet',
      title: 'How pay works',
      short: 'Paid in J$ once other speakers agree your work is right.',
      points: [
        ...(payLines.length ? [`Current rates: ${payLines.join('; ')}. Rates can change; work already done keeps the rate it was saved with.`] : [
          'Each task shows its pay before you start. Rates can change; work already done keeps the rate it was saved with.',
        ]),
        'Work is checked by other speakers. It is paid once enough of them agree (usually 2). Work they reject is not paid.',
        `There is a daily pay limit${cap ? ` (currently ${money(cap, 0)})` : ''} and a monthly budget for everyone. Work done over a limit is still saved and used, but pays J$0. The app tells you when this happens.`,
        'Fixing the AI\'s opening greeting is not paid.',
        'Some lines are hidden quality checks. Cheating (random votes, copying, nonsense recordings, multiple accounts) can lead to unpaid work and a closed account.',
      ],
    },
    {
      id: 'cashout',
      icon: 'cashout',
      title: 'Cash-outs',
      short: 'To your bank or Lynk, once you reach the minimum.',
      points: [
        `You can cash out approved earnings once you reach the minimum${minCashout ? ` (currently ${money(minCashout, 0)})` : ''}. Any fee is shown before you confirm.`,
        'One cash-out at a time. You can cancel it while it is still "Requested"; the money goes back to your balance.',
        'While we test the app, cash-outs are paid by hand. We may email you to confirm your account details before your first payment.',
        'We only store your bank name, account type, account holder name and the last 4 digits (or your Lynk handle). Full account numbers will be held by a licensed payment partner, not by us.',
        'If a cash-out fails, the money returns to your balance. We may hold a cash-out while we check for fraud.',
      ],
    },
    {
      id: 'data',
      icon: 'shield',
      title: 'How your data is used',
      short: 'Your Patois work is licensed to AI companies. Your name and contacts are not.',
      points: [
        'What we collect: your email, name, optional handle and parish; your recordings, chat messages, fixes, votes, Feed posts and descriptions; your payout method details above; your purchases and the device type you agreed on.',
        'What we sell: we license your recordings, chats, fixes, descriptions and Feed posts to AI companies and researchers to train and test AI. Your name, email, phone and payout details are never included.',
        'Your chats and voice messages are sent to our AI and speech-to-text providers to create replies and transcripts.',
        'Other users hear your recordings and see your fixes and descriptions when they verify them, without your name.',
        'On the Feed and leaderboard, other users see your first name, your posts and the frame or badge you wear. You can hide yourself from the leaderboard in Edit profile.',
        'We keep your data while your account is open, and as long as needed for licences already granted and for our legal records.',
      ],
    },
    {
      id: 'feed',
      icon: 'video',
      title: 'Feed posts',
      short: 'Only post what you have the right to share.',
      points: [
        'Post only your own photos and videos, and only people who agree to be in them. No children unless their parent agrees.',
        'No ID cards, addresses, licence plates or screens with personal information. Nothing rude, hateful, violent or sexual.',
        'By posting, you let us show your post to other users and license it, with the descriptions people write, for AI training.',
        'Anyone can report a post. Posts with several reports are hidden while we review them. We may remove posts and close accounts that break these rules.',
      ],
    },
    {
      id: 'store',
      icon: 'bag',
      title: 'The Store',
      short: 'Looks for your profile, paid from your balance. No refunds.',
      points: [
        'Store items (card skins, frames, badges) change how your profile looks. They never change what you earn.',
        'Purchases come out of your available balance and cannot be refunded, transferred or cashed out.',
        'Limited editions may sell out. We may change or retire items; items you bought stay yours.',
      ],
    },
    {
      id: 'rights',
      icon: 'check',
      title: 'Your choices and rights',
      short: 'Stop any time, see or correct your data, close your account.',
      points: [
        'You can stop working at any time. Work already licensed to AI companies stays licensed.',
        `Under Jamaica's Data Protection Act, 2020 you can ask to see the personal data we hold about you, correct it, or close your account. Email ${CONTACT_EMAIL}.`,
        'You can change your name, handle, parish and leaderboard setting in Edit profile, and your payout method in the Wallet.',
      ],
    },
    {
      id: 'changes',
      icon: 'info',
      title: 'Changes and contact',
      short: 'If these terms change, we ask you to agree again.',
      points: [
        'When these terms change in a way that matters, the app asks you to read and agree again before you continue.',
        'We may pause paid work, change rates or close the app. Approved earnings you can cash out stay yours.',
        `Questions: ${CONTACT_EMAIL}.`,
      ],
    },
  ];

  return (
    <Screen title="Terms and privacy" header={<Header title="Terms and privacy" subtitle={`Updated ${TERMS_UPDATED}`} />}>
      <Appear>
        <Card tone="hero" style={styles.hero}>
          <T variant="overline" style={{ color: theme.onAccent, opacity: 0.85 }}>
            In short
          </T>
          {[
            'You earn J$ for Patois work once other speakers agree it is right.',
            'We license that work to AI companies, never your name or contact details.',
            'You can stop any time, cash out what is approved, and ask to see or delete your data.',
          ].map((line) => (
            <View key={line} style={styles.heroLine}>
              <Icon name="check" size={14} color={theme.onAccent} />
              <T variant="small" style={[styles.flex, { color: theme.onAccent }]}>
                {line}
              </T>
            </View>
          ))}
        </Card>
      </Appear>

      {sections.map((section, i) => (
        <Appear key={section.id} index={1 + Math.min(i, 6)}>
          <Accordion section={section} open={open === section.id} onToggle={() => setOpen(open === section.id ? null : section.id)} />
        </Appear>
      ))}

      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} style={styles.contact}>
        <Icon name="send" size={14} color={theme.accentText} />
        <T variant="smallStrong" color="accentText">
          {CONTACT_EMAIL}
        </T>
      </Pressable>
      <T variant="caption" color="textSecondary" style={styles.center}>
        {COMPANY} · Terms version {TERMS_VERSION}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  hero: { gap: 8, padding: 20 },
  heroLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  section: { borderRadius: 20, borderWidth: 1.5, overflow: 'hidden' },
  sectionTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  points: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  contact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
});
