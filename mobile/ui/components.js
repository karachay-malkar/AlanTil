import React from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BackIcon, FavoriteIcon, PracticeIcon, ProfileIcon } from './icons.js';
import { theme } from './theme.js';

const C = theme.colors;
const CH = theme.chrome;
const ELBRUS = require('../../assets/icons/ui/path-elbrus-white.png');

function ChromeBlurStrip({ top, height, intensity, backgroundColor }) {
  return (
    <View pointerEvents="none" style={[styles.chromeStrip,{ top, height, backgroundColor }]}> 
      <BlurView pointerEvents="none" intensity={intensity} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function TopChromeMask() {
  const h = theme.control.header + CH.contentRestGap;
  const q = h / 4;
  return (
    <View pointerEvents="none" style={[styles.topChromeMask,{height:h}]}> 
      <ChromeBlurStrip top={0} height={q+1} intensity={20} backgroundColor="rgba(238,233,223,.18)" />
      <ChromeBlurStrip top={q} height={q+1} intensity={14} backgroundColor="rgba(238,233,223,.12)" />
      <ChromeBlurStrip top={q*2} height={q+1} intensity={8} backgroundColor="rgba(238,233,223,.07)" />
      <ChromeBlurStrip top={q*3} height={q+1} intensity={3} backgroundColor="rgba(238,233,223,.025)" />
    </View>
  );
}

export function BottomChromeMask() {
  const h = theme.control.nav + CH.contentRestGap;
  const q = h / 4;
  return (
    <View pointerEvents="none" style={[styles.bottomChromeMask,{height:h,top:-CH.contentRestGap}]}> 
      <ChromeBlurStrip top={0} height={q+1} intensity={3} backgroundColor="rgba(238,233,223,.025)" />
      <ChromeBlurStrip top={q} height={q+1} intensity={8} backgroundColor="rgba(238,233,223,.07)" />
      <ChromeBlurStrip top={q*2} height={q+1} intensity={14} backgroundColor="rgba(238,233,223,.12)" />
      <ChromeBlurStrip top={q*3} height={q+1} intensity={20} backgroundColor="rgba(238,233,223,.18)" />
    </View>
  );
}

export function Header({ title, subtitle, onBack, trailing, action, sessionStatus }) {
  const { width } = useWindowDimensions();
  const compact = width <= CH.compactWidth;
  const side = compact ? CH.headerSideCompact : CH.headerSide;
  const resolvedTrailing = trailing || (action ? <HeaderTextAction {...action} /> : sessionStatus ? <SessionStatus {...sessionStatus} /> : null);
  return (
    <View style={[styles.header,{paddingHorizontal:side}]} pointerEvents="box-none">
      <TopChromeMask />
      <View style={[styles.headerLeading,{left:side}]} pointerEvents="box-none">{onBack ? <HeaderCircleButton icon={<BackIcon size={CH.actionIconSize} color={C.text2} />} onPress={onBack} accessibilityLabel="Назад" /> : null}</View>
      <View style={styles.headerCenter} pointerEvents="none"><Text numberOfLines={1} ellipsizeMode="tail" style={styles.headerTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>
      <View style={[styles.headerTrailing,{right:side}]} pointerEvents="box-none">{resolvedTrailing}</View>
    </View>
  );
}

export function HeaderCircleButton({ label, icon, onPress, accessibilityLabel }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || String(label || '')} onPress={onPress} style={({ pressed }) => [styles.headerCircle, pressed && styles.controlPressed]}>
      <BlurView pointerEvents="none" intensity={CH.controlBlur} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      {icon || <Text style={styles.headerCircleText}>{label}</Text>}
    </Pressable>
  );
}

export function HeaderTextAction({ label, onPress, accessibilityLabel }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} onPress={onPress} style={({pressed})=>[styles.headerTextAction,pressed&&styles.headerTextActionPressed]}>
      <BlurView pointerEvents="none" intensity={CH.controlBlur} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <Text numberOfLines={1} style={styles.headerTextActionLabel}>{label}</Text>
    </Pressable>
  );
}

export function SessionStatus({ counter, mode }) {
  return <View pointerEvents="none" style={styles.sessionStatus}>{counter ? <Text style={styles.sessionStatusText}>{counter}</Text> : null}{mode ? <Text style={styles.sessionStatusText}>{mode}</Text> : null}</View>;
}

