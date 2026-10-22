export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'fundlelo_theme';

export function getTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = (localStorage.getItem(THEME_KEY) || localStorage.getItem('theme')) as ThemeMode | null;
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  // Default to Deep Midnight Navy Dark Mode for Fund Lelo
  return 'dark';
}

export function setTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, mode);
  localStorage.setItem('theme', mode);
  
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function toggleTheme(): ThemeMode {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme(): ThemeMode {
  const mode = getTheme();
  setTheme(mode);
  return mode;
}
