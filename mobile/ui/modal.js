import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, GlassBackdrop } from './components.js';
import { CloseIcon } from './icons.js';
import { theme } from './theme.js';

const C=theme.colors;
const MODAL_OVERLAY='rgba(31,30,26,.44)';
const MODAL_SURFACE='rgba(246,242,233,.92)';
const MODAL_BORDER='rgba(54,50,43,.136)';

function ModalShell({visible,onClose,children,accessibilityLabel}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.root}>
      <GlassBackdrop blur={8} backgroundColor={MODAL_OVERLAY}/>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel||''} onPress={onClose} style={StyleSheet.absoluteFill}/>
      {children}
    </View>
  </Modal>;
}

function ModalCard({children,style,accessibilityRole}){return <View accessibilityRole={accessibilityRole} style={[styles.card,style]}><GlassBackdrop blur={20} saturate={1.05} backgroundColor={MODAL_SURFACE}/>{children}</View>}

export function ConfirmDialog({visible,title,message,confirmLabel,cancelLabel,onConfirm,onCancel}) {
  return <ModalShell visible={visible} onClose={onCancel} accessibilityLabel={cancelLabel}>
    <ModalCard accessibilityRole="alert">
      {title?<Text style={styles.title}>{title}</Text>:null}
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Button role="modal.cancel" style={styles.action} onPress={onCancel}>{cancelLabel}</Button>
        <Button role="modal.confirm" style={styles.action} onPress={onConfirm}>{confirmLabel}</Button>
      </View>
    </ModalCard>
  </ModalShell>;
}

export function InfoDialog({visible,title='',closeLabel='Close',onClose,children}) {
  return <ModalShell visible={visible} onClose={onClose} accessibilityLabel={closeLabel}>
    <ModalCard accessibilityRole="summary" style={styles.infoCard}>
      <View style={styles.infoHeader}>
        {title?<Text numberOfLines={2} style={styles.infoTitle}>{title}</Text>:<View style={styles.infoTitle}/>} 
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={({pressed})=>[styles.close,pressed&&styles.closePressed]}><GlassBackdrop blur={8} backgroundColor={C.controlGlass}/><CloseIcon size={18} color={C.text2}/></Pressable>
      </View>
      <ScrollView style={styles.infoBody} contentContainerStyle={styles.infoBodyContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>
      <View style={styles.infoActions}><Button role="modal.confirm" style={styles.infoAction} onPress={onClose}>{closeLabel}</Button></View>
    </ModalCard>
  </ModalShell>;
}

const styles=StyleSheet.create({
  root:{flex:1,alignItems:'center',justifyContent:'center',padding:18,backgroundColor:'transparent'},
  card:{width:'100%',maxWidth:theme.modal.maxWidth,maxHeight:'88%',padding:theme.modal.padding,borderWidth:1,borderColor:MODAL_BORDER,borderRadius:22,backgroundColor:'transparent',shadowColor:C.text1,shadowOpacity:.18,shadowRadius:64,shadowOffset:{width:0,height:22},elevation:12,overflow:'hidden'},
  title:{fontSize:18,fontWeight:'800',lineHeight:23,color:C.text1,textAlign:'center'},
  message:{fontSize:17,fontWeight:'700',lineHeight:24,color:C.text1,textAlign:'center',marginTop:8},
  actions:{flexDirection:'row',gap:10,marginTop:18},
  action:{flex:1},
  infoCard:{padding:0},
  infoHeader:{minHeight:58,flexDirection:'row',alignItems:'center',gap:12,paddingLeft:16,paddingRight:12,paddingTop:11,paddingBottom:9,borderBottomWidth:1,borderBottomColor:'rgba(54,50,43,.089)'},
  infoTitle:{flex:1,fontSize:18,fontWeight:'850',lineHeight:22,color:C.text1},
  close:{width:38,height:38,borderWidth:1,borderColor:C.controlBorder,borderRadius:19,backgroundColor:'transparent',alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:'#292721',shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:3},elevation:1},
  closePressed:{transform:[{scale:.95}],backgroundColor:C.controlGlassActive},
  infoBody:{minHeight:0,maxHeight:520},
  infoBodyContent:{paddingHorizontal:16,paddingVertical:14},
  infoActions:{paddingHorizontal:16,paddingTop:12,paddingBottom:16},
  infoAction:{width:'100%'},
});
