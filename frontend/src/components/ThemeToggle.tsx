import { useEffect, useState } from 'react'
import { applyTheme, readTheme, type Theme } from '../theme'
import { ModuleSelect } from './ModuleSelect'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('hiredove_theme', theme) } catch { /* Preference is optional. */ }
  }, [theme])
  return <ModuleSelect compact label="Тема оформлення" value={theme} onChange={value => setTheme(value as Theme)}
    options={[{ value: 'system', label: 'Системна' }, { value: 'light', label: 'Світла' }, { value: 'dark', label: 'Темна' }]} />
}
