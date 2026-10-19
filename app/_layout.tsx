import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme/tokens';
import { getPreference } from '../src/services/db';
import { applyPalette, applyAccent } from '../src/theme/palettes';
import { uiScale } from '../src/theme/tokens';
import { startStepTracking } from '../src/services/steps';
import '../src/services/gpsTracking'; // Register the background GPS task before the app is rendered.
import HeightSetup from '../src/components/HeightSetup';
export default function RootLayout() {
  useEffect(()=>{void startStepTracking();let live=true;(async()=>{try{const [theme,accent,font]=await Promise.all([getPreference('themePalette'),getPreference('accentColor'),getPreference('fontScale')]);if(!live)return;if(theme)applyPalette(theme);if(accent)applyAccent(accent);uiScale.value=font==='large'?1.12:font==='small'?.92:1;}catch{}})();return()=>{live=false}},[]);
  return <>
    <StatusBar style="light" />
    <HeightSetup />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="activity-live" options={{ presentation: 'modal' }} />
    </Stack>
  </>;
}
