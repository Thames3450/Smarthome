import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {icon} from '../src/icons.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('Keep the 54 original user-provided icons for source attribution and reference',()=>{
  const files=readdirSync(resolve(root,'assets/icons')).filter(x=>x.endsWith('.png'));
  assert.equal(files.length,54);
});

test('All 28 in-use Streamline icons have valid embedded PNGs, independent of asset paths',()=>{
  const code=readFileSync(resolve(root,'src/icons.js'),'utf8');
  const names=['home','house','layout','plug','calendar','settings','users','bell','wifi','search','bulb','thermometer','chart','activity','clock','trash','check','logout','cloud','link','snowflake','fan','power','alert','cpu','router','wallet','refresh'];
  for(const name of names){
    const markup=icon(name,22);
    assert.match(markup,/<span class="st-icon"/);
    assert.match(markup,/data:image\/png;base64,/);
    assert.doesNotMatch(markup,/assets\/icons|Streamline-Ultimate\.png/);
    const encoded=markup.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)[1];
    const png=Buffer.from(encoded,'base64');
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
    assert.ok(png.length>300, name);
  }
  assert.equal((code.match(/data:image\/png;base64,/g)||[]).length,28);
});

test('Color-masking and original SVG fallback remain functional',()=>{
  const css=readFileSync(resolve(root,'src/icon-theme.css'),'utf8');
  assert.match(css,/-webkit-mask-image/);
  assert.match(css,/mask-image/);
  assert.match(css,/device-icon/);
  assert.match(icon('arrow',20),/<svg /);
  assert.match(icon('bolt',20),/<svg /);
  assert.match(icon('home',22),/width:22px;height:22px/);
});

test('Cloud and PWA use versioned assets and do not precache icons separately',()=>{
  const sw=readFileSync(resolve(root,'sw.js'),'utf8');
  const html=readFileSync(resolve(root,'index.html'),'utf8');
  assert.match(sw,/home-thames-shell-v2-6/);
  assert.doesNotMatch(sw,/ICON_ASSETS/);
  assert.match(html,/app\.js\?v=2\.5/);
  assert.match(html,/icon-theme\.css\?v=2\.5/);
});
