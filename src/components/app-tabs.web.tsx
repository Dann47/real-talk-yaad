import { type Href } from 'expo-router';
import { TabList, TabListProps, TabSlot, TabTrigger, TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/kit';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; href: string; label: string }[] = [
  { name: 'index', href: '/', label: 'Home' },
  { name: 'work', href: '/work', label: 'Work' },
  { name: 'feed', href: '/feed', label: 'Feed' },
  { name: 'wallet', href: '/wallet', label: 'Wallet' },
  { name: 'profile', href: '/profile', label: 'Me' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as Href} asChild>
              <TabButton>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    // @ts-expect-error Expo template: TabTrigger's ref type does not match Pressable's.
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          { backgroundColor: isFocused ? theme.accentSoft : 'transparent' },
        ]}>
        <T variant="smallStrong" color={isFocused ? 'accentText' : 'textSecondary'}>
          {children}
        </T>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        style={[
          styles.innerContainer,
          {
            backgroundColor: theme.background,
            borderColor: theme.backgroundSelected,
            boxShadow: `0 4px 20px ${theme.shadow}`,
          },
        ]}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.accent }]}>
            <T variant="caption" style={{ color: theme.onAccent }}>
              RT
            </T>
          </View>
          <T variant="bodyStrong">Real Talk Yaad</T>
        </View>
        <View style={styles.tabs}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginRight: 'auto',
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
