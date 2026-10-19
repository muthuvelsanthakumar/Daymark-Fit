import * as Print from 'expo-print';
import { sharePdf } from './shareCoordinator';
import { listActivities, getDailyTotals } from './db';

const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
export async function exportActivityReport() {
 const rows=await listActivities(500);
 const totalMeters=rows.reduce((s,r)=>s+r.distanceMeters,0);
 const totalSeconds=rows.reduce((s,r)=>s+r.durationSeconds,0);
 const totalSteps=rows.reduce((s,r)=>s+r.steps,0);
 const body=rows.map(a=>`<tr><td>${escapeHtml(new Date(a.startedAt).toLocaleString())}</td><td>${a.type}</td><td>${(a.distanceMeters/1000).toFixed(2)} km</td><td>${Math.floor(a.durationSeconds/60)} min</td><td>${a.steps}</td><td>${a.calories} kcal*</td></tr>`).join('');
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 body{font-family:Arial,sans-serif;padding:28px;color:#17202b}h1{margin-bottom:4px}small{color:#64748b}.stats{display:flex;gap:10px;margin:24px 0}.stat{background:#f1f5f9;padding:14px;border-radius:12px;flex:1}table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:9px;border-bottom:1px solid #e2e8f0}th{background:#f8fafc}.note{margin-top:24px;font-size:10px;color:#64748b}
 </style></head><body><h1>Daymark Fit</h1><small>Activity report · Generated ${new Date().toLocaleString()}</small><div class="stats"><div class="stat"><b>${(totalMeters/1000).toFixed(1)} km</b><br><small>Total distance</small></div><div class="stat"><b>${Math.floor(totalSeconds/3600)}h ${Math.floor(totalSeconds%3600/60)}m</b><br><small>Active time</small></div><div class="stat"><b>${totalSteps}</b><br><small>Recorded steps</small></div></div><h2>Activities</h2><table><thead><tr><th>Date</th><th>Type</th><th>Distance</th><th>Duration</th><th>Steps</th><th>Calories</th></tr></thead><tbody>${body||'<tr><td colspan="6">No activities recorded yet.</td></tr>'}</tbody></table><p class="note">*Calories are estimates. Report generated from data stored locally on this device. Distance and calories are estimates where no external sensor is available.</p></body></html>`;
 const file=await Print.printToFileAsync({html});
 await sharePdf(file.uri, 'Export Daymark Fit report');
 return file.uri;
}
