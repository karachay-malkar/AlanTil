import { UI_TOKENS } from './tokens.js';
const F=Object.freeze,B=UI_TOKENS.button,C=UI_TOKENS.colors;
export const CONTROL_SHAPES=F({cut2:F({kind:'cut2',cut:B.cut,radius:B.radius}),actionCut2:F({kind:'cut2',cut:B.cut,radius:B.actionRadius}),plain:F({kind:'plain'}),pill:F({kind:'pill',radius:999}),circle:F({kind:'circle',radius:999})});
const styles=F({
 default:F({minHeight:B.height,paddingVertical:B.vertical,paddingHorizontal:B.horizontal,radius:B.radius,fontSize:B.fontSize,fontWeight:B.fontWeight,lineHeight:B.lineHeight,fill:'surface0',stroke:'lineStrong',label:'text1',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 primary:F({minHeight:B.height,paddingVertical:B.vertical,paddingHorizontal:B.horizontal,radius:B.radius,fontSize:B.fontSize,fontWeight:B.fontWeight,lineHeight:B.lineHeight,fill:'accent',stroke:'accentStrong',label:'inverse',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 text:F({minHeight:B.height,paddingVertical:0,paddingHorizontal:4,radius:0,fontSize:B.fontSize,fontWeight:B.fontWeight,lineHeight:B.lineHeight,fill:'transparent',stroke:'transparent',label:'text2',disabledOpacity:B.disabledOpacity,pressedOpacity:.68,pressedScale:1}),
 compactPrimary:F({minHeight:B.compactHeight,paddingVertical:B.compactVertical,paddingHorizontal:B.compactHorizontal,radius:B.radius,fontSize:B.compactFontSize,fontWeight:B.compactFontWeight,lineHeight:B.compactLineHeight,fontFamily:'terminal',fill:'accent',stroke:'accentStrong',label:'inverse',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 stationStudy:F({minHeight:B.stationHeight,paddingVertical:B.stationVertical,paddingHorizontal:B.stationHorizontal,radius:B.actionRadius,fontSize:B.stationFontSize,fontWeight:B.stationFontWeight,lineHeight:B.stationLineHeight,fill:'stationGlass',stroke:'lineStrong',label:'text1',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 stationTest:F({minHeight:B.stationHeight,paddingVertical:B.stationVertical,paddingHorizontal:B.stationHorizontal,radius:B.actionRadius,fontSize:B.stationFontSize,fontWeight:B.stationFontWeight,lineHeight:B.stationLineHeight,fill:'accent',stroke:'accentStrong',label:'inverse',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 settingsSmall:F({minHeight:B.settingsSmallHeight,paddingVertical:B.settingsSmallVertical,paddingHorizontal:B.settingsSmallHorizontal,radius:B.settingsSmallRadius,fontSize:B.settingsSmallFontSize,fontWeight:B.settingsSmallFontWeight,lineHeight:B.settingsSmallLineHeight,fontFamily:'terminal',fill:'transparent',stroke:'line',label:'text3',disabledOpacity:B.settingsSmallDisabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 headerText:F({minHeight:B.headerTextHeight,paddingVertical:0,paddingHorizontal:B.headerTextHorizontal,radius:999,fontSize:B.headerTextFontSize,fontWeight:B.headerTextFontWeight,lineHeight:B.headerTextLineHeight,fontFamily:'terminal',fill:'controlGlass',stroke:'controlBorder',label:'text2',pressedOpacity:1,pressedScale:.97}),
 provider:F({minHeight:B.providerHeight,paddingVertical:B.vertical,paddingHorizontal:B.horizontal,radius:B.radius,fontSize:B.fontSize,fontWeight:B.fontWeight,lineHeight:B.lineHeight,fill:'accent',stroke:'accentStrong',label:'inverse',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:B.pressedScale}),
 textAction:F({minHeight:UI_TOKENS.control.text,paddingVertical:0,paddingHorizontal:0,radius:0,fontSize:B.textActionFontSize,fontWeight:B.textActionFontWeight,lineHeight:B.textActionLineHeight,fill:'transparent',stroke:'transparent',label:'text2',disabledOpacity:B.disabledOpacity,pressedOpacity:B.textActionPressedOpacity,pressedTranslateY:1}),
 option:F({minHeight:UI_TOKENS.control.normal,paddingVertical:B.optionVertical,paddingHorizontal:B.optionHorizontal,radius:2,fontSize:B.optionFontSize,fontWeight:B.optionFontWeight,lineHeight:B.optionLineHeight,fill:'surface0',stroke:'lineStrong',label:'text1',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:1}),
 match:F({minHeight:UI_TOKENS.control.normal,paddingVertical:B.matchPadding,paddingHorizontal:B.matchPadding,radius:2,fontSize:B.matchFontSize,fontWeight:B.matchFontWeight,lineHeight:B.matchLineHeight,fill:'surface0',stroke:'lineStrong',label:'text1',disabledOpacity:B.disabledOpacity,pressedOpacity:B.pressedOpacity,pressedScale:1}),
 favorite:F({width:UI_TOKENS.favorite.size,minHeight:UI_TOKENS.favorite.size,iconSize:UI_TOKENS.favorite.iconSize,radius:0,fill:'transparent',stroke:'transparent',label:'favorite'})
});
const def=(mobileKind,style,webClasses,extra={})=>F({mobileKind,style,webClasses:F(webClasses),shape:extra.shape||((webClasses.includes('actionText')||webClasses.includes('textAction')||webClasses.includes('appHeaderTextAction')||webClasses.includes('starBtn'))?'plain':'cut2'),...extra});
export const BUTTON_ROLES=F({
 'generic.default':def('default','default',['btn']),
 'generic.primary':def('primary','primary',['btn','actionPrimary']),
 'generic.text':def('text','text',['btn','actionText']),
 'generic.compactPrimary':def('compactPrimary','compactPrimary',['btn','actionPrimary','actionCompact']),
 'text.action':def('text','textAction',['textAction']),
 'header.text':def('headerText','headerText',['appHeaderTextAction'],{shape:'pill'}),
 'header.icon':def('icon','default',['appHeaderAction']),
 'auth.provider':def('primary','provider',['btn','actionPrimary','authProviderButton']),
 'auth.continueGoogle':def('primary','provider',['btn','actionPrimary','authProviderButton']),
 'auth.continueGuest':def('text','text',['btn','actionText']),
 'onboarding.continue':def('primary','primary',['btn','actionPrimary']),
 'favorites.start':def('primary','primary',['btn','actionPrimary']),
 'learn.start':def('primary','primary',['btn','actionPrimary']),
 'learn.results':def('primary','primary',['btn','actionPrimary']),
 'station.study':def('stationStudy','stationStudy',['btn','stationStudyButton'],{action:true,shape:'actionCut2'}),
 'station.test':def('stationTest','stationTest',['btn','actionPrimary','stationTestButton'],{action:true,shape:'actionCut2'}),
 'test.answer':def('option','option',['optionBtn']),
 'test.submit':def('primary','primary',['btn','actionPrimary']),
 'test.retry':def('primary','primary',['btn','actionPrimary']),
 'test.start':def('primary','primary',['btn','actionPrimary']),
 'test.back':def('text','text',['btn','actionText']),
 'match.card':def('match','match',['matchCard']),
 'match.start':def('primary','primary',['btn','actionPrimary']),
 'match.retry':def('primary','primary',['btn','actionPrimary']),
 'practice.test':def('default','default',['btn']),
 'practice.match':def('default','default',['btn']),
 'profile.create':def('primary','primary',['btn','actionPrimary']),
 'profile.guestAccount':def('primary','primary',['btn','actionPrimary']),
 'profile.nicknameSave':def('primary','primary',['btn','actionPrimary']),
 'profile.signOut':def('text','text',['btn','actionText']),
 'privacy.save':def('primary','primary',['btn','actionPrimary']),
 'settings.save':def('settingsSmall','settingsSmall',['btn','actionPrimary','actionCompact','settingsSmallAction']),
 'settings.dictionaryUpdate':def('settingsSmall','settingsSmall',['btn','actionPrimary','actionCompact','settingsSmallAction']),
 'songs.info':def('headerText','headerText',['iconAction','appHeaderTextAction','songInfoButton'],{shape:'pill'}),
 'songs.play':def('icon','default',['mediaPlayButton']),
 'favorite.toggle':def('favorite','favorite',['starBtn'],{shape:'plain'}),
 'modal.confirm':def('primary','primary',['btn','actionPrimary']),
 'modal.cancel':def('text','text',['btn','actionText']),
 'path.resultBack':def('primary','primary',['btn','actionPrimary']),
 'path.storyTab':def('tab','text',['storyTab']),
 'direction.choice':def('segment','default',['directionChoiceButton'],{shape:'cut2'}),
 'set.start':def('primary','primary',['btn','actionPrimary'])
});
export function buttonRole(role){const key=String(role||'generic.default');return BUTTON_ROLES[key]||BUTTON_ROLES['generic.default'];}
export function buttonVisualStyle(role){return styles[buttonRole(role).style]||styles.default;}
export function listButtonRoles(){return Object.keys(BUTTON_ROLES);}
export const BUTTON_VISUAL_STYLES=styles;
