import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BackIcon, FavoriteIcon, PathIcon, PracticeIcon, ProfileIcon } from './icons.js';
import { theme } from './theme.js';

const C = theme.colors;

function ChromeBlur({ style }) {
  return <BlurView pointerEvents="none" intensity={20} tint="light" experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill,style]} />;
}

export function Header({ title, subtitle, onBack, trailing }) {
  return (
    <View style={styles.header} pointerEvents="box-none">
      <ChromeBlur />
      <View style={styles.headerTint} pointerEvents="none" />
      <View style={styles.headerLeading} pointerEvents="box-none">{onBack ? <HeaderCircleButton icon={<BackIcon size={20} color={C.text2} />} onPress={onBack} accessibilityLabel="Назад" /> : null}</View>
      <View style={styles.headerCenter} pointerEvents="none"><Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>
      <View style={styles.headerTrailing} pointerEvents="box-none">{trailing || null}</View>
    </View>
  );
}

export function HeaderCircleButton({ label, icon, onPress, accessibilityLabel }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || String(label || '')} onPress={onPress} style={({ pressed }) => [styles.headerCircle, pressed && styles.controlPressed]}>
      <BlurView pointerEvents="none" intensity={12} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      {icon || <Text style={styles.headerCircleText}>{label}</Text>}
    </Pressable>
  );
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
  const items = [['practice','Практика',PracticeIcon],['path','Путь',PathIcon],['profile','Профиль',ProfileIcon]];
  return (
    <View style={styles.bottomNav}>
      <ChromeBlur />
      <View style={styles.navTint} pointerEvents="none" />
      {items.map(([id,label,Icon]) => {
        const active = tab === id;
        const color = active ? C.inverse : C.text2;
        return <Pressable key={id} onPress={() => onChange(id)} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.78 }]}><View style={[styles.navBubble, active && styles.navBubbleActive]}>{!active ? <BlurView pointerEvents="none" intensity={10} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} /> : null}<Icon size={id === 'path' ? 23 : 20} color={color} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>;
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
  header:{position:'absolute',zIndex:30,top:0,left:0,right:0,height:theme.control.header,paddingHorizontal:10,overflow:'hidden',backgroundColor:'transparent'},
  headerTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(238,233,223,.18)'},
  headerLeading:{position:'absolute',left:10,top:0,height:theme.control.header,justifyContent:'center',zIndex:2},
  headerTrailing:{position:'absolute',right:10,top:0,height:theme.control.header,justifyContent:'center',alignItems:'flex-end',zIndex:2},
  headerCenter:{position:'absolute',left:56,right:56,top:0,height:theme.control.header,alignItems:'center',justifyContent:'center'},
  headerTitle:{maxWidth:'100%',fontSize:17,fontWeight:'800',lineHeight:19,color:C.text1,textAlign:'center'},
  headerSubtitle:{maxWidth:'100%',marginTop:1,fontSize:10,fontWeight:'700',letterSpacing:.15,color:C.text2,textAlign:'center'},
  headerCircle:{width:36,height:36,borderWidth:1,borderColor:'rgba(54,50,43,.10)',borderRadius:18,backgroundColor:'rgba(246,242,233,.16)',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  headerCircleText:{fontSize:18,lineHeight:20,color:C.text2,fontWeight:'800'},controlPressed:{transform:[{scale:.96}],backgroundColor:C.controlGlassActive,borderColor:C.line},
  button:{minHeight:38,paddingVertical:7,paddingHorizontal:13,borderRadius:2,borderWidth:1,borderColor:C.line,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center'},
  buttonPrimary:{borderColor:C.accentStrong,backgroundColor:C.accent},buttonTextOnly:{borderColor:'transparent',backgroundColor:'transparent'},buttonCompact:{minHeight:30,paddingVertical:4,paddingHorizontal:10},buttonPressed:{transform:[{translateY:1}],opacity:.86},
  buttonLabel:{fontSize:14,fontWeight:'700',lineHeight:17,color:C.text1,textAlign:'center'},buttonPrimaryLabel:{color:C.inverse},buttonTextLabel:{color:C.text2},buttonCompactLabel:{fontSize:10,fontWeight:'700'},disabled:{opacity:.46},
  menuItem:{minHeight:54,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:11,marginBottom:10},menuItemPressed:{transform:[{translateY:1}],opacity:.86},
  menuIcon:{width:28,alignItems:'center',justifyContent:'center',marginRight:10},menuCopy:{flex:1,minWidth:0},menuTitle:{fontSize:15,fontWeight:'700',color:C.text1},menuSubtitle:{fontSize:12,color:C.text2,marginTop:2},chevron:{fontSize:24,color:C.text3,marginLeft:8},favoriteButton:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  bottomNav:{position:'absolute',zIndex:35,left:0,right:0,bottom:0,height:theme.control.nav,paddingHorizontal:12,paddingTop:2,flexDirection:'row',backgroundColor:'transparent',overflow:'hidden'},navTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(238,233,223,.16)'},
  navItem:{flex:1,alignItems:'center',justifyContent:'flex-start'},navBubble:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(54,50,43,.08)',backgroundColor:'rgba(246,242,233,.12)',alignItems:'center',justifyContent:'center',overflow:'hidden'},navBubbleActive:{backgroundColor:'rgba(41,39,34,.88)',borderColor:'rgba(41,39,34,.32)'},navLabel:{fontSize:10,fontWeight:'600',lineHeight:11,color:C.text3,marginTop:2},navLabelActive:{color:C.text1,fontWeight:'700'},
  sectionLabel:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginVertical:8},sectionBracket:{fontSize:11,fontWeight:'700',color:C.accentStrong},sectionLabelText:{fontSize:11,fontWeight:'600',letterSpacing:.35,color:C.text2},
  progressTrack:{height:2,borderRadius:999,backgroundColor:'rgba(41,39,34,.12)',overflow:'hidden'},progressFill:{height:2,backgroundColor:C.text1},
});
