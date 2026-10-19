import React from 'react';
import { useRouter } from 'expo-router';
import Home from '../../src/screens/Home';
export default function HomeRoute(){const router=useRouter();return <Home startActivity={()=>router.push('/activity-live')} onNavigate={(tab:string)=>router.push('/(tabs)/'+tab)}/>;}
