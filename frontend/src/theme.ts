export type Theme = 'system' | 'light' | 'dark'

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('hiredove_theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch { return 'system' }
}

export function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}
