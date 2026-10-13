/** Visual-only V2 masonry section mapping. No mutation, payment or save format changes.
 * Server-validated V2 elements retain their original geometry and ownership.
 */
const STONE_TYPES = new Set(['stone', 'medium', 'long', 'big']);
export function toMasonrySections(blocks, layer = null) {
  if (!Array.isArray(blocks)) throw new TypeError('Invalid tower blocks');
  return blocks.filter(b => STONE_TYPES.has(b?.type) && (layer === null || b.y <= layer))
    .map(b => ({...b, type: 'masonry_section'}));
}
/** Works with historical InstancedMesh and worker-built section BufferGeometry. */
export function getPickedTowerBlock(hit) {
  if (!hit?.object?.userData) return null;
  const data = hit.object.userData;
  return data.block || (Number.isInteger(hit.instanceId) ? data.blocks?.[hit.instanceId] || null : null);
}
