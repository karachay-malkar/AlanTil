import fs from 'node:fs';
const file='mobile/ui/parity.js';
const source=fs.readFileSync(file,'utf8');
const required=[
  ['shared segmented container','theme.segmented.itemMinHeight + theme.segmented.padding * 2'],
  ['shared segmented radius','borderRadius: theme.segmented.radius'],
  ['runtime list sizing','listRowHeight(sizeCode,variant)'],
  ['runtime list typography','listTypography(sizeCode)'],
  ['shared list padding','theme.listTable.horizontalPadding'],
  ['shared list gap','theme.listTable.gap'],
];
for(const [label,needle] of required)if(!source.includes(needle))throw new Error(`Mobile parity source drift: ${label}`);
console.log('16.7 mobile parity primitives verified');
