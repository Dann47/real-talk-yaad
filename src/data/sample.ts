/**
 * Sample content so the screens work before the backend exists.
 * Replace with Supabase queries as each feature is built.
 */
import type { Href } from 'expo-router';

import type { IconName } from '@/components/kit';

export const user = {
  name: 'Daniel',
  handle: '@dann47',
  parish: 'Kingston',
  level: 3,
  levelName: 'Trusted Teacher',
  levelProgress: 0.7,
  tasksToNextLevel: 30,
  tasksDone: 248,
  agreeRate: '94%',
  earned: 'J$18.4k',
  streakDays: 5,
  weekGoal: 1000,
};

export const wallet = {
  balance: 4250,
  pending: 310,
  thisWeek: 620,
  payoutMethod: 'Bank card •••• 4821',
};

/** 4250 → "J$4,250.00" */
export function money(amount: number, decimals = 2): string {
  const sign = amount < 0 ? '−' : '';
  const [whole, cents] = Math.abs(amount).toFixed(decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}J$${grouped}${cents ? `.${cents}` : ''}`;
}

export type Task = {
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  tone: 'accent' | 'reward';
  href: Href;
  description: string;
};

export const tasks: Task[] = [
  {
    id: 'talk',
    tone: 'accent',
    title: 'Talk with the AI',
    detail: 'Pick a topic and chat in Patois',
    icon: 'chat',
    href: '/talk' as Href,
    description: 'Chat in Patois and correct the AI when it gets it wrong.',
  },
  {
    id: 'voice',
    tone: 'accent',
    title: 'Voice chat',
    detail: 'Talk out loud in Patois',
    icon: 'mic',
    href: '/voice' as Href,
    description: 'Talk out loud with the AI and fix what it heard.',
  },
  {
    id: 'record',
    tone: 'reward',
    title: 'Record lines',
    detail: 'Read 10 short Patois lines aloud',
    icon: 'waveform',
    href: '/record' as Href,
    description: 'Read short Patois lines aloud.',
  },
  {
    id: 'verify',
    tone: 'accent',
    title: 'Verify corrections',
    detail: '10 items · 5 min',
    icon: 'check',
    href: '/verify' as Href,
    description: "Check other people's corrections. Your vote is compared with the group.",
  },
  {
    id: 'teach',
    tone: 'reward',
    title: 'Teach: describe a clip',
    detail: '1 video · 1 min',
    icon: 'video',
    href: '/feed' as Href,
    description: "Say what's happening in a video, in Patois.",
  },
];

export const verifyItems = [
  { id: 'v1', ai: 'That sound very delicious, mi friend.', corrected: 'Dat sound nice, yuh see!' },
  { id: 'v2', ai: 'I am going to the shop now, mi bredda.', corrected: 'Mi a go a shop now, bredda.' },
  { id: 'v3', ai: 'Wah you doing today?', corrected: 'Wah yuh a do today?' },
  { id: 'v4', ai: 'Di weather is very hot today.', corrected: 'Di sun hot today, eeh!' },
];

export const history: { id: string; kind: 'earn' | 'store' | 'cashout'; label: string; when: string; amount: number }[] = [
  { id: 'h1', kind: 'earn', label: 'Talk with the AI', when: 'Today', amount: 150 },
  { id: 'h2', kind: 'earn', label: 'Verified 10 corrections', when: 'Today', amount: 60 },
  { id: 'h3', kind: 'store', label: 'Store: Yaad Gold theme', when: 'Yesterday', amount: -300 },
  { id: 'h4', kind: 'cashout', label: 'Cash out to card •••• 4821', when: 'Nov 10', amount: -2000 },
];

export type StoreCategory = 'Themes' | 'Badges' | 'Stickers' | 'Sounds';

export const storeItems: {
  id: string;
  name: string;
  category: StoreCategory;
  price: number;
  tone: 'reward' | 'accent' | 'soft' | 'media';
}[] = [
  { id: 's1', name: 'Yaad Gold theme', category: 'Themes', price: 300, tone: 'reward' },
  { id: 's2', name: 'Riddim badge', category: 'Badges', price: 150, tone: 'accent' },
  { id: 's3', name: 'Patois sticker pack', category: 'Stickers', price: 200, tone: 'soft' },
  { id: 's4', name: 'Voice-note pack', category: 'Sounds', price: 250, tone: 'media' },
  { id: 's5', name: 'Night Bus theme', category: 'Themes', price: 300, tone: 'media' },
  { id: 's6', name: 'Top Teacher badge', category: 'Badges', price: 400, tone: 'reward' },
];

export const leaderboard = [
  { rank: 1, name: 'Shanice', verified: 312, me: false },
  { rank: 2, name: 'Daniel (you)', verified: 248, me: true },
  { rank: 3, name: 'Marlon', verified: 231, me: false },
];

export const feedPost = {
  author: '@kerryann_ja',
  caption: 'Coronation Market inna di mawnin.',
  scene: 'Video: market stall with fruit and veg',
  likes: '1.2k',
  comments: '86',
  teachPay: 'J$25',
};
