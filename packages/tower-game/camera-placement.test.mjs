import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeStonePlacement,confirmStonePlacement} from './camera-placement.mjs';
const args={camera:{origin:[0,1,-5],forward:[0,0,1]},stone:{},anchors:[[0,1,0]],collides:()=>false,support:()=>1,inside:()=>true};
test('offers position near camera gaze',()=>assert.ok(proposeStonePlacement(args)));
test('rejects collisions',()=>assert.equal(proposeStonePlacement({...args,collides:()=>true}),null));
test('rejects insufficient support',()=>assert.equal(proposeStonePlacement({...args,support:()=>0}),null));
test('rechecks before confirmation',()=>assert.equal(confirmStonePlacement(proposeStonePlacement(args),{...args,collides:()=>true}),null));
