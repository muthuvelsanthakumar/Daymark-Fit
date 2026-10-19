import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Label, Heading, Card, Pill, Action, SectionTitle, Progress } from '../components/UI';
import { colors } from '../theme/tokens';
import { ActivityRecord, DailyRecord, listActivities, getDailyTotals, getPreference, getTodayStepTotal } from '../services/db';
import { getStepTrackerSnapshot, startStepTracking, subscribeSteps, StepStatus } from '../services/steps';
import { getSavedStrideMeters } from '../services/stride';
import { verifyActivity } from '../services/activityValidation';

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const activities = [
  { id:'walk', label:'Walk', icon:'walk-outline', hint:'GPS distance and pace when location is available; steps tracked independently' },
  { id:'run', label:'Run', icon:'fitness-outline', hint:'GPS route, distance, live pace and steps' },
  { id:'meditation', label:'Meditation', icon:'leaf-outline', hint:'Mindful timer · no motion metrics required' },
] as const;
function fmtDuration(seconds:number) { return `${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`; }
function statusText(s:StepStatus) { return s==='tracking'?'STEP SENSOR ACTIVE':s==='permission-denied'?'ACTIVITY PERMISSION NEEDED':s==='unavailable'?'STEP SENSOR UNAVAILABLE':s==='error'?'TRACKING ERROR':'STARTING STEP SENSOR'; }

