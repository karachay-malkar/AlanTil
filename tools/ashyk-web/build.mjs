import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const toolRoot=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(toolRoot,'../..');
const defaultOutfile=path.join(root,'src/features/ashyk/runtime.js');

export async function buildAshykRuntime(outfile=defaultOutfile){
  const depsRoot=process.env.ASHYK_WEB_DEPS_ROOT?path.resolve(process.env.ASHYK_WEB_DEPS_ROOT):toolRoot;
  const requireFromDeps=createRequire(path.join(depsRoot,'package.json'));
  const {build}=requireFromDeps('esbuild');
  await build({
    entryPoints:[path.join(root,'packages/ashyk-game/web/entry.jsx')],
    outfile,
    bundle:true,
    format:'esm',
    platform:'browser',
    target:['es2022'],
    jsx:'automatic',
    minify:true,
    sourcemap:false,
    legalComments:'none',
    treeShaking:true,
    nodePaths:[path.join(depsRoot,'node_modules')],
    define:{'process.env.NODE_ENV':'"production"'},
  });
  return outfile;
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const arg=process.argv.find(value=>value.startsWith('--outfile='));
  await buildAshykRuntime(arg?path.resolve(arg.slice('--outfile='.length)):defaultOutfile);
}
