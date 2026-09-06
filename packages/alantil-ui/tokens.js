export const VISUAL_CONTRACT_VERSION='16.6.6';
export const WEB_VISUAL_REFERENCE='13.15.12';
const F=Object.freeze;
const colors=F({appBg:'#eee9df',appBgDeep:'#e7e0d4',surface0:'#f6f2e9',surface1:'#eee8dc',surface2:'#e2d9c9',surface3:'#cec0aa',surfaceDark:'#34312c',text1:'#292722',text2:'#666158',text3:'#918b80',inverse:'#faf8f2',lineSoft:'rgba(54,50,43,0.12)',line:'rgba(54,50,43,0.22)',lineStrong:'rgba(54,50,43,0.46)',accent:'#8b6b3b',accentStrong:'#65491f',accentSoft:'rgba(139,107,59,0.11)',accentGlow:'rgba(139,107,59,0.20)',success:'#5d7654',successStrong:'#425a3b',successSoft:'rgba(93,118,84,0.12)',successBorder:'rgba(93,118,84,0.32)',danger:'#98564c',dangerStrong:'#733e36',dangerSoft:'rgba(152,86,76,0.12)',dangerBorder:'rgba(152,86,76,0.35)',warning:'#a47736',info:'#58777a',locked:'#aaa49a',favorite:'#9b7027',paper:'rgba(255,255,255,0.22)',paperSoft:'rgba(255,255,255,0.13)',component:'rgba(255,255,255,0.28)',panelStrong:'rgba(255,255,255,0.20)',panelMid:'rgba(255,255,255,0.14)',panelSoft:'rgba(255,255,255,0.10)',panelFaint:'rgba(255,255,255,0.08)',white55:'rgba(255,255,255,0.55)',white40:'rgba(255,255,255,0.40)',white34:'rgba(255,255,255,0.34)',white30:'rgba(255,255,255,0.30)',white23:'rgba(255,255,255,0.23)',white20:'rgba(255,255,255,0.20)',overlay:'rgba(31,30,26,0.52)',modalShadow:'rgba(31,30,26,0.20)',controlGlass:'rgba(246,242,233,0.28)',controlGlassActive:'rgba(246,242,233,0.46)',controlBorder:'rgba(54,50,43,0.0968)',maskGlass:'rgba(238,233,223,0.18)',pathBubbleGlass:'rgba(41,39,34,0.34)',pathBubbleBorder:'rgba(41,39,34,0.18)',activeBubbleGlass:'rgba(41,39,34,0.88)',activeBubbleBorder:'rgba(41,39,34,0.32)'});
const typeScale=F({small:F({micro:10,caption:10,body:12,emphasis:14,title:16,display:40,result:54}),medium:F({micro:10,caption:12,body:14,emphasis:16,title:20,display:48,result:64}),large:F({micro:12,caption:14,body:16,emphasis:20,title:20,display:56,result:72})});
const button=F({height:38,vertical:7,horizontal:13,radius:14,actionRadius:15,cut:7,fontSize:14,fontWeight:'760',lineHeight:17,disabledOpacity:.46,pressedOpacity:.76,pressedScale:.98,compactHeight:30,compactVertical:4,compactHorizontal:10,compactFontSize:10,compactFontWeight:'750',compactLineHeight:10,providerHeight:44,textActionFontSize:12,textActionFontWeight:'650',textActionLineHeight:12,textActionPressedOpacity:.68,headerTextHeight:34,headerTextHorizontal:10,headerTextFontSize:11,headerTextFontWeight:'750',headerTextLineHeight:11,settingsSmallHeight:29,settingsSmallVertical:4,settingsSmallHorizontal:10,settingsSmallRadius:2,settingsSmallFontSize:10,settingsSmallFontWeight:'750',settingsSmallLineHeight:10,settingsSmallDisabledOpacity:.48,stationHeight:36,stationVertical:5,stationHorizontal:7,stationFontSize:10,stationFontWeight:'760',stationLineHeight:12,optionVertical:9,optionHorizontal:12,optionFontSize:14,optionFontWeight:'760',optionLineHeight:18,matchPadding:8,matchFontSize:13,matchFontWeight:'760',matchLineHeight:16});
export const UI_TOKENS=F({
  colors,
  surfaces:F({app:'appBg',panel:'panelMid',panelStrong:'panelStrong',paper:'paper',paperSoft:'paperSoft',control:'controlGlass',controlActive:'controlGlassActive',input:'surface0',overlay:'overlay'}),
  borders:F({soft:'lineSoft',normal:'line',strong:'lineStrong',control:'controlBorder',success:'successBorder',error:'dangerBorder'}),
  typeScale,
  font:F({body:undefined,display:undefined,brand:'serif',terminal:'monospace'}),
  radius:F({none:2,xs:7,sm:10,md:15,lg:20,pill:999}),
  spacing:F({s1:4,s2:8,s3:12,s4:16,s5:20,s6:24,s7:32,s8:40}),
  control:Object.freeze({sm:36,normal:44,compact:36,text:28,large:44,header:42,nav:60,input:44,row:48}),
  path:F({rootControlsHeight:56,mapTop:64,stationSize:60,stationGap:58,stationMetaReserve:52,sectionGap:92,dictionaryGap:118,catalogGap:118,headingGap:22,routeGroupsBottom:64,waveAmplitudeMin:64,waveAmplitudeWidthRatio:.22,waveAmplitudeMax:90,scaleDot:4,scaleSection:6,scaleDiamond:9,scaleHeightPercent:60,scaleRight:4,scaleWidth:26}),
  safeArea:F({edges:['top','left','right','bottom'],shellEdges:['top','left','right'],bottomManagedByChrome:true,topContentGap:16,bottomContentGap:18}),
  breakpoints:F({compact:360,accountNarrow:420}),
  motion:F({fast:110,normal:145,modal:145,reduced:0}),
  layout:F({contentMax:720,accountMax:520,viewPadding:12,viewPaddingCompact:8,panelBodyHorizontal:16,panelBodyHorizontalCompact:12,panelBodyTop:8,panelBodyBottom:18,accountGap:16}),
  shadow:F({xs:F({opacity:.05,radius:2,y:1}),sm:F({opacity:.07,radius:14,y:5}),md:F({opacity:.12,radius:30,y:12}),modal:F({opacity:.20,radius:28,y:12})}),
  states:F({disabledOpacity:.46,pressedOpacity:.86,loadingOpacity:.72,focusBorder:'lineStrong',successBorder:'successBorder',errorBorder:'dangerBorder'}),
  button,
  input:F({height:44,horizontal:12,radius:2,borderWidth:1}),
  panel:F({radius:20,borderWidth:1,headerMinHeight:42}),
  modal:F({maxWidth:500,padding:18,radius:20,overlay:'overlay'}),
  segmented:F({padding:2,itemMinHeight:28,itemMinWidth:38,radius:999,settingsActiveAlpha:.72,setActiveAlpha:.82,testActiveAlpha:.86,songsActiveAlpha:.84}),
  progress:F({height:4,radius:999}),
  list:F({rowMinHeight:48,menuMinHeight:54,horizontal:14,separator:'lineSoft'}),
  favorite:F({size:36,iconSize:23,active:'favorite',inactive:'text3'}),
  account:F({maxWidth:520,gap:16,fieldGap:8,messageMinHeight:18,genderCardMinHeight:210,genderCardGap:12,factRowMinHeight:48})
});
