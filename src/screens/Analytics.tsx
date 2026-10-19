import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { Screen, Label, Heading, Card, Pill, Stat, SectionTitle, Action } from '../components/UI';
import { colors } from '../theme/tokens';
import { listActivities, ActivityRecord, getDailyTotals, DailyRecord } from '../services/db';
import { exportActivityReport } from '../services/reports';
import { getSavedStrideMeters } from '../services/stride';

type Period = 'Day' | 'Week' | 'Month' | 'Year';
const periods: Period[] = ['Day', 'Week', 'Month', 'Year'];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function startOfPeriod(now: Date, period: Period) { const d = new Date(now); d.setHours(0,0,0,0); if(period==='Week') d.setDate(d.getDate()-((d.getDay()+6)%7)); else if(period==='Month') d.setDate(1); else if(period==='Year') { d.setMonth(0,1); } return d; }
function DistanceChart({ data, width }: { data: { label: string; value: number }[]; width: number }) {
  const height=190, left=12, right=width-12, top=14, bottom=150;
  const max=Math.max(0.1,...data.map(d=>d.value));
  const points=data.map((d,i)=>`${data.length<=1?(left+right)/2:left+(i/(data.length-1))*(right-left)},${bottom-(d.value/max)*(bottom-top)}`).join(' ');
  const hasData=data.some(d=>d.value>0);
  const labels=data.length>14?data.filter((_,i)=>i%Math.ceil(data.length/7)===0||i===data.length-1):data;
  return <View style={{width:'100%',height,marginTop:8}}><Svg width={width} height={height}>
    {[0,.33,.66,1].map((r,i)=><Line key={i} x1={left} y1={bottom-r*(bottom-top)} x2={right} y2={bottom-r*(bottom-top)} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5"/>)}
    {hasData?<><Polyline points={points} fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>{data.map((d,i)=>{if(d.value<=0)return null;const x=data.length<=1?(left+right)/2:left+(i/(data.length-1))*(right-left);const y=bottom-(d.value/max)*(bottom-top);return <Circle key={`${d.label}-${i}`} cx={x} cy={y} r={3.3} fill={colors.green} stroke={colors.panel} strokeWidth={1.5}/>})}</>:<><Line x1={left} y1={bottom} x2={right} y2={bottom} stroke={colors.track} strokeWidth={2}/><SvgText x={width/2} y={78} fill={colors.muted} fontSize="12" textAnchor="middle">No step data yet</SvgText><SvgText x={width/2} y={96} fill={colors.muted} fontSize="10" textAnchor="middle">Daily sensor totals appear here</SvgText></>}
    {labels.map((d,idx)=>{const originalIndex=data.indexOf(d);const x=data.length<=1?(left+right)/2:left+(originalIndex/(data.length-1))*(right-left);return <SvgText key={`${d.label}-${idx}`} x={x} y={173} fill={colors.muted} fontSize="9" textAnchor="middle">{d.label}</SvgText>})}
  </Svg></View>;
}
export default function Analytics() {
 const [period,setPeriod]=useState<Period>('Day');
 const [rows,setRows]=useState<ActivityRecord[]>([]);
 const [dailyRows,setDailyRows]=useState<DailyRecord[]>([]);
 const [busy,setBusy]=useState(false);
 const [stepMeters,setStepMeters]=useState(0.65);
 const {width:screenWidth}=useWindowDimensions();
 const refresh=useCallback(()=>{let alive=true;(async()=>{try{const stride=await getSavedStrideMeters();const now=new Date();const start=new Date(now.getFullYear()-1,0,1);const [activities,totals]=await Promise.all([listActivities(5000),getDailyTotals(dayKey(start),dayKey(now))]);if(alive){setRows(activities);setDailyRows(totals);setStepMeters(stride)}}catch(e){console.warn('Insights refresh failed',e)}})();return()=>{alive=false}},[]);
 useFocusEffect(refresh);
 const now=new Date();
 const rangeStart=useMemo(()=>startOfPeriod(now,period),[period,rows.length,dailyRows.length]);
 const rangeEnd=now;
 const filtered=rows.filter(r=>{const t=new Date(r.startedAt).getTime();return t>=rangeStart.getTime()&&t<=rangeEnd.getTime()});
 const selectedDaily=dailyRows.filter(r=>r.day>=dayKey(rangeStart)&&r.day<=dayKey(rangeEnd));
 const stepsFromSensor=selectedDaily.reduce((sum,r)=>sum+Math.max(0,r.steps||0),0);
 const sessionSteps=filtered.reduce((sum,r)=>sum+Math.max(0,r.steps||0),0);
 const steps=stepsFromSensor>0?stepsFromSensor:sessionSteps;
 const meters=stepsFromSensor>0?stepsFromSensor*stepMeters:filtered.reduce((sum,r)=>sum+Math.max(0,r.distanceMeters||0),0);
 const seconds=filtered.reduce((sum,r)=>sum+Math.max(0,r.durationSeconds||0),0);
 const cal=filtered.reduce((sum,r)=>sum+Math.max(0,r.calories||0),0)+(stepsFromSensor>0?Math.round(stepsFromSensor*.04):0);
 const buckets=useMemo(()=>{
   if(period==='Day') return [{label:'Today',value:(dailyRows.find(r=>r.day===dayKey(now))?.steps||0)*stepMeters/1000}];
   const count=period==='Month'?new Date(now.getFullYear(),now.getMonth()+1,0).getDate():period==='Year'?12:7;
   return Array.from({length:count},(_,i)=>{let start:Date,label:string;
     if(period==='Year'){start=new Date(now.getFullYear(),i,1);label=start.toLocaleDateString(undefined,{month:'short'});}
     else if(period==='Month'){start=new Date(now.getFullYear(),now.getMonth(),i+1);label=String(i+1);}
     else {const monday=new Date(now);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));start=new Date(monday);start.setDate(start.getDate()+i);label=start.toLocaleDateString(undefined,{weekday:'short'}).slice(0,1);}
     const key=dayKey(start);const record=dailyRows.find(r=>r.day===key);const sensorSteps=record?.steps||0;
     const activityDistance=rows.filter(r=>dayKey(new Date(r.startedAt))===key).reduce((sum,r)=>sum+r.distanceMeters,0);
     return {label,value:sensorSteps>0?sensorSteps*stepMeters/1000:activityDistance/1000};
   });
 },[period,dailyRows,rows]);
 const chartWidth=Math.max(260,screenWidth-72);
 const pdf=async()=>{setBusy(true);try{await exportActivityReport()}catch(e:any){Alert.alert('Export failed',e?.message||'Unable to create PDF report.')}finally{setBusy(false)}};
 return <Screen>
  <View style={{gap:6}}><Label>YOUR DATA, MADE CLEAR</Label><Heading size={28}>Insights</Heading><Text style={{color:colors.muted,fontSize:13}}>All-day steps plus your saved activity sessions.</Text></View>
  <View style={{flexDirection:'row',backgroundColor:colors.panel,borderRadius:14,padding:4,borderWidth:1,borderColor:colors.border}}>{periods.map(p=><Pressable key={p} onPress={()=>setPeriod(p)} style={{flex:1,padding:10,alignItems:'center',borderRadius:10,backgroundColor:period===p?colors.green:'transparent'}}><Text style={{fontWeight:'800',fontSize:12,color:period===p?colors.bg:colors.muted}}>{p}</Text></Pressable>)}</View>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}><Stat icon="footsteps" label="RECORDED STEPS" value={steps.toLocaleString()} foot={`${filtered.length} saved sessions`} /><Stat icon="navigate" label="EST. DISTANCE" value={`${(meters/1000).toFixed(2)} km`} foot="Height-based stride estimate" tint={colors.blue}/><Stat icon="time" label="ACTIVE TIME" value={`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`} foot="Saved session duration" tint={colors.orange}/><Stat icon="flame" label="EST. CALORIES" value={`${cal} kcal`} foot="Approximation only"/></View>
  <Card><View style={{gap:4}}><Heading size={17}>Distance trend</Heading><Text style={{color:colors.muted,fontSize:12}}>{`Step-based estimated distance · ${period.toLowerCase()} view`}</Text></View><DistanceChart data={buckets} width={chartWidth}/><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:11,color:colors.muted}}>{steps>0?'Includes all-day phone sensor steps':'No step data recorded in this period'}</Text><Pill>{`${(meters/1000).toFixed(2)} km`}</Pill></View></Card>
  <SectionTitle title="Your highlights"/><Card><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Text style={{fontSize:25}}>↗</Text><View style={{flex:1,gap:4}}><Text style={{color:colors.text,fontWeight:'700'}}>Activities recorded</Text><Text style={{color:colors.muted,fontSize:12,lineHeight:18}}>{filtered.length} saved sessions in the selected period. Step tracking is counted independently.</Text></View><Pill>{period}</Pill></View></Card>
  <Action label={busy?'Preparing PDF…':'Export PDF report'} icon="document-text" onPress={pdf}/><Text style={{fontSize:11,color:colors.muted,lineHeight:17}}>PDF is generated locally and shared through your device's share sheet. No account or cloud upload is required.</Text>
 </Screen>;
}
