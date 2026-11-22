/** The kinds of paid work in the app (what each one is and where it opens). Pay comes from task_rates. */
import type { Href } from 'expo-router';

import type { IconName } from '@/components/kit';

export type Task = {
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  tone: 'accent' | 'reward';
  href: Href;
  description: string;
  /** A short label on the Work card. */
  tag?: string;
};

export const tasks: Task[] = [
  {
    id: 'talk',
    tag: 'Best pay',
    tone: 'accent',
    title: 'Talk with the AI',
    detail: 'Pick a topic and chat in Patois',
    icon: 'chat',
    href: '/talk' as Href,
    description: 'Chat in Patois and correct the AI when it gets it wrong.',
  },
  {
    id: 'voice',
    tag: 'Hands-free',
    tone: 'accent',
    title: 'Voice chat',
    detail: 'Talk out loud in Patois',
    icon: 'mic',
    href: '/voice' as Href,
    description: 'Talk out loud with the AI and fix what it heard.',
  },
  {
    id: 'record',
    tag: 'Quick',
    tone: 'reward',
    title: 'Record lines',
    detail: 'Read 10 short Patois lines aloud',
    icon: 'waveform',
    href: '/record' as Href,
    description: 'Read short Patois lines aloud.',
  },
  {
    id: 'verify',
    tag: 'Easy',
    tone: 'accent',
    title: 'Verify work',
    detail: 'Check 10 lines and fixes · 5 min',
    icon: 'check',
    href: '/verify' as Href,
    description: "Listen and check other people's lines and fixes. Your vote is compared with the group.",
  },
  {
    id: 'teach',
    tag: 'Coming soon',
    tone: 'reward',
    title: 'Teach: describe a clip',
    detail: '1 video · 1 min',
    icon: 'video',
    href: '/feed' as Href,
    description: "Say what's happening in a video, in Patois.",
  },
];