export default function Activity() {
  const router=useRouter();
  const [strideMeters,setStrideMeters]=useState(0.65);
  const [historyRange,setHistoryRange]=useState<'All'|'7 days'|'30 days'>('All');
  const [historyType,setHistoryType]=useState<'All'|'walk'|'run'|'meditation'>('All');
  const [sortBy,setSortBy]=useState<'Newest'|'Oldest'|'Distance'|'Duration'|'Steps'|'Pace'>('Newest');
  const [minDistanceKm,setMinDistanceKm]=useState('');const [maxDistanceKm,setMaxDistanceKm]=useState('');
  const [steps,setSteps]=useState(getStepTrackerSnapshot().steps);
  const [sensorStatus,setSensorStatus]=useState<StepStatus>(getStepTrackerSnapshot().status);
  const [goal,setGoal]=useState(10000);
  const [history,setHistory]=useState<ActivityRecord[]>([]);
  const [dailyTotals,setDailyTotals]=useState<DailyRecord[]>([]);
  const [summaryPeriod,setSummaryPeriod]=useState<'Day'|'Week'|'Month'|'Year'>('Week');
  const [lastUpdateMs,setLastUpdateMs]=useState(getStepTrackerSnapshot().lastUpdateMs);
  const [mode,setMode]=useState<(typeof activities)[number]['id']>('walk');
  const today=dayKey();

  useEffect(()=>subscribeSteps((value,status,lastUpdate)=>{setSteps(value);setSensorStatus(status);setLastUpdateMs(lastUpdate)}),[]);
  useFocusEffect(useCallback(()=>{
    let alive=true;
    void startStepTracking();void getSavedStrideMeters().then(setStrideMeters).catch(()=>{});
    const yearAgo=new Date(); yearAgo.setDate(yearAgo.getDate()-365);
    const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    void Promise.all([listActivities(1000),getPreference('stepGoal'),getTodayStepTotal(today),getDailyTotals(key(yearAgo),today)]).then(([rows,savedGoal,storedSteps,totals])=>{
      if(!alive)return;
      setHistory(rows);
      setDailyTotals(totals);
      if(savedGoal && Number.isFinite(Number(savedGoal)))setGoal(Math.max(100,Math.min(100000,Number(savedGoal))));
      setSteps(Math.max(storedSteps,getStepTrackerSnapshot().steps));
    }).catch(()=>{});
    return()=>{alive=false};
  },[today]));

  const todayHistory=history.filter(a=>a.startedAt.slice(0,10)===today);
  const activeSeconds=todayHistory.reduce((n,a)=>n+a.durationSeconds,0);
  const workoutCalories=todayHistory.reduce((n,a)=>n+a.calories,0);
  const estimatedDistanceKm=steps*strideMeters/1000;
  const summaryStart=(()=>{const d=new Date();d.setHours(0,0,0,0);if(summaryPeriod==='Week')d.setDate(d.getDate()-((d.getDay()+6)%7));else if(summaryPeriod==='Month')d.setDate(1);else if(summaryPeriod==='Year')d.setMonth(0,1);return dayKey(d)})();
  const summaryRows=dailyTotals.filter(r=>r.day>=summaryStart&&r.day<=today);
  const summarySteps=summaryRows.reduce((n,r)=>n+r.steps,0);
  const summaryDistance=summarySteps*strideMeters/1000;
  const lastUpdateText=lastUpdateMs>0?new Date(lastUpdateMs).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Not yet received';
  const estimatedStepCalories=Math.round(steps*0.04);
  const selected=activities.find(a=>a.id===mode)!;
  const progress=Math.min(100,steps/goal*100);
  const cutoff = historyRange==='All' ? null : new Date(Date.now()-(historyRange==='7 days'?7:30)*86400000);
  const minKm=Number(minDistanceKm);const maxKm=Number(maxDistanceKm);
  const visibleHistory = history.filter(a => (historyType==='All'||a.type===historyType) && (!cutoff || new Date(a.startedAt)>=cutoff) && (!minDistanceKm.trim() || (Number.isFinite(minKm)&&a.distanceMeters/1000>=minKm)) && (!maxDistanceKm.trim() || (Number.isFinite(maxKm)&&a.distanceMeters/1000<=maxKm))).sort((a,b)=>sortBy==='Newest'?b.startedAt.localeCompare(a.startedAt):sortBy==='Oldest'?a.startedAt.localeCompare(b.startedAt):sortBy==='Distance'?b.distanceMeters-a.distanceMeters:sortBy==='Duration'?b.durationSeconds-a.durationSeconds:sortBy==='Steps'?b.steps-a.steps:(a.avgPaceSecondsPerKm??Infinity)-(b.avgPaceSecondsPerKm??Infinity));
  const verification = (a:ActivityRecord) => verifyActivity(a);

  return <Screen>
    <View style={{gap:5}}><Label>ACTIVITY · DAILY MOVEMENT</Label><Heading size={29}>Your movement</Heading><Text style={{color:colors.muted,fontSize:13,lineHeight:19}}>All-day steps plus GPS distance and pace during Walk/Run sessions.</Text></View>
    <Card style={{padding:20,gap:14,borderColor:colors.red}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Pill>{statusText(sensorStatus)}</Pill><Ionicons name="footsteps" size={25} color={colors.red}/></View>
      <View style={{flexDirection:'row',alignItems:'baseline',gap:8}}><Heading size={42}>{steps.toLocaleString()}</Heading><Text style={{color:colors.muted,fontSize:12}}>steps today</Text></View>
      <Progress value={progress}/>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{color:colors.muted,fontSize:12}}>{Math.max(0,goal-steps).toLocaleString()} steps to goal</Text><Text style={{color:colors.red,fontWeight:'800',fontSize:12}}>{Math.round(progress)}%</Text></View>
      <Text style={{color:colors.muted,fontSize:11}}>Last sensor update: {lastUpdateText}</Text>
      {sensorStatus!=='tracking'?<Pressable onPress={()=>void startStepTracking()} style={{padding:12,borderRadius:12,borderWidth:1,borderColor:colors.border,alignItems:'center'}}><Text style={{color:colors.text,fontWeight:'700'}}>Try enabling step tracking</Text></Pressable>:null}
    </Card>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
      {[{label:'EST. DISTANCE',value:`${estimatedDistanceKm.toFixed(2)} km`,icon:'walk-outline',foot:'From steps · 0.65 m/step'},{label:'EST. STEP KCAL',value:`${estimatedStepCalories} kcal`,icon:'flame-outline',foot:'Approximation only'},{label:'ACTIVE TIME',value:fmtDuration(activeSeconds),icon:'time-outline',foot:'Saved sessions'},{label:'SESSION KCAL',value:`${workoutCalories} kcal`,icon:'fitness-outline',foot:'Activity estimates'}].map(item=><View key={item.label} style={{width:'48%',flexGrow:1,backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:16,padding:14,gap:7}}><Ionicons name={item.icon as any} size={19} color={colors.red}/><Label>{item.label}</Label><Heading size={21}>{item.value}</Heading><Text style={{color:colors.muted,fontSize:10}}>{item.foot}</Text></View>)}
    </View>
    <SectionTitle title="Activity summary" action="Steps · estimated"/>
    <Card style={{gap:12}}>
      <View style={{flexDirection:'row',gap:5}}>{(['Day','Week','Month','Year'] as const).map(p=><Pressable key={p} onPress={()=>setSummaryPeriod(p)} style={{flex:1,paddingVertical:9,borderRadius:10,alignItems:'center',backgroundColor:summaryPeriod===p?colors.red:colors.panel2,borderWidth:1,borderColor:summaryPeriod===p?colors.red:colors.border}}><Text style={{fontSize:11,fontWeight:'800',color:summaryPeriod===p?'#FFFFFF':colors.muted}}>{p}</Text></Pressable>)}</View>
      <View style={{flexDirection:'row',gap:12}}>
        <View style={{flex:1,gap:4}}><Label>{summaryPeriod.toUpperCase()} STEPS</Label><Heading size={22}>{summaryPeriod==='Day'?steps.toLocaleString():summarySteps.toLocaleString()}</Heading></View>
        <View style={{flex:1,gap:4}}><Label>EST. DISTANCE</Label><Heading size={22}>{(summaryPeriod==='Day'?estimatedDistanceKm:summaryDistance).toFixed(2)} km</Heading></View>
      </View>
      <Text style={{color:colors.muted,fontSize:11}}>Summary is based on locally saved daily sensor totals. Distance uses your height-based stride estimate.</Text>
    </Card>
    <SectionTitle title="Start an activity" action="3 modes"/>
    <Card style={{gap:13}}>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{activities.map(a=><Pressable key={a.id} onPress={()=>setMode(a.id)} style={{width:'31%',flexGrow:1,minWidth:90,alignItems:'center',gap:7,paddingVertical:13,paddingHorizontal:7,borderRadius:14,borderWidth:1,borderColor:mode===a.id?colors.red:colors.border,backgroundColor:mode===a.id?colors.panel2:colors.panel}}><Ionicons name={a.icon as any} size={23} color={mode===a.id?colors.red:colors.muted}/><Text style={{color:mode===a.id?colors.text:colors.muted,fontSize:12,fontWeight:'700'}}>{a.label}</Text></Pressable>)}</View>
      <Text style={{color:colors.muted,fontSize:12}}>{selected.hint}</Text>
      <Action label={`Start ${selected.label.toLowerCase()}`} icon="play" onPress={()=>router.push(mode==='run'?'/run-tracker':{pathname:'/activity-live',params:{type:mode}})}/>
    </Card>
    <SectionTitle title="Activity history" action={`${visibleHistory.length} matching`}/>
    <Card style={{gap:12}}>
      <Text style={{color:colors.text,fontWeight:'800'}}>Date range</Text><View style={{flexDirection:'row',gap:7}}>{(['All','7 days','30 days'] as const).map(v=><Pressable key={v} onPress={()=>setHistoryRange(v)} style={{flex:1,padding:10,borderRadius:10,alignItems:'center',backgroundColor:historyRange===v?colors.red:colors.panel2,borderWidth:1,borderColor:historyRange===v?colors.red:colors.border}}><Text style={{color:historyRange===v?'#FFFFFF':colors.muted,fontSize:11,fontWeight:'700'}}>{v}</Text></Pressable>)}</View>
      <Text style={{color:colors.text,fontWeight:'800'}}>Activity type</Text><View style={{flexDirection:'row',gap:7}}>{(['All','walk','run','meditation'] as const).map(v=><Pressable key={v} onPress={()=>setHistoryType(v)} style={{flex:1,padding:9,borderRadius:10,alignItems:'center',backgroundColor:historyType===v?colors.red:colors.panel2,borderWidth:1,borderColor:historyType===v?colors.red:colors.border}}><Text style={{color:historyType===v?'#FFFFFF':colors.muted,fontSize:10,fontWeight:'700'}}>{v==='All'?'All':v[0].toUpperCase()+v.slice(1)}</Text></Pressable>)}</View>
      <Text style={{color:colors.text,fontWeight:'800'}}>Distance range (km)</Text><View style={{flexDirection:'row',gap:8}}><TextInput value={minDistanceKm} onChangeText={setMinDistanceKm} keyboardType="decimal-pad" placeholder="Min km" placeholderTextColor={colors.muted} style={{flex:1,color:colors.text,backgroundColor:colors.panel2,borderColor:colors.border,borderWidth:1,borderRadius:10,padding:10}}/><TextInput value={maxDistanceKm} onChangeText={setMaxDistanceKm} keyboardType="decimal-pad" placeholder="Max km" placeholderTextColor={colors.muted} style={{flex:1,color:colors.text,backgroundColor:colors.panel2,borderColor:colors.border,borderWidth:1,borderRadius:10,padding:10}}/><Pressable onPress={()=>{setMinDistanceKm('');setMaxDistanceKm('')}} style={{justifyContent:'center',paddingHorizontal:10}}><Text style={{color:colors.red,fontWeight:'700'}}>Clear</Text></Pressable></View>
      <Text style={{color:colors.text,fontWeight:'800'}}>Sort by</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{(['Newest','Oldest','Distance','Duration','Steps','Pace'] as const).map(v=><Pressable key={v} onPress={()=>setSortBy(v)} style={{paddingVertical:8,paddingHorizontal:11,borderRadius:10,backgroundColor:sortBy===v?colors.panel2:colors.panel,borderWidth:1,borderColor:sortBy===v?colors.red:colors.border}}><Text style={{color:sortBy===v?colors.text:colors.muted,fontSize:11,fontWeight:'700'}}>{v}</Text></Pressable>)}</View>
    </Card>
    {visibleHistory.length===0?<Card style={{alignItems:'center',paddingVertical:22,gap:8}}><Ionicons name="barbell-outline" size={28} color={colors.muted}/><Heading size={16}>No matching sessions</Heading><Text style={{color:colors.muted,fontSize:12,textAlign:'center'}}>Try changing the date range or activity type.</Text></Card>:visibleHistory.map(a=>{const item=activities.find(m=>m.id===a.type)||activities[0];const v=verification(a);return <Card key={a.id} style={{gap:9}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:42,height:42,borderRadius:13,backgroundColor:colors.panel2,alignItems:'center',justifyContent:'center'}}><Ionicons name={item.icon as any} size={22} color={colors.red}/></View><View style={{flex:1,gap:4}}><Text style={{color:colors.text,fontWeight:'700'}}>{item.label}</Text><Text style={{color:colors.muted,fontSize:11}}>{new Date(a.startedAt).toLocaleString()} · {fmtDuration(a.durationSeconds)}</Text></View><View style={{alignItems:'flex-end',gap:4}}><Text style={{color:colors.text,fontWeight:'800'}}>{(a.distanceMeters/1000).toFixed(2)} km</Text><Text style={{color:colors.muted,fontSize:11}}>{a.steps.toLocaleString()} steps</Text></View></View><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Pill>{v.status.toUpperCase()}</Pill><Text style={{color:colors.muted,fontSize:11}}>{a.avgPaceSecondsPerKm?`${Math.floor(a.avgPaceSecondsPerKm/60)}:${String(Math.round(a.avgPaceSecondsPerKm%60)).padStart(2,'0')} /km`:'Pace unavailable'} · {a.calories} kcal*</Text></View>{v.status!=='Verified'?<Text style={{color:colors.orange,fontSize:11}}>{v.reasons.join(' · ')}. Automatic checks are advisory, not proof of invalid activity.</Text>:null}</Card>})}
    <Text style={{color:colors.muted,fontSize:10,lineHeight:16}}>Step distance and calories are estimates, not measurements. Automatic background collection requires the Android native step tracker, motion permission and device sensor support. Walk/Run sessions can use GPS route points; daily steps are tracked independently.</Text>
  </Screen>;
}
