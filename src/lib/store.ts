/** Store: admin-curated looks (card skins, avatar frames, badges) bought with earnings. Rules live in the database. */
import { supabase } from '@/lib/supabase';
import type { Badge, CardSkin, Frame } from '@/lib/cosmetics';

export type StoreCategory = 'card' | 'frame' | 'badge';

export type StoreItem = {
  id: number;
  name: string;
  description: string;
  category: StoreCategory;
  price_jmd: number;
  payload: CardSkin | Frame | Badge;
  artist_name: string | null;
  edition_size: number | null;
  sold: number;
  available_until: string | null;
  featured: boolean;
  owned: boolean;
  equipped: boolean;
};

export const CATEGORY_LABEL: Record<StoreCategory, string> = {
  card: 'Card skins',
  frame: 'Frames',
  badge: 'Badges',
};

export const CATEGORY_HELP: Record<StoreCategory, string> = {
  card: 'Changes your balance cards on Home, Work, Wallet and Me. Only you see it.',
  frame: 'A ring around your avatar. Everyone sees it on your posts.',
  badge: 'Shows next to your name. Everyone sees it on your posts.',
};

function errorText(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, '').trim() || 'Something went wrong. Please try again.';
}

export async function loadCatalog(): Promise<StoreItem[]> {
  const { data, error } = await supabase.rpc('store_catalog');
  if (error) throw new Error('Could not load the store. Pull down to try again.');
  return ((data ?? []) as StoreItem[]).map((item) => ({ ...item, price_jmd: Number(item.price_jmd) }));
}

export async function buyItem(id: number) {
  const { error } = await supabase.rpc('buy_item', { item: id });
  if (error) throw new Error(errorText(error.message));
}

/** Wear an item, or take off whatever is in that slot (id null). */
export async function equipItem(id: number | null, slot: StoreCategory) {
  const { error } = await supabase.rpc('equip_item', { item: id, slot });
  if (error) throw new Error(errorText(error.message));
}

/** "3 left" for limited editions, or null. */
export function stockLeft(item: StoreItem) {
  return item.edition_size ? Math.max(0, item.edition_size - item.sold) : null;
}

/** What you can spend right now (same balance as cash-outs). */
export async function loadAvailable(): Promise<number | null> {
  const { data, error } = await supabase.rpc('wallet_summary');
  if (error || !data) return null;
  return Number((data as Record<string, unknown>).available ?? 0) || 0;
}
