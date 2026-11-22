/** Lets a part of the screen swap a few theme colours (a store card skin recolours the big balance cards). */
import { createContext, useContext, type ReactNode } from 'react';

export type ColorOverride = Partial<Record<'accent' | 'onAccent' | 'accentText' | 'accentSoft', string>>;

const OverrideContext = createContext<ColorOverride | null>(null);

export function ThemeOverride({ value, children }: { value: ColorOverride | null; children: ReactNode }) {
  return <OverrideContext.Provider value={value}>{children}</OverrideContext.Provider>;
}

export function useColorOverride() {
  return useContext(OverrideContext);
}
