export interface ThemeConfig {
  id: string;
  label: string;
  hasEffects: boolean;
  effects?: ('snow' | 'fireworks' | 'neon')[];
}

export const THEME_NAME_MAP: Record<string, string> = {
  'theme-1': 'theme-one',
  'theme-2': 'theme-two',
  'theme-3': 'theme-three',
  'theme-4': 'theme-four',
  'theme-5': 'theme-tron', // ✅ IMPORTANT
  'theme-6': 'theme-christmas' // ✅ IMPORTANT
};


export const THEMES: ThemeConfig[] = [
  { id: 'tron', label: 'TRON', hasEffects: true, effects: ['neon'] },
  { id: 'christmas', label: 'Christmas', hasEffects: true, effects: ['snow'] },
  { id: 'new-year', label: 'New Year', hasEffects: true, effects: ['fireworks'] }
];
