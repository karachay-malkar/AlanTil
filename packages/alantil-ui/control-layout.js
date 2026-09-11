// Effective Web 13.15.12 control geometry. Both renderers consume this contract.
import { UI_TOKENS } from './tokens.js';
export const CONTROL_LAYOUT=Object.freeze({
  progress:Object.freeze({segments:10,segmentWidth:8,segmentHeight:2,segmentGap:4,bracketGap:5,track:'rgba(41,39,34,.20)',fill:UI_TOKENS.colors.text1}),
  station:Object.freeze({side:12,footerGap:6,toolbarSide:18,toolbarHeight:28,tabPaddingMin:44,tabPaddingMax:76,tabPaddingRatio:.14}),
  learnUndo:Object.freeze({direction:'row',gap:4}),
  profileGender:Object.freeze({gap:9,height:180,compactHeight:150,compactWidth:360}),
  guide:Object.freeze({width:104,height:36,paddingHorizontal:12,compactWidth:390,compactMinWidth:98,compactHeight:35,compactHorizontal:10,fontSize:11,fontWeight:'800'}),
});
export const stationTabPadding=width=>Math.min(CONTROL_LAYOUT.station.tabPaddingMax,Math.max(CONTROL_LAYOUT.station.tabPaddingMin,width*CONTROL_LAYOUT.station.tabPaddingRatio));
export const profileGenderHeight=width=>width<=CONTROL_LAYOUT.profileGender.compactWidth?CONTROL_LAYOUT.profileGender.compactHeight:CONTROL_LAYOUT.profileGender.height;
