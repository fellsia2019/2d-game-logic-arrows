export type Theme = 'dark' | 'light';
export const currentTheme = (): Theme => document.documentElement.dataset.theme as Theme | undefined
  ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export function toggleTheme(): Theme {
  const theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  return theme;
}
