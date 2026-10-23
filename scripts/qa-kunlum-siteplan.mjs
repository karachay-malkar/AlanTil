/**
 * Reproducible layout invariants for the illustrative Kunlum terrace plan.
 * Run: node scripts/qa-kunlum-siteplan.mjs
 */
import assert from "node:assert/strict";
import {getKunlumSiteLayout} from "../src/features/tower/kunlum-site-plan.js";
const {plan,parcels,paths,terraces,pairs}=getKunlumSiteLayout();
const r=plan.reserve;
assert.ok(parcels.length>=250,"Expected dense stepped quarter topology");
assert.ok(pairs.length>200,"Lower/upper adjacency must be meaningful");
assert.ok(paths.length>=4,"Alleys should separate house strips");
for(const p of parcels) {
 assert.ok(Number.isFinite(p.x0+p.x1+p.z0+p.z1),p.id+" invalid coordinates");
 assert.ok(p.x0<p.x1&&p.z0<p.z1,p.id+" invalid footprint");
 assert.ok(!(p.x0<r.x[1]&&p.x1>r.x[0]&&p.z0<r.z[1]&&p.z1>r.z[0]),
   p.id+" intrudes into future 40×50 reserve");
}
const byId=new Map(parcels.map(p=>[p.id,p]));
for(const link of pairs) {
 const lower=byId.get(link.lower),upper=byId.get(link.upper);
 assert.ok(lower&&upper,link.lower+" adjacency missing");
 assert.ok(Math.abs(lower.z1-upper.z0)<.04,link.lower+" not touching upper plot");
 assert.ok(link.overlapX[1]-link.overlapX[0]>2,link.lower+" has no shared rooftop frontage");
}
for(const p of parcels) {
 const others=parcels.filter(q=>q.row===p.row&&q.id!==p.id);
 for(const q of others)assert.ok(q.x1<=p.x0+1e-8||q.x0>=p.x1-1e-8,
  p.id+" overlaps "+q.id);
}
console.log(JSON.stringify({ok:true,parcels:parcels.length,roofAdjacency:pairs.length,
 terraces:terraces.length,alleys:paths.length}));
