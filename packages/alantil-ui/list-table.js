const F=Object.freeze;
const standard=F({small:48,medium:56,large:64,huge:72});
const typeBySize=F({
  small:F({primary:16,secondary:12,service:10}),
  medium:F({primary:20,secondary:14,service:10}),
  large:F({primary:24,secondary:16,service:12}),
  huge:F({primary:28,secondary:18,service:14}),
});
export const LIST_TABLE_CONTRACT=F({
  standard,
  result:80,
  table:F({rows:standard,header:38}),
  profileProgress:60,
  horizontalPadding:12,
  gap:8,
  leadingSlot:36,
  actionSlot:36,
  separator:'lineSoft',
  background:'transparent',
  radius:0,
  shadow:'none',
  typography:F({
    bySize:typeBySize,
    primary:F({fontSize:typeBySize.medium.primary,fontWeight:'800',family:'body'}),
    secondary:F({fontSize:typeBySize.medium.secondary,color:'text2',family:'body'}),
    service:F({fontSize:typeBySize.medium.service,fontWeight:'800',family:'terminal'}),
  }),
});
export function listSizeCode(textSizeCode='medium'){return ['small','medium','large','huge'].includes(textSizeCode)?textSizeCode:'medium';}
export function listRowHeight(textSizeCode='medium',variant='standard'){
  if(variant==='result')return LIST_TABLE_CONTRACT.result;
  if(variant==='profileProgress')return LIST_TABLE_CONTRACT.profileProgress;
  return LIST_TABLE_CONTRACT.standard[listSizeCode(textSizeCode)];
}
export function listTypography(textSizeCode='medium'){return LIST_TABLE_CONTRACT.typography.bySize[listSizeCode(textSizeCode)];}
