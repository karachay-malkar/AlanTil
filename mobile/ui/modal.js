import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './components.js';
import { theme } from './theme.js';

const C=theme.colors;

export function ConfirmDialog({visible,title,message,confirmLabel,cancelLabel,onConfirm,onCancel}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onCancel} style={StyleSheet.absoluteFill}/>
      <View style={styles.card}>
        {title?<Text style={styles.title}>{title}</Text>:null}
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Button text style={styles.action} onPress={onCancel}>{cancelLabel}</Button>
          <Button primary style={styles.action} onPress={onConfirm}>{confirmLabel}</Button>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles=StyleSheet.create({
  root:{flex:1,alignItems:'center',justifyContent:'center',padding:18,backgroundColor:C.overlay},
  card:{width:'100%',maxWidth:500,padding:18,borderWidth:1,borderColor:C.lineStrong,borderRadius:theme.radius.lg,backgroundColor:C.surface0,shadowColor:C.text1,shadowOpacity:.20,shadowRadius:28,shadowOffset:{width:0,height:12},elevation:12},
  title:{fontSize:18,fontWeight:'800',lineHeight:23,color:C.text1,textAlign:'center'},
  message:{fontSize:17,fontWeight:'700',lineHeight:24,color:C.text1,textAlign:'center',marginTop:8},
  actions:{flexDirection:'row',gap:10,marginTop:18},
  action:{flex:1},
});
