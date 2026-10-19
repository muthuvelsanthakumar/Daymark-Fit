import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Draft = { title: string; notes: string };
type Props = { initialTitle?: string; initialNotes?: string; mode?: 'new' | 'update'; onSave: (draft: Draft) => void | Promise<void>; onCancel: () => void };

export default function PlannerTaskEditor({ initialTitle = '', initialNotes = '', mode = 'new', onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const notesRef = useRef<React.ElementRef<typeof TextInput>>(null);
  useEffect(() => { setTitle(initialTitle); setNotes(initialNotes); }, [initialTitle, initialNotes]);
  return <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
    <View style={s.sheet}>
      <View style={s.header}><Text style={s.heading}>{mode === 'update' ? 'Update task' : 'New task'}</Text><Pressable onPress={onCancel}><Text style={s.cancel}>Cancel</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text style={s.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Task title" placeholderTextColor="#7E91A2" style={s.input} returnKeyType="next" onSubmitEditing={() => notesRef.current?.focus()} />
        <Text style={s.label}>Notes</Text>
        <TextInput ref={notesRef} value={notes} onChangeText={setNotes} placeholder={'Write notes…\nEnter creates a new line'} placeholderTextColor="#7E91A2" style={s.notes} multiline textAlignVertical="top" blurOnSubmit={false} scrollEnabled returnKeyType="default" />
      </ScrollView>
      <Pressable style={s.save} onPress={() => onSave({ title: title.trim(), notes })}><Text style={s.saveText}>{mode === 'update' ? 'Update task' : 'Save task'}</Text></Pressable>
    </View>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({ overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'#0009'},sheet:{maxHeight:'94%',backgroundColor:'#0C1722',borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,borderWidth:1,borderColor:'#263A4A'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:14},heading:{fontSize:20,fontWeight:'800',color:'#F5F8FC'},cancel:{color:'#9EB1C1'},content:{paddingBottom:12},label:{color:'#9FB2C2',fontSize:12,fontWeight:'700',marginTop:8,marginBottom:7},input:{backgroundColor:'#142330',borderRadius:12,padding:13,color:'#F5F8FC',fontSize:16,borderWidth:1,borderColor:'#263A4A'},notes:{backgroundColor:'#142330',borderRadius:12,padding:13,color:'#F5F8FC',fontSize:15,lineHeight:22,minHeight:150,maxHeight:300,borderWidth:1,borderColor:'#263A4A'},save:{marginTop:12,backgroundColor:'#39D99D',padding:15,borderRadius:14,alignItems:'center'},saveText:{color:'#07150F',fontWeight:'900',fontSize:15}});
