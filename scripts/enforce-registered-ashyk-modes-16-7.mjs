import fs from 'node:fs';

const files=[
  'mobile/screens/ashyk.js',
  'packages/ashyk-game/web/Game.jsx',
];
const flags=fs.readFileSync('packages/alantil-core/ashyk-access.js','utf8');
if(!/allowGuests:true/.test(flags))throw new Error('Ashyk computer mode must be available to guests');
if(!/allowComputer:true/.test(flags))throw new Error('Ashyk computer mode must stay enabled');
if(!/allowOnlineFriend:true/.test(flags))throw new Error('Ashyk online friend mode must stay enabled');
if(!/allowLocalSameDevice:false/.test(flags))throw new Error('Ashyk same-device mode must stay disabled');

for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  if(!/ashykVisibleModesForUser/.test(source)||!/ashykModeAccess/.test(source))throw new Error(`Shared Ashyk mode access contract is missing in ${file}`);
  if(/const modes=\[\["computer"[\s\S]{0,160}\["local"/.test(source))throw new Error(`Hard-coded same-device Ashyk mode remains in ${file}`);
}
if(!/requiresAuth/.test(flags))throw new Error('Ashyk online friend mode must expose its auth requirement');
console.log('Ashyk access flags verified');
