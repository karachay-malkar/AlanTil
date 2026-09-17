import fs from 'node:fs';
const file='mobile/ui/parity.js';
let source=fs.readFileSync(file,'utf8');
function replace(before,after,label){if(source.includes(after))return;if(!source.includes(before))throw new Error(`Mobile parity source drift: ${label}`);source=source.replace(before,after);}
replace("segmented: { width: '100%', minHeight: 34, padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999, flexDirection: 'row', backgroundColor: 'transparent' },","segmented: { width: '100%', minHeight: theme.segmented.itemMinHeight + theme.segmented.padding * 2, padding: theme.segmented.padding, borderWidth: 1, borderColor: C.line, borderRadius: theme.segmented.radius, flexDirection: 'row', backgroundColor: 'transparent' },",'segmented container');
replace("segmentItem: { flex: 1, minHeight: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 4 },","segmentItem: { flex: 1, minHeight: theme.segmented.itemMinHeight, borderRadius: theme.segmented.radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 4 },",'segmented item');
replace("listRowCompact: { minHeight: 48, paddingVertical: 5 },","listRowCompact: { minHeight: theme.list.rowMinHeight, paddingVertical: 5 },",'compact list row');
fs.writeFileSync(file,source);
console.log('16.7 mobile parity primitives synchronized');
