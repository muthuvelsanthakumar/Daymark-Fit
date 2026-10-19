import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/tokens';
const items = [
  { name: 'index', title: 'Home', icon: 'grid-outline', active: 'grid' },
  { name: 'activity', title: 'Activity', icon: 'footsteps-outline', active: 'footsteps' },
  { name: 'analytics', title: 'Insights', icon: 'stats-chart-outline', active: 'stats-chart' },
  { name: 'planner', title: 'Planner', icon: 'calendar-outline', active: 'calendar' },
  { name: 'settings', title: 'Settings', icon: 'options-outline', active: 'options' },
] as const;
export default function TabLayout() {
 const insets = useSafeAreaInsets();
 return <Tabs screenOptions={{
   headerShown: false,
   tabBarStyle: { position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12) + 12, height: 68, paddingTop: 7, paddingBottom: 7, backgroundColor: colors.panel, borderTopColor: colors.border, borderColor: colors.border, borderWidth: 1, borderRadius: 20, elevation: 12 },
   tabBarActiveTintColor: colors.red, tabBarInactiveTintColor: colors.muted,
   tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
 }}>
 {items.map(item => <Tabs.Screen key={item.name} name={item.name} options={{
   title: item.title, tabBarIcon: ({color,size,focused}) => <Ionicons name={(focused ? item.active : item.icon) as any} size={size} color={String(color ?? colors.muted ?? "#FFFFFF")} />
 }} />)}
 </Tabs>;
}
