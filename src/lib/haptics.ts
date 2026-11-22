/** Small buzzes on phones: a tap on main buttons, a cheer on wins. Nothing on the web. */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS === 'ios' || Platform.OS === 'android';

export function tap() {
  if (on) Haptics.selectionAsync().catch(() => {});
}

export function press() {
  if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function cheer() {
  if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
