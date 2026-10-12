/** Keep the router's tower pathname and unrelated parameters while switching
 * between two independent builds that intentionally share only the wallet.
 */
export function towerModeUrl(href,mode){
 if(mode!=='classic'&&mode!=='free')throw new RangeError('Invalid tower mode');
 const url=new URL(href);
 url.searchParams.delete('tower_v2_play');
 url.searchParams.delete('tower_v2_preview');
 if(mode==='free')url.searchParams.set('tower_v2_play','1');
 return url.pathname+url.search+url.hash;
}
