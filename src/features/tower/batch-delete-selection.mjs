/** Ephemeral editor selection; no persistent tower state is changed. */
export function toggleBatchSelection(selected,id,blocks){
 const next=new Set(selected);
 if(!id||!blocks.some(block=>block.id===id))return next;
 if(next.has(id))next.delete(id);else next.add(id);
 return next;
}
export function retainBatchSelection(selected,blocks){
 const existing=new Set(blocks.map(block=>block.id));
 return new Set([...selected].filter(id=>existing.has(id)));
}
