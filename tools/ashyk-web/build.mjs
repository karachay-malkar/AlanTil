import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const toolRoot=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(toolRoot,'../..');
await build({
  entryPoints:[path.join(root,'packages/ashyk-game/web/entry.jsx')],
  outfile:path.join(root,'src/features/ashyk/runtime.js'),
  bundle:true,
  format:'esm',
  platform:'browser',
  target:['es2022'],
  jsx:'automatic',
  minify:true,
  sourcemap:false,
  legalComments:'none',
  treeShaking:true,
  nodePaths:[path.join(toolRoot,'node_modules')],
  define:{'process.env.NODE_ENV':'"production"'},
});
