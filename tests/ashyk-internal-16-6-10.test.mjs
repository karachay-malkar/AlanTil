import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const practice=fs.readFileSync(new URL('../src/features/practice/index.js',import.meta.url),'utf8');
const practiceCss=fs.readFileSync(new URL('../src/features/practice/practice.css',import.meta.url),'utf8');
const serviceWorker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const gamePath=new URL('../assets/ashyk-game/index.html',import.meta.url);
const mobileGamePath=new URL('../mobile/assets/ashyk-game/index.html',import.meta.url);
const migration=fs.readFileSync(new URL('../supabase/migrations/20260914_ashyk_online_rooms.sql',import.meta.url),'utf8');
const hash=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
const count=(text,re)=>(text.match(re)||[]).length;
const visibleMarkup=(html)=>html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<[^>]+>/g,' ')
  .replace(/\s+/g,' ')
  .trim();

test('web Practice keeps the Alan Til shell header and bridges the real Medium roots dictionary',()=>{
  assert.match(practice,/data-ashyk-game/);
  assert.match(practice,/Ашыкъ оюн/);
  assert.match(practice,/\/assets\/ashyk-game\/index\.html\?v=16\.6\.10\.3/);
  assert.doesNotMatch(practice,/appdeploy\.ai/i);
  assert.match(practice,/getWords/);
  assert.match(practice,/dictionaryId !== "intermediate"/);
  assert.match(practice,/storyId !== "roots"/);
  assert.match(practice,/usedInTest !== true/);
  assert.match(practice,/configureScreen\?\.\("test\.menu"\)/);
  assert.match(practice,/setHeaderContent\?\.\(\{ title: "Ашыкъ оюн" \}\)/);
  assert.doesNotMatch(practice,/ashykGameHeader/);
  assert.match(practiceCss,/inset:calc\(var\(--safe-top,0px\) \+ var\(--header-h,42px\)\) 0 0/);
  assert.match(practice,/subscribeToAuth/);
  assert.match(practice,/ashyk-auth-request/);
  assert.match(practice,/alantil-auth/);
  assert.match(practice,/ashyk-dictionary-request/);
  assert.match(practice,/alantil-dictionary/);
  assert.match(serviceWorker,/const VERSION = "13\.15\.12\.7"/);
  assert.match(serviceWorker,/NETWORK_FIRST_PATHS[\s\S]*"\/assets\/ashyk-game\/index\.html"/);

  const embedded=fs.readFileSync(gamePath);
  const html=embedded.toString('utf8');
  assert.ok(embedded.length>100000,'embedded game must be a real self-contained build');
  assert.match(html,/<meta name="theme-color" content="#eee9df">/i);
  assert.match(html,/<script type="module">/i);
  assert.equal(count(html,/<\/script>/gi),1,'only the wrapper may contain a literal closing script tag');
  assert.match(html,/<style>/i);
  assert.equal(count(html,/<\/style>/gi),1,'only the wrapper may contain a literal closing style tag');
  assert.doesNotMatch(html,/appdeploy\.ai|__APPDEPLOY_APP_ID|request-latency-log-v1/i);
  assert.doesNotMatch(html,/\b(?:src|href)=["'][^"']+(?:assets\/|resources\/)[^"']*["']/i);
  assert.equal(visibleMarkup(html),'Ашыкъ оюн','minified JavaScript must never leak into visible HTML');
  assert.equal(hash(embedded),hash(fs.readFileSync(mobileGamePath)),'web and mobile must ship the identical game engine');
});

test('online room migration keeps member-only realtime state and active-turn writes',()=>{
  assert.match(migration,/alter table public\.ashyk_rooms enable row level security/i);
  assert.match(migration,/grant select on public\.ashyk_rooms to authenticated/i);
  assert.match(migration,/auth\.uid\(\).*host_user_id/s);
  assert.match(migration,/uid <> room\.active_user_id/i);
  assert.match(migration,/room\.revision <> expected_revision/i);
  assert.match(migration,/alter publication supabase_realtime add table public\.ashyk_rooms/i);
});
