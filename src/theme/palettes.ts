import { colors } from './tokens';

// Restrained, non-gradient palettes. The Devil style is a subtle motif, not a neon UI.
export const palettes = [
  { id:'dark-devil', name:'Dark Devil', bg:'#101112', panel:'#191A1C', panel2:'#222326', text:'#F3F2F0', muted:'#A4A4A6', border:'#38383B', track:'#303034', green:'#D83A42', blue:'#8EA8B8', orange:'#C5A27C', red:'#D83A42' },
  { id:'dark-minimal', name:'Dark Minimal', bg:'#151515', panel:'#202020', panel2:'#292929', text:'#F1F1F1', muted:'#A3A3A3', border:'#3A3A3A', track:'#343434', green:'#D0D0D0', blue:'#AEBBC3', orange:'#B9A994', red:'#D0D0D0' },
  { id:'light-devil', name:'Light Devil', bg:'#F4F3F1', panel:'#FFFFFF', panel2:'#ECEAE7', text:'#171717', muted:'#6E6B68', border:'#D9D6D2', track:'#E5E2DE', green:'#D52D36', blue:'#477F9D', orange:'#B78B52', red:'#D52D36' },
  { id:'light-minimal', name:'Light Minimal', bg:'#F6F6F5', panel:'#FFFFFF', panel2:'#EFEFED', text:'#202020', muted:'#777777', border:'#DEDEDC', track:'#E6E6E4', green:'#555B60', blue:'#687D88', orange:'#8B7E6D', red:'#555B60' },
  { id:'mono', name:'Monochrome', bg:'#E8E8E8', panel:'#F7F7F7', panel2:'#DDDDDD', text:'#171717', muted:'#666666', border:'#C8C8C8', track:'#D1D1D1', green:'#303030', blue:'#505050', orange:'#777777', red:'#303030' },
] as const;

export type PaletteId = typeof palettes[number]['id'];
export function applyPalette(id:string){
 const p=palettes.find(x=>x.id===id)||palettes[0];
 Object.assign(colors,{green:p.green,bg:p.bg,panel:p.panel,panel2:p.panel2,text:p.text,muted:p.muted,border:p.border,track:p.track,blue:p.blue,orange:p.orange,red:p.red});
}

export const accentOptions = [
 {id:'red',name:'Devil Red',color:'#D83A42'},
 {id:'blue',name:'Steel Blue',color:'#648DA5'},
 {id:'violet',name:'Muted Violet',color:'#8879A8'},
 {id:'amber',name:'Warm Amber',color:'#B78B52'},
 {id:'green',name:'Sage',color:'#719A83'},
 {id:'mono',name:'Monochrome',color:'#8A8A8A'},
] as const;
export function applyAccent(id:string){ const a=accentOptions.find(x=>x.id===id)||accentOptions[0]; colors.green=a.color; colors.red=a.color; }
