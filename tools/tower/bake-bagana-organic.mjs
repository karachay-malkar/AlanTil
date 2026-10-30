/** Rebuild the 15 organic Bagana GLBs from the original 17.2.43 binary assets.
 * Usage: node tools/tower/bake-bagana-organic.mjs <original-architecture-dir> <output-dir>
 * Input MUST be the unmodified v3/v4 source models; v5 assets reject rebaking.
 * Does not overwrite the source directory.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {sculptBaganaGlb} from './bagana-organic-mesh.mjs';
const [inputDir,outputDir]=process.argv.slice(2);
if(!inputDir||!outputDir)throw Error('Pass source and destination directories');
const input=path.resolve(inputDir),output=path.resolve(outputDir);
if(input===output)throw Error('Use a separate destination; original GLBs are immutable');
await mkdir(output,{recursive:true});
let count=0;
for(let form=1;form<=3;form++)for(const woodCells of [8,9,10,11,12]){
 const filename='bagana-f'+form+'-3x'+(woodCells+1)+'x3-v2.glb';
 const bytes=await readFile(path.join(input,filename));
 const {metrics}=sculptBaganaGlb(bytes,{form,woodCells});
 if(metrics.maxDelta<.025||metrics.maxDelta>.09)throw Error('Unexpected deformation: '+filename);
 await writeFile(path.join(output,filename),bytes);
 console.log(filename,JSON.stringify(metrics));count++;
}
if(count!==15)throw Error('Not all Bagana models rebuilt');
