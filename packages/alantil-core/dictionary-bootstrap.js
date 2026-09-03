export async function bootstrapDictionaryRuntime({readCache,bundledSnapshot,downloadSnapshot,starterSnapshot,persistSnapshot,refreshSnapshot}){
  const cached=await readCache();
  if(cached){void Promise.resolve(refreshSnapshot?.()).catch(()=>{});return cached;}
  const bundled=bundledSnapshot();
  if(bundled){void Promise.resolve(persistSnapshot?.(bundled)).catch(()=>{});void Promise.resolve(refreshSnapshot?.()).catch(()=>{});return bundled;}
  try{return await downloadSnapshot();}catch{return starterSnapshot();}
}
