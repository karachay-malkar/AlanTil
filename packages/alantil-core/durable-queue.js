// Serialize storage mutations, never network I/O. Acknowledgements remove only
// the exact revision sent, so an edit made during a request survives its reply.
export function createDurableQueue({read,write}){
 const pending=new Map();
 function mutate(key,update){
  const run=(pending.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
   const current=await read(key),next=update(current);await write(key,next);return next;
  });
  pending.set(key,run);const clean=()=>{if(pending.get(key)===run)pending.delete(key);};run.then(clean,clean);return run;
 }
 return {mutate,read:async key=>{await pending.get(key);return read(key);},acknowledge:(key,sent)=>mutate(key,rows=>rows.filter(row=>JSON.stringify(row)!==JSON.stringify(sent)))};
}
