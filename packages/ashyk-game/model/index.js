import { UI_TOKENS } from '../../alantil-ui/tokens.js';
import { COZAIM_INDICES, COZAIM_POSITIONS, COZAIM_POSITION_SCALE } from './cozaimGeometry.js';

export * from './cozaimGeometry.js';
export * from './wood-board.js';

export const ASHYK_MODEL_SIZE = 1.82;
export const ASHYK_MODEL_MATERIAL = Object.freeze({ color: 0xd8b784, roughness: 0.86, metalness: 0 });
export const ASHYK_SCENE_MATERIALS = Object.freeze({
  background: UI_TOKENS.colors.appBg,
  board: Object.freeze({ color: '#9a6840', roughness: 0.92, metalness: 0 }),
  rail: Object.freeze({ color: '#70482f', roughness: 0.95, metalness: 0 }),
  trajectory: '#595653',
});

export function createAshykGeometry(THREE) {
  const positions = new Float32Array(COZAIM_POSITIONS.length);
  for (let index = 0; index < COZAIM_POSITIONS.length; index += 1) positions[index] = COZAIM_POSITIONS[index] * COZAIM_POSITION_SCALE;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.Uint16BufferAttribute(COZAIM_INDICES, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createAshykVisual(THREE, id) {
  const geometry = createAshykGeometry(THREE);
  const material = new THREE.MeshStandardMaterial(ASHYK_MODEL_MATERIAL);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const source = new THREE.Group();
  source.add(mesh);
  source.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(source);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const maxDimension = Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  if (maxDimension === initialSize.y) source.rotation.z = -Math.PI / 2;
  else if (maxDimension === initialSize.z) source.rotation.y = Math.PI / 2;
  source.updateMatrixWorld(true);
  const alignedBox = new THREE.Box3().setFromObject(source);
  const alignedSize = alignedBox.getSize(new THREE.Vector3());
  source.scale.multiplyScalar(ASHYK_MODEL_SIZE / Math.max(alignedSize.x, alignedSize.y, alignedSize.z, 0.001));
  source.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(source);
  source.position.sub(scaledBox.getCenter(new THREE.Vector3()));
  source.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = 'ashyk-' + id;
  group.userData.ashykId = id;
  group.add(source);
  group.traverse((object) => { object.userData.ashykId = id; });
  return group;
}
