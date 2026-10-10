/** Home Thames appearance preferences. Only a visual preference is stored. */
export type Theme='light'|'dark';
const STORAGE_KEY='home-thames-ui-theme';

export function getInitialTheme():Theme{
  try{
    const saved=window.localStorage.getItem(STORAGE_KEY);
    if(saved==='light'||saved==='dark') return saved;
  }catch{ /* Private browsing may disallow storage. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
}

export function applyTheme(theme:Theme):void{
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0d172b':'#f6f8fd');
  try {window.localStorage.setItem(STORAGE_KEY,theme);} catch{/* Keep theme active in this session. */}
}
