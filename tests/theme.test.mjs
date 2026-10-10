import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('theme state is persisted and applied to the HTML root',()=>{
 const theme=read('src/lib/theme.ts');
 assert.match(theme,/home-thames-ui-theme/);
 assert.match(theme,/localStorage\.getItem/);
 assert.match(theme,/localStorage\.setItem/);
 assert.match(theme,/document\.documentElement\.dataset\.theme=theme/);
 assert.match(theme,/prefers-color-scheme: dark/);
});
test('theme switch works from topbar and login screen and Settings',()=>{
 const app=read('src/App.tsx');
 assert.match(app,/themeButton\('header-theme'\)/);
 assert.match(app,/themeButton\('auth-theme'\)/);
 assert.match(app,/onClick=\{\(\)=>setTheme\('dark'\)\}/);
 assert.match(app,/onClick=\{\(\)=>setTheme\('light'\)\}/);
 assert.match(app,/aria-pressed=/);
});
test('dark theme covers full app including dialogs, navigation, inputs and charts',()=>{
 const app=read('src/App.tsx');
 const css=read('src/themes.css');
 assert.match(css,/data-theme="dark"\] \.modal/);
 assert.match(css,/data-theme="dark"\] \.sidebar/);
 assert.match(css,/data-theme="dark"\] \.mobile-bottom/);
 assert.match(css,/data-theme="dark"\] \.auth-screen/);
 assert.match(css,/data-theme="dark"\] \.field input/);
 assert.match(app,/theme==='dark'\?'#324565'/);
 assert.match(read('src/main.tsx'),/import '\.\/themes\.css'/);
});
