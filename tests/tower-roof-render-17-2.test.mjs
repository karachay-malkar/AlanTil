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
 constructor(){this.children=[];}
 add(...c){this.children.push(...c);}
 remove(...c){this.children=this.children.filter(v=>!c.includes(v));}
 traverse(fn){fn(this);for(const c of this.children)c.traverse(fn);}
}
class Mesh extends Group {
 constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true;this.position={set(){}};}
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
 DoubleSide:2,RepeatWrapping:1,LinearMipmapLinearFilter:1,LinearFilter:1,SRGBColorSpace:1
};
test('contiguous 3 by 2 modules share soil vertices and remain 25cm thick',()=>{
 const root=new Group(),roof=createRoofCoverRenderer(THREE,root,()=>{});
 const cells=Array.from({length:6},(_,i)=>[Math.floor(i/2),i%2]);
 roof.setSaved([{id:'test',level:8,cells}]);
 const children=root.children[0].children[0].children;
 const terrain=children.find(c=>c.geometry?.attrs?.uv);
 assert.ok(terrain);
 assert.equal(terrain.geometry.attrs.position.array.length/3,13*9);
 assert.equal(terrain.geometry.index.length/3,3*2*4*4*2);
 for(let i=1;i<terrain.geometry.attrs.position.array.length;i+=3){
  const h=terrain.geometry.attrs.position.array[i]-8*.25;
  assert.ok(Number.isFinite(h)&&h>=.237-1e-7&&h<=.25+1e-7);
 }
 const instances=children.filter(c=>c.isInstancedMesh);
 assert.ok(instances.length>=5);
 assert.ok(instances.some(c=>c.count>90),'dense grass / chaff geometry');
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
