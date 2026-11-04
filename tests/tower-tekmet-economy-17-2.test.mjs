import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TEKMET_PRICE,TEKMET_REWARD,tekmetSectionCost,tekmetRoofCost,tekmetIcon} from '../packages/tower-game/tekmet-economy.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('one currency, approved rewards 1, 4, 2',()=>{
 assert.deepEqual(TEKMET_REWARD,{beginner:1,intermediate:4,thematic:2});
});
test('all approved prefab costs and long beams',()=>{
 for(const [id,cost] of Object.entries({
  '1x1x1':1,'2x2x2':2,'2x2x3':3,'2x3x4':5,'4x4x4':8,'3x3x3':4,
  'window-4x5x2':10,'door-7x9x2':15,'gate-18x10x2':40,
  'bagana-2x10x2':10,'bagana-f2-3x11x3':10,
  'roof-beam-1':1,'roof-beam-2':1,'roof-beam-3':2,
  'roof-beam-4':2,'roof-beam-5':3,'roof-beam-40':20
 }))assert.equal(tekmetSectionCost(id),cost,id);
 assert.equal(tekmetSectionCost('unsafe-element'),null);
 assert.equal(tekmetRoofCost(1),1);
 assert.equal(tekmetRoofCost(16),16);
 assert.equal(tekmetRoofCost(0),0);
 assert.equal(tekmetRoofCost(-1),null);
});
test('gold Tekmet vector has traditional circular frame, concave square and central dot',()=>{
 const coin=tekmetIcon('icon');
 assert.match(coin,/<svg/);assert.match(coin,/circle cx="24" cy="24"/);
 assert.match(coin,/Q24 19\.2/);assert.match(coin,/r="3"/);
 assert.doesNotMatch(coin,/script|onload|foreignObject/i);
});
test('migration clears ONLY user buildings, leaves shared 3D templates and study rewards',()=>{
 const m=source('supabase/migrations/20261101141500_tower_tekmet_wallet_rewards_costs_reset_172.sql');
 for(const p of ['DELETE FROM private.tower_v3_roofs','DELETE FROM private.tower_v3_sections','DELETE FROM private.tower_v2_elements'])assert.ok(m.includes(p));
 assert.doesNotMatch(m,/DELETE FROM private\.tower_v2_shapes|TRUNCATE\s+private\.tower_v2_shapes/i);
 assert.doesNotMatch(m,/DELETE FROM private\.tower_word_rewards/i);
 assert.match(m,/tekmet=50\+COALESCE/);
 assert.match(m,/ON CONFLICT \(user_id,word_id\) DO NOTHING/);
 assert.match(m,/RETURNING tekmet INTO balance_now/);
 assert.match(m,/refund/);
});
test('server stores paid amounts and returns full original cost for removals and clearing',()=>{
 const m=source('supabase/migrations/20261101141500_tower_tekmet_wallet_rewards_costs_reset_172.sql');
 assert.match(m,/cost_silver,tekmet_paid/);
 assert.match(m,/SELECT tekmet_paid INTO refund FROM private\.tower_v3_sections/);
 assert.match(m,/SELECT tekmet_paid INTO refund FROM private\.tower_v3_roofs/);
 assert.match(m,/SELECT COALESCE\(sum\(tekmet_paid\),0\) INTO refund/);
 assert.match(m,/INSERT INTO private\.tower_v3_roof_receipts/);
 assert.match(m,/RAISE EXCEPTION 'INSUFFICIENT_TEKMET'/);
});
test('client checks wallet before confirm and supports refunding finished roofs',()=>{
 const ui=source('src/features/tower/index.js');
 const scene=source('src/features/tower/prefab-scene.js');
 const store=source('src/features/tower/repository.js');
 assert.match(ui,/data-tekmet-wallet/);
 assert.match(ui,/data-tekmet-price/);
 assert.match(ui,/price>s\.tekmetBalance/);
 assert.match(ui,/markRoofSelection\(/);
 assert.match(ui,/removeTowerRoof/);
 assert.match(scene,/onRoofSelection/);
 assert.match(store,/remove_tower_roof/);
});
