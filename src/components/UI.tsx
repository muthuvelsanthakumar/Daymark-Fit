import React from 'react';
import { View, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, uiScale } from '../theme/tokens';

export function Screen({children, scroll=true}: any) {
 const { ScrollView } = require('react-native');
 const insets = useSafeAreaInsets();
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}} contentContainerStyle={{paddingHorizontal:20,paddingTop:Math.max(26,insets.top+12),paddingBottom:Math.max(112,insets.bottom+104),gap:18}} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}
export function Label({children, style}: any) { return <Text style={[{color:colors.muted,fontSize:12*uiScale.value,fontWeight:'600',letterSpacing:.5},style]}>{children}</Text>; }
export function Heading({children, size=24, style}: any) { return <Text style={[{color:colors.text,fontSize:size*uiScale.value,fontWeight:'800',letterSpacing:-.5},style]}>{children}</Text>; }
export function Card({children, style}: any) { return <View style={[{backgroundColor:colors.panel,borderColor:colors.border,borderWidth:1,borderRadius:20,padding:16,gap:12},style]}>{children}</View>; }
export function Pill({children, tone='green'}: any) {
 const color = tone==='orange' ? colors.orange : tone==='blue' ? colors.blue : colors.green;
 return <View style={{alignSelf:'flex-start',backgroundColor:color+'18',borderRadius:100,paddingHorizontal:10,paddingVertical:6}}><Text style={{color,fontSize:11,fontWeight:'700'}}>{children}</Text></View>;
}
export function Action({label,onPress,icon='arrow-forward',secondary=false}: any) {
 return <Pressable onPress={onPress} style={({pressed})=>({backgroundColor:secondary?colors.panel2:colors.green,borderRadius:14,paddingVertical:14,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:pressed?.8:1})}><Text style={{color:secondary?colors.text:'#0B1710',fontWeight:'800',fontSize:14}}>{label}</Text><Ionicons name={icon as any} size={17} color={secondary?colors.text:'#0B1710'}/></Pressable>;
}
export function Stat({icon,label,value,foot,tint=colors.green}: any) {
 return <View style={{flex:1,minWidth:130,backgroundColor:colors.panel,borderRadius:18,borderWidth:1,borderColor:colors.border,padding:14,gap:8}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Ionicons name={icon as any} size={19} color={tint}/><Label>{label}</Label></View>
   <Heading size={24}>{value}</Heading><Text style={{fontSize:11,color:colors.muted}}>{foot}</Text>
 </View>;
}
export function SectionTitle({title,action}: any) { return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Heading size={17}>{title}</Heading>{action ? <Text style={{color:colors.green,fontSize:12,fontWeight:'700'}}>{action}</Text>:null}</View>; }
export function Progress({value,color=colors.green}: any) { return <View style={{height:7,backgroundColor:colors.track,borderRadius:10,overflow:'hidden'}}><View style={{height:'100%',width:`${Math.max(0,Math.min(100,value))}%`,backgroundColor:color,borderRadius:10}}/></View>; }
