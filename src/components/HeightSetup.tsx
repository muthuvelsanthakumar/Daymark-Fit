import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, Alert } from 'react-native';
import { getPreference, setPreference } from '../services/db';
import { colors } from '../theme/tokens';

export default function HeightSetup() {
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState('165');
  const [saving, setSaving] = useState(false);
  useEffect(() => { let live = true; void getPreference('heightCm').then(value => { if (!live) return; if (value && Number(value) >= 100 && Number(value) <= 230) setHeight(value); else setVisible(true); }).catch(() => { if (live) setVisible(true); }); return () => { live = false; }; }, []);
  const save = async () => { const h = Number(height); if (!Number.isFinite(h) || h < 100 || h > 230) { Alert.alert('Check your height', 'Enter a height between 100 and 230 cm.'); return; } setSaving(true); try { await setPreference('heightCm', String(Math.round(h))); setVisible(false); } catch { Alert.alert('Could not save', 'Please try again.'); } finally { setSaving(false); } };
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => {}}><View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: 22 }}><View style={{ backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 22, gap: 14 }}><Text style={{ color: colors.text, fontSize: 23, fontWeight: '800' }}>Personalise step distance</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>Enter your height to estimate distance from your steps. You can change it later in Settings.</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><TextInput value={height} onChangeText={setHeight} keyboardType="number-pad" maxLength={3} accessibilityLabel="Height in centimetres" style={{ flex: 1, color: colors.text, backgroundColor: colors.panel2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 20, fontWeight: '700' }} /><Text style={{ color: colors.text, fontWeight: '700' }}>cm</Text></View><Text style={{ color: colors.muted, fontSize: 11 }}>Estimated stride is based on height bands and may differ from your actual gait.</Text><Pressable disabled={saving} onPress={() => void save()} style={{ backgroundColor: colors.green, padding: 15, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: colors.bg, fontWeight: '800' }}>{saving ? 'Saving…' : 'Save and continue'}</Text></Pressable></View></View></Modal>;
}
