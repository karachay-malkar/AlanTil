import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoofCoverRenderer} from '../src/features/tower/roof-cover-scene.js';

class Geometry {
 constructor(){this.userData={};this.attrs={};this.index=[];}
 rotateZ(){return this;}getAttribute(){return {count:0};}
 setAttribute(k,v){this.attrs[k]=v;}setIndex(i){this.index=i;}
 computeVertexNormals(){}dispose(){}
}
class Group {
 constructor(){this.children=[];this.userData={};this.parent=null;}
 add(...c){this.children.push(...c);for(const v of c)v.parent=this;}
 remove(...c){this.children=this.children.filter(v=>!c.includes(v));}
 traverse(fn){fn(this);for(const c of this.children)c.traverse(fn);}
}
class Mesh extends Group {
 constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true;this.position={set(){}};this.userData={};}
}
class InstancedMesh extends Mesh {
 constructor(g,m,n){super(g,m);this.count=n;this.instanceMatrix={};this.isInstancedMesh=true;}
 setMatrixAt(){}setColorAt(){this.instanceColor={};}dispose(){}
}
class Object3D {
 constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
 this.rotation={set(){}};this.scale={set(){}};this.matrix={};}
 updateMatrix(){}
}
class Color {setRGB(r,g,b){this.r=r;this.g=g;this.b=b;return this;}}
class Material {dispose(){}}
const THREE={
 CylinderGeometry:Geometry,ConeGeometry:Geometry,SphereGeometry:Geometry,DataTexture:Material,
 MeshStandardMaterial:Material,MeshBasicMaterial:Material,LineBasicMaterial:Material,
 BufferGeometry:Geometry,Float32BufferAttribute:class{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}},
 Group,Object3D,Mesh,InstancedMesh,Line:Mesh,Color,
 Vector2:class{constructor(x,y){this.x=x;this.y=y;}},
 ShapeUtils:{triangulateShape(points){return Array.from({length:Math.max(0,points.length-2)},(_,i)=>[0,i+1,i+2]);}},
DoubleSide:2,RepeatWrapping:1,LinearMipmapLinearFilter:1,LinearFilter:1,SRGBColorSpace:1
};
const layerOf=(assembly,name)=>assembly.children.find(c=>c.userData?.roofLayer===name);
const extents=geometry=>{
 const pos=geometry.attrs.position.array,values=Array.from({length:pos.length/3},(_,i)=>[pos[i*3],pos[i*3+1],pos[i*3+2]]);
 return [0,1,2].map(k=>[Math.min(...values.map(v=>v[k])),Math.max(...values.map(v=>v[k]))]);
};
test('all 25cm roof cells have a continuous 3D earth surface, closed underside and no gaps between layers',()=>{
 const root=new Group(),roof=createRoofCoverRenderer(THREE,root,()=>{});
 const cells=Array.from({length:6},(_,i)=>[Math.floor(i/2),i%2]);
 roof.setSaved([{id:'test',level:8,cells}]);
 const assembly=root.children[0].children[0];
 const chaff=layerOf(assembly,'chaff'),juniper=layerOf(assembly,'juniper'),earth=layerOf(assembly,'soil');
 assert.ok(chaff&&juniper&&earth,'three solid infill layers');
 assert.equal(earth.geometry.attrs.position.array.length/3,13*9*2,'shared top and bottom earth vertices across all cells');
 assert.equal(earth.geometry.index.length/3,6*4*4*4,'both top and underside have two triangles per subcell');
 const [earthX,earthY,earthZ]=extents(earth.geometry);
 assert.equal(earthX[0],0);assert.equal(earthX[1],.75);
 assert.equal(earthZ[0],0);assert.equal(earthZ[1],.5);
 assert.ok(earthY[0]>=8*.25+.149&&earthY[0]<=8*.25+.151);
 assert.ok(earthY[1]>=8*.25+.237&&earthY[1]<=8*.25+.25);
 const [,chaffY]=extents(chaff.geometry),[,juniperY]=extents(juniper.geometry);
 assert.ok(chaffY[1]>=juniperY[0]+.002,'chaff physically overlaps juniper');
 assert.ok(juniperY[1]>=earthY[0]+.002,'juniper physically overlaps earth');
 assert.ok(chaffY[0]<=8*.25+.097,'chaff touches the rounded wood pole tops');
 for(const m of [chaff,juniper,earth]){
  const [x,,z]=extents(m.geometry);
  assert.deepEqual(x,earthX,'every layer spans the same full-cell X footprint');
  assert.deepEqual(z,earthZ,'every layer spans the same full-cell Z footprint');
 }
 const instances=assembly.children.filter(c=>c.isInstancedMesh);
 assert.ok(instances.length>=6,'wood, fibers, twigs, needles, earth clods and grass as instanced 3D geometry');
 assert.ok(instances.some(c=>c.count>90),'dense plants and compact organic fibers');
 roof.dispose();
});
test('draft points and final roof can be rebuilt and cleared',()=>{
 const root=new Group(),roof=createRoofCoverRenderer(THREE,root,()=>{});
 roof.setDraft({level:3,points:[[3,4],[6,4],[6,6],[3,6]]},[[3,4],[4,4],[5,4],[6,4]]);
 assert.ok(root.children[1].children.length>2);
 roof.setSaved([{id:'single',level:3,cells:[[3,4]]}]);
 assert.ok(root.children[0].children.length>0);
 roof.setDraft(null,[]);roof.setSaved([]);
 assert.equal(root.children[0].children.length,0);
 assert.equal(root.children[1].children.length,0);
 roof.dispose();
});

test('diagonal node contours fill whole 25cm cells of earth exactly like timber (never crop polygon)',()=>{
 const root=new Group(),roof=createRoofCoverRenderer(THREE,root,()=>{});
 const cells=[[2,2],[3,2],[4,2],[5,2],[3,3],[4,3],[4,4]];
 roof.setSaved([{id:'diagonal',level:6,points:[[2,2],[5,2],[4,4]],cells}]);
 const assembly=root.children[0].children[0];
 const expected=new Set(cells.map(c=>c.join(',')));
 for(const name of ['soil','juniper','chaff']){
  const m=layerOf(assembly,name);
  assert.ok(m,name+' exists');
  const pos=m.geometry.attrs.position.array,index=m.geometry.index;
  assert.ok(index.length>0);
  for(let i=0;i<index.length;i+=3){
   const pts=[0,1,2].map(d=>{const k=index[i+d]*3;return [pos[k],pos[k+2]];});
   const cx=pts.reduce((s,p)=>s+p[0],0)/3,cz=pts.reduce((s,p)=>s+p[1],0)/3;
   const key=[Math.floor(cx/.25),Math.floor(cz/.25)].join(',');
   assert.ok(expected.has(key),name+' triangle must stay inside the same chosen 25cm cell mask: '+key);
  }
  const [x,,z]=extents(m.geometry);
  assert.equal(x[0],.5);assert.equal(x[1],1.5);
  assert.equal(z[0],.5);assert.equal(z[1],1.25);
 }
 roof.dispose();
});

test('picking a saved roof identifies its persistent id for exact refund',()=>{
 const root=new Group(),roof=createRoofCoverRenderer(THREE,root,()=>{});
 roof.setSaved([{id:'paid-roof',level:8,cells:[[2,2]]}]);
 const section=root.children[0].children[0];
 assert.equal(roof.pickRoof({intersectObjects:()=>[{object:section.children[0]}]}),'paid-roof');
 roof.dispose();
});
