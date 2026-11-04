/** AlanTil Tekmet currency. The backend is authoritative; these are UI quotes only. */
export const TEKMET_REWARD=Object.freeze({beginner:1,intermediate:4,thematic:2});
export const TEKMET_PRICE=Object.freeze({
 '1x1x1':1,'2x2x2':2,'2x2x3':3,'2x3x4':5,'4x4x4':8,'3x3x3':4,
 'window-4x5x2':10,'door-7x9x2':15,'gate-18x10x2':40
});
export function tekmetSectionCost(sectionId){
 if(typeof sectionId!=='string')return null;
 if(Object.hasOwn(TEKMET_PRICE,sectionId))return TEKMET_PRICE[sectionId];
 if(sectionId==='bagana-2x10x2'||/^bagana-f[123]-3x(?:9|10|11|12|13)x3$/.test(sectionId))return 10;
 const beam=/^roof-beam-([1-9]|[1-3][0-9]|40)$/.exec(sectionId);
 return beam?Math.ceil(Number(beam[1])/2):null; // 2 per metre; lengths are 25cm cells.
}
export const tekmetRoofCost=cells=>Number.isInteger(cells)&&cells>=0?cells:null;
let coinSerial=0;
export function tekmetIcon(className=''){
 const gradientId='tekmet-gold-'+(++coinSerial);
 const cls=String(className).replace(/[^a-zA-Z0-9_ -]/g,'');
 // A stamped tekmet: outer circle, concave square and central dot.
 return `<svg viewBox="0 0 48 48" class="${cls}" role="img" aria-label="Текмет" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${gradientId}" x1=".13" y1=".08" x2=".87" y2=".93">
    <stop offset="0" stop-color="#fff0a1"/><stop offset=".37" stop-color="#edbe51"/><stop offset=".72" stop-color="#c48926"/><stop offset="1" stop-color="#ffdf78"/>
  </linearGradient></defs>
  <circle cx="24" cy="24" r="22" fill="url(#${gradientId})" stroke="#98601d" stroke-width="1.5"/>
  <circle cx="24" cy="24" r="19" fill="none" stroke="#fff0a8" stroke-opacity=".85" stroke-width="1.3"/>
  <circle cx="24" cy="24" r="16.7" fill="none" stroke="#98601d" stroke-width="1.6"/>
  <path d="M13.7 13.7Q24 19.2 34.3 13.7Q28.8 24 34.3 34.3Q24 28.8 13.7 34.3Q19.2 24 13.7 13.7Z"
    fill="none" stroke="#86521a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24" cy="24" r="3" fill="#86521a"/>
  <path d="M10 12A19 19 0 0 1 31 6" fill="none" stroke="#fff7c6" stroke-opacity=".85" stroke-width="1.7" stroke-linecap="round"/>
 </svg>`;
}
