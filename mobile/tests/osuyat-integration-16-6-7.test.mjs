import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const exists=(relative)=>fs.existsSync(path.join(root,relative));

test('osuyat has one shared public URL',()=>{
  const shared=read('packages/alantil-core/external-games.js');
  assert.match(shared,/OSUYAT_URL/);
  assert.match(shared,/https:\/\/3d-5lcon9\.v2\.appdeploy\.ai\//);
});

test('mobile Practice exposes osuyat without changing internal learning state',()=>{
  const app=read('mobile/AppRoot.js');
  const practice=read('mobile/screens/practice.js');
  assert.match(app,/WebBrowser\.openBrowserAsync\(OSUYAT_URL\)/);
  assert.match(app,/trackNativeEvent\('osuyat_open'/);
  assert.match(app,/openOsuyat=\{openOsuyat\}/);
  assert.match(practice,/title="osuyat"/);
  assert.match(practice,/onPress=\{openOsuyat\}/);
});

test('mobile splash and launcher icon use the supplied mark',()=>{
  const config=JSON.parse(read('mobile/app.json'));
  const app=read('mobile/AppRoot.js');
  assert.equal(config.expo.version,'16.6.7');
  assert.equal(config.expo.icon,'./assets/osuyat.png');
  assert.equal(config.expo.splash.image,'./assets/osuyat.png');
  assert.equal(config.expo.android.adaptiveIcon.foregroundImage,'./assets/osuyat.png');
  assert.equal(config.expo.web.favicon,'./assets/osuyat.png');
  assert.match(app,/OSUYAT_MARK=require\('\.\/assets\/osuyat\.png'\)/);
  assert.match(app,/source=\{OSUYAT_MARK\}/);
  assert.ok(exists('mobile/assets/osuyat.png'));
});

test('web Practice exposes osuyat and the site icon asset exists',()=>{
  const practice=read('src/features/practice/index.js');
  assert.match(practice,/external-games\.js/);
  assert.match(practice,/data-practice-external="osuyat"/);
  assert.match(practice,/trackEvent\("osuyat_open"/);
  assert.match(practice,/window\.open\(OSUYAT_URL/);
  assert.match(practice,/assets\/images\/osuyat\.png/);
  assert.ok(exists('assets/images/osuyat.png'));
  assert.ok(exists('favicon.ico'));
});
