import * as Print from 'expo-print';
import { sharePdf } from './shareCoordinator';
import { listTasksBetween } from './db';

type Range='day'|'week'|'month';
type Template={id:string;name:string;emoji?:string;tasks:{id:string;title:string;detail?:string;category?:string;pinned?:boolean}[]};
const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
export async function exportPlannerPdf(range:Range,templates:Template[]){
 const now=new Date();const start=new Date(now);start.setHours(0,0,0,0);if(range==='week')start.setDate(start.getDate()-((start.getDay()+6)%7));if(range==='month')start.setDate(1);
 const rows=await listTasksBetween(dayKey(start),dayKey(now));const valid=rows.filter(r=>templates.some(t=>r.category.startsWith(`${t.id}|`)));
 const done=valid.filter(r=>!!r.done).length;const title=range==='day'?'Daily planner report':range==='week'?'Weekly planner report':'Monthly planner report';
 const grouped=templates.map(t=>({template:t,rows:valid.filter(r=>r.category.startsWith(`${t.id}|`))})).filter(g=>g.rows.length);
 const sections=grouped.map(g=>`<section><h2>${esc(g.template.emoji||'')} ${esc(g.template.name)}</h2><table><thead><tr><th>Status</th><th>Task</th><th>Notes</th><th>Date</th></tr></thead><tbody>${g.rows.map(r=>`<tr><td>${r.done?'Completed':'Pending'}</td><td>${esc(r.title)}</td><td>${esc(r.detail||'—')}</td><td>${esc(r.day)}</td></tr>`).join('')}</tbody></table></section>`).join('');
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#202124;padding:28px}h1{margin-bottom:4px}small{color:#666}.summary{display:flex;gap:12px;margin:22px 0}.tile{flex:1;padding:14px;background:#f2f3f5;border-radius:10px}h2{font-size:16px;margin-top:24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:9px;border-bottom:1px solid #ddd}th{background:#f4f4f4}.foot{margin-top:24px;font-size:10px;color:#777}</style></head><body><h1>Daymark Fit</h1><small>${title} · ${esc(dayKey(start))} to ${esc(dayKey(now))}</small><div class="summary"><div class="tile"><b>${valid.length}</b><br><small>Total task records</small></div><div class="tile"><b>${done}</b><br><small>Completed</small></div><div class="tile"><b>${valid.length?Math.round(done/valid.length*100):0}%</b><br><small>Completion</small></div></div>${sections||'<p>No planner tasks recorded for this period.</p>'}<p class="foot">Generated locally on ${esc(now.toLocaleString())}. This report contains planner records saved on this device.</p></body></html>`;
 const file=await Print.printToFileAsync({html});await sharePdf(file.uri,`Export ${title}`);return file.uri;
}