export function Button({ children, onPress, primary = false, text = false, compact = false, disabled = false, style }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button,primary && styles.buttonPrimary,text && styles.buttonTextOnly,compact && styles.buttonCompact,disabled && styles.disabled,pressed && !disabled && styles.buttonPressed,style]}>
      <Text style={[styles.buttonLabel, primary && styles.buttonPrimaryLabel, text && styles.buttonTextLabel, compact && styles.buttonCompactLabel]}>{children}</Text>
    </Pressable>
  );
}

export function MenuItem({ title, subtitle, icon, onPress }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}><View style={styles.menuIcon}>{icon}</View><View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text>{subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

export function FavoriteButton({ active, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={active ? 'Убрать из избранного' : 'Добавить в избранное'} onPress={onPress} style={({ pressed }) => [styles.favoriteButton, pressed && { opacity: 0.65 }]}><FavoriteIcon size={23} color={active ? C.favorite : C.text3} filled={active} /></Pressable>;
}

export function BottomNav({ tab, onChange }) {
  const { width } = useWindowDimensions();
  const compact = width <= CH.compactWidth;
  const side = compact ? CH.navSideCompact : CH.navSide;
  const bubbleSize = compact ? CH.navBubbleCompactSize : CH.navBubbleSize;
  const items = [['practice','Практика',PracticeIcon],['path','Путь',null],['profile','Профиль',ProfileIcon]];
  return (
    <View style={[styles.bottomNav,{paddingHorizontal:side}]}> 
      <BottomChromeMask />
      {items.map(([id,label,Icon]) => {
        const active = tab === id;
        const color = active ? C.inverse : C.text2;
        const path = id === 'path';
        return <Pressable key={id} onPress={() => onChange(id)} style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}><View style={[styles.navBubble,{width:bubbleSize,height:bubbleSize,borderRadius:bubbleSize/2},path&&styles.navPathBubble,active&&styles.navBubbleActive]}>{!active ? <BlurView pointerEvents="none" intensity={CH.controlBlur} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} /> : null}{path ? <Image source={ELBRUS} resizeMode="contain" style={[styles.navElbrus,!active&&styles.navElbrusInactive]} /> : <Icon size={20} color={color} />}</View><Text style={[styles.navLabel,compact&&styles.navLabelCompact,active&&styles.navLabelActive]}>{label}</Text></Pressable>;
      })}
    </View>
  );
}

export function Screen({ children, bottomNav = false }) { return <View style={[styles.screen, bottomNav && { paddingBottom: theme.control.nav }]}>{children}</View>; }
export function Content({ children, style }) { return <View style={[styles.content, style]}>{children}</View>; }
export function SectionLabel({ children }) { return <View style={styles.sectionLabel}><Text style={styles.sectionBracket}>[</Text><Text style={styles.sectionLabelText}>{children}</Text><Text style={styles.sectionBracket}>]</Text></View>; }
export function ProgressBar({ value = 0 }) { const width = `${Math.max(0, Math.min(100, value))}%`; return <View style={styles.progressTrack}><View style={[styles.progressFill,{width}]} /></View>; }

