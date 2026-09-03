import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './components.js';
import { CloseIcon } from './icons.js';
import { theme } from './theme.js';

const C=theme.colors;

function ModalShell({visible,onClose,children,accessibilityLabel}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel||''} onPress={onClose} style={StyleSheet.absoluteFill}/>
      {children}
    </View>
  </Modal>;
}

export function ConfirmDialog({visible,title,message,confirmLabel,cancelLabel,onConfirm,onCancel}) {
  return <ModalShell visible={visible} onClose={onCancel} accessibilityLabel={cancelLabel}>
    <View accessibilityRole="alert" style={styles.card}>
      {title?<Text style={styles.title}>{title}</Text>:null}
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Button text style={styles.action} onPress={onCancel}>{cancelLabel}</Button>
        <Button primary action style={styles.action} onPress={onConfirm}>{confirmLabel}</Button>
      </View>
    </View>
  </ModalShell>;
}

export function InfoDialog({visible,title='',closeLabel='Close',onClose,children}) {
  return <ModalShell visible={visible} onClose={onClose} accessibilityLabel={closeLabel}>
    <View accessibilityRole="summary" style={[styles.card,styles.infoCard]}>
      <View style={styles.infoHeader}>
        {title?<Text numberOfLines={2} style={styles.infoTitle}>{title}</Text>:<View style={styles.infoTitle}/>} 
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={({pressed})=>[styles.close,pressed&&styles.closePressed]}><CloseIcon size={18} color={C.text2}/></Pressable>
      </View>
      <ScrollView style={styles.infoBody} contentContainerStyle={styles.infoBodyContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>
      <View style={styles.infoActions}><Button primary action style={styles.infoAction} onPress={onClose}>{closeLabel}</Button></View>
    </View>
  </ModalShell>;
}

const styles=StyleSheet.create({
  root:{flex:1,alignItems:'center',justifyContent:'center',padding:18,backgroundColor:C.overlay},
  card:{width:'100%',maxWidth:theme.modal.maxWidth,maxHeight:'88%',padding:theme.modal.padding,borderWidth:1,borderColor:C.lineStrong,borderRadius:theme.modal.radius,backgroundColor:C.surface0,shadowColor:C.text1,shadowOpacity:.20,shadowRadius:28,shadowOffset:{width:0,height:12},elevation:12},
  title:{fontSize:18,fontWeight:'800',lineHeight:23,color:C.text1,textAlign:'center'},
  message:{fontSize:17,fontWeight:'700',lineHeight:24,color:C.text1,textAlign:'center',marginTop:8},
  actions:{flexDirection:'row',gap:10,marginTop:18},
  action:{flex:1},
  infoCard:{padding:0,overflow:'hidden'},
  infoHeader:{minHeight:54,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  infoTitle:{flex:1,fontSize:18,fontWeight:'850',lineHeight:22,color:C.text1},
  close:{width:38,height:38,borderWidth:1,borderColor:C.line,borderRadius:19,backgroundColor:C.surface1,alignItems:'center',justifyContent:'center'},
  closePressed:{opacity:.68,transform:[{scale:.97}]},
  infoBody:{minHeight:0,maxHeight:520},
  infoBodyContent:{paddingHorizontal:16,paddingVertical:14},
  infoActions:{paddingHorizontal:16,paddingTop:12,paddingBottom:16},
  infoAction:{width:'100%'},
});
