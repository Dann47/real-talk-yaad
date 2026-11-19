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
  pay: string;
  icon: IconName;
  href: Href;
  description: string;
};

export const tasks: Task[] = [
  {
    id: 'talk',
    title: 'Talk with the AI',
    detail: 'Topic: Sunday dinner · 10 min',
    pay: 'up to J$150',
    icon: 'chat',
    href: '/talk' as Href,
    description: 'Chat in Patois and correct the AI when it gets it wrong.',
  },
  {
    id: 'voice',
    title: 'Voice chat',
    detail: 'Topic: At the market · 5 min',
    pay: 'up to J$90',
    icon: 'mic',
    href: '/voice' as Href,
    description: 'Talk out loud with the AI and fix what it heard.',
  },
  {
    id: 'record',
    title: 'Record: Market day',
    detail: '10 short lines · 4 min',
    pay: 'J$40',
    icon: 'waveform',
    href: '/record' as Href,
    description: 'Read short Patois lines aloud.',
  },
  {
    id: 'verify',
    title: 'Verify corrections',
    detail: '10 items · 5 min',
    pay: 'J$60',
    icon: 'check',
    href: '/verify' as Href,
    description: "Check other people's corrections. Your vote is compared with the group.",
  },
  {
    id: 'teach',
    title: 'Teach: describe a clip',
    detail: '1 video · 1 min',
    pay: 'J$25',
    icon: 'video',
    href: '/feed' as Href,
    description: "Say what's happening in a video, in Patois.",
  },
];

export type ChatMessage = {
  id: string;
  from: 'ai' | 'me' | 'correction';
  text: string;
  flagged?: boolean;
};

export const talkTopic = 'Sunday dinner';

export const openingChat: ChatMessage[] = [
  { id: 'm1', from: 'ai', text: 'Wah gwaan! Tell mi bout Sunday dinner a yuh yaad.' },
  { id: 'm2', from: 'me', text: 'Every Sunday mi granny cook rice an peas an chicken.' },
  { id: 'm3', from: 'ai', text: 'That sound very delicious, mi friend.' },
];

export const aiReplies = [
  'Respect! Yuh granny cook it pon di fire or inna di oven?',
  'Mi like dat. Wah else unu nyam pon Sunday?',
  'True! Tell mi more bout it.',
  'Who else come a di house fi eat?',
];

export const recordLines = [
  'Wah gwaan, how yuh do?',
  'Mi deh yah, likkle bit tired still.',
  'Mi a go a town fi buy likkle someting. Soon come back.',
  'Di bus tek long fi come dis mawnin.',
  'Gimme two a di mango dem, please.',
  'How much fi di breadfruit?',
  'Rain a fall, so mi naa go out.',
  'Wi a go beach pon Sunday.',
  'Mi granny cook di bes rice an peas.',
  'Walk good, mi wi check yuh lata.',
];

export const verifyItems = [
  { id: 'v1', ai: 'That sound very delicious, mi friend.', corrected: 'Dat sound nice, yuh see!' },
  { id: 'v2', ai: 'I am going to the shop now, mi bredda.', corrected: 'Mi a go a shop now, bredda.' },
  { id: 'v3', ai: 'Wah you doing today?', corrected: 'Wah yuh a do today?' },
  { id: 'v4', ai: 'Di weather is very hot today.', corrected: 'Di sun hot today, eeh!' },
];

export const history = [
  { id: 'h1', label: 'Talk with the AI', when: 'Today', amount: 150 },
  { id: 'h2', label: 'Verified 10 corrections', when: 'Today', amount: 60 },
  { id: 'h3', label: 'Store: Yaad Gold theme', when: 'Yesterday', amount: -300 },
  { id: 'h4', label: 'Cash out to card •••• 4821', when: 'Nov 10', amount: -2000 },
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