export const uiStyles = StyleSheet.create({
  scrollContent:{paddingTop:theme.control.header+16,paddingHorizontal:12,paddingBottom:24},
  scrollContentWithNav:{paddingTop:theme.control.header+16,paddingHorizontal:12,paddingBottom:theme.control.nav+28},
  panel:{borderWidth:1,borderColor:C.line,borderRadius:theme.radius.lg,backgroundColor:'transparent',overflow:'hidden'},
  panelBody:{padding:12},row:{flexDirection:'row',alignItems:'center'},
});

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.appBg},content:{flex:1},
  chromeStrip:{position:'absolute',left:0,right:0,overflow:'hidden'},
  topChromeMask:{position:'absolute',zIndex:0,top:0,left:0,right:0,overflow:'hidden'},
  bottomChromeMask:{position:'absolute',zIndex:0,left:0,right:0,overflow:'hidden'},
  header:{position:'absolute',zIndex:30,top:0,left:0,right:0,height:theme.control.header+CH.contentRestGap,overflow:'visible',backgroundColor:'transparent'},
  headerLeading:{position:'absolute',top:0,height:theme.control.header,justifyContent:'center',zIndex:2},
  headerTrailing:{position:'absolute',top:0,height:theme.control.header,justifyContent:'center',alignItems:'flex-end',zIndex:2},
  headerCenter:{position:'absolute',left:CH.headerCenterInset,right:CH.headerCenterInset,top:0,height:theme.control.header,alignItems:'center',justifyContent:'center'},
  headerTitle:{maxWidth:'100%',fontSize:17,fontWeight:'800',lineHeight:18.4,color:C.text1,textAlign:'center'},
  headerSubtitle:{maxWidth:'100%',marginTop:2,fontFamily:'monospace',fontSize:10,fontWeight:'700',lineHeight:11,color:C.text2,textAlign:'center'},
  headerCircle:{width:CH.actionSize,height:CH.actionSize,borderWidth:1,borderColor:C.controlBorder,borderRadius:CH.actionSize/2,backgroundColor:C.controlGlass,alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:'#292721',shadowOpacity:.025,shadowRadius:9,shadowOffset:{width:0,height:2},elevation:1},
  headerCircleText:{fontSize:18,lineHeight:20,color:C.text2,fontWeight:'800'},
  controlPressed:{transform:[{scale:.96}],backgroundColor:C.controlGlassActive,borderColor:C.line},
  headerTextAction:{minHeight:34,maxWidth:132,paddingHorizontal:10,borderWidth:1,borderColor:C.controlBorder,borderRadius:999,backgroundColor:C.controlGlass,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  headerTextActionPressed:{transform:[{scale:.97}],backgroundColor:C.controlGlassActive,borderColor:C.line},
  headerTextActionLabel:{fontFamily:'monospace',fontSize:11,fontWeight:'700',lineHeight:12,color:C.text2},
  sessionStatus:{minWidth:0,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:5},
  sessionStatusText:{fontFamily:'monospace',fontSize:10,fontWeight:'700',lineHeight:12,color:C.text2},
  button:{minHeight:38,paddingVertical:7,paddingHorizontal:13,borderRadius:2,borderWidth:1,borderColor:C.line,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center'},
  buttonPrimary:{borderColor:C.accentStrong,backgroundColor:C.accent},buttonTextOnly:{borderColor:'transparent',backgroundColor:'transparent'},buttonCompact:{minHeight:30,paddingVertical:4,paddingHorizontal:10},buttonPressed:{transform:[{translateY:1}],opacity:.86},
  buttonLabel:{fontSize:14,fontWeight:'700',lineHeight:17,color:C.text1,textAlign:'center'},buttonPrimaryLabel:{color:C.inverse},buttonTextLabel:{color:C.text2},buttonCompactLabel:{fontSize:10,fontWeight:'700'},disabled:{opacity:.46},
  menuItem:{minHeight:54,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:11,marginBottom:10},menuItemPressed:{transform:[{translateY:1}],opacity:.86},
  menuIcon:{width:28,alignItems:'center',justifyContent:'center',marginRight:10},menuCopy:{flex:1,minWidth:0},menuTitle:{fontSize:15,fontWeight:'700',color:C.text1},menuSubtitle:{fontSize:12,color:C.text2,marginTop:2},chevron:{fontSize:24,color:C.text3,marginLeft:8},favoriteButton:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  bottomNav:{position:'absolute',zIndex:35,left:0,right:0,bottom:0,height:theme.control.nav,paddingTop:2,flexDirection:'row',backgroundColor:'transparent',overflow:'visible'},
  navItem:{flex:1,height:theme.control.nav,paddingHorizontal:3,paddingTop:1,paddingBottom:2,alignItems:'center',justifyContent:'flex-start',gap:2},navItemPressed:{opacity:.78,transform:[{scale:.97}]},
  navBubble:{borderWidth:1,borderColor:'rgba(54,50,43,.0748)',backgroundColor:'rgba(246,242,233,.22)',alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:'#292721',shadowOpacity:.018,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:1},
  navPathBubble:{backgroundColor:C.pathBubbleGlass,borderColor:C.pathBubbleBorder},navBubbleActive:{backgroundColor:C.activeBubbleGlass,borderColor:C.activeBubbleBorder},
  navElbrus:{width:29,height:17,opacity:1},navElbrusInactive:{opacity:.82},
  navLabel:{fontSize:10,fontWeight:'600',lineHeight:10.5,color:C.text3},navLabelCompact:{fontSize:9},navLabelActive:{color:C.text1,fontWeight:'700'},
  sectionLabel:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginVertical:8},sectionBracket:{fontSize:11,fontWeight:'700',color:C.accentStrong},sectionLabelText:{fontSize:11,fontWeight:'600',letterSpacing:.35,color:C.text2},
  progressTrack:{height:2,borderRadius:999,backgroundColor:'rgba(41,39,34,.12)',overflow:'hidden'},progressFill:{height:2,backgroundColor:C.text1},
});
