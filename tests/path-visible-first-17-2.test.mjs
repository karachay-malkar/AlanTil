import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

test("visible stations start in route order before nearby stations, and abort stops loading", async () => {
 const source=await readFile(new URL("../src/features/path/feature.js",import.meta.url),"utf8");
 const requests=[],signal=new AbortController();
 let rescan;
 const station=(order,top,bottom)=>{
  const image={dataset:{stageSrc:String(order)},set src(value){requests.push([Number(value),this.fetchPriority]);}};
  return {dataset:{stageOrder:String(order)},querySelector:()=>image,querySelectorAll:()=>[image],getBoundingClientRect:()=>({top,bottom})};
 };
 const viewport={
  getBoundingClientRect:()=>({top:100,bottom:500}),
  querySelectorAll:()=>[station(9,-600,-450),station(4,-40,10),station(3,220,320),station(1,350,430)],
  addEventListener(){}
 };
 const context=vm.createContext({viewport,signal:signal.signal,window:{addEventListener(){}},
  MutationObserver:class{constructor(fn){rescan=fn;}observe(){}disconnect(){}},
  requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){}});
 vm.runInContext(source.slice(source.indexOf("function loadVisibleRouteImages"),source.indexOf("function stationButton")),context);
 vm.runInContext("loadVisibleRouteImages(viewport,signal)",context);
 assert.deepEqual(requests,[[1,"high"],[3,"high"],[4,"low"]]);
 signal.abort();
 rescan();
 assert.equal(requests.length,3);
});
