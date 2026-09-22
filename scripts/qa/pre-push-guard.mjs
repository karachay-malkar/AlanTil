import {assertCleanWorktree, currentRevision, readQaMarker} from './lib.mjs';

try {
  assertCleanWorktree();
  const current = currentRevision();
  const marker = readQaMarker();
  if (!marker) throw new Error('No successful Final QA marker found. Run npm run qa:final before the final push.');
  if (marker.sha !== current.sha || marker.tree !== current.tree) {
    throw new Error(`Final QA is stale. Verified ${marker.sha || 'unknown'}, current ${current.sha}. Run npm run qa:final again.`);
  }
  console.log(`Final QA verified for ${current.sha.slice(0, 12)}.`);
} catch (error) {
  console.error(`\nPush blocked: ${error.message}\n`);
  process.exit(1);
}
