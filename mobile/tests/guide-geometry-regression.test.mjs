import test from 'node:test';
import assert from 'node:assert/strict';
import {localGuideRect,expandGuideRect,placeGuidePanel} from '../../packages/alantil-ui/guide-geometry.js';
test('spotlight center survives status bar, safe-area and parent offsets',()=>{
 for(const y of [0,24,38,48,80]) {
  const target={x:340,y:700+y,width:32,height:40};
  const local=localGuideRect(target,{x:0,y});
  const hole=expandGuideRect(local,8,64,64,'circle');
  assert.equal(hole.x+hole.width/2,356);
  assert.equal(hole.y+hole.height/2,720);
 }
});
test('minimum spotlight size expands symmetrically without shifting the button',()=>{
 const hole=expandGuideRect({x:2,y:3,width:20,height:30},4,90,44,'pill');
 assert.equal(hole.x+hole.width/2,12);assert.equal(hole.y+hole.height/2,18);
});
test('all Learn guide phases use the card anchor and avoid its bottom actions',()=>{
 const target={x:8,y:100,width:374,height:620};
 const avoids=[{x:20,y:670,width:40,height:40},{x:340,y:670,width:32,height:40}];
 for(const holes of [[target],[avoids[1]],[{x:280,y:0,width:100,height:40}],[target,{x:100,y:760,width:190,height:64}]]){
  const panel=placeGuidePanel({width:390,height:844,panelHeight:160,target,holes,avoids,preference:'inside-bottom'});
  assert.equal(panel.top,496);assert.equal(panel.left,15);
  assert.ok(panel.top+160<=670-14);
 }
});
