/**
 * Sample content so the screens work before the backend exists.
 * Replace with Supabase queries as each feature is built.
 */
export { money } from '@/lib/format';
export { tasks, type Task } from '@/lib/tasks';

export const wallet = {
  balance: 4250,
  pending: 310,
  thisWeek: 620,
  payoutMethod: 'Bank card •••• 4821',
};

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

export const feedPost = {
  author: '@kerryann_ja',
  caption: 'Coronation Market inna di mawnin.',
  scene: 'Video: market stall with fruit and veg',
  likes: '1.2k',
  comments: '86',
  teachPay: 'J$25',
};
