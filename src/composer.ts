import type {Tune,Style,Instrument,MusicMood} from './types.js';
export type NoteEvent={at:number;duration:number;midi:number;instrument:Instrument;gain:number;pan:number;noiseSeed:number};
export type Config={
 timezone:string;seed:number;lookAheadSec:number;tickMs:number;crossfadeSec:number;
 maxVoices:number;noRepeatWindow:number;quietHours:{start:number;end:number};
 targetLufs:number;maxTruePeakDbfs:number;
 levels:{melody:number;bass:number;strings:number;bells:number;sleigh:number};
};
export type TrackPlan={id:string;tune:Tune;style:Style;key:number;seed:number;bpm:number;duration:number;events:NoteEvent[];transitionSeconds?:number};
export type Clock={now():number;setTimeout(fn:()=>void,ms:number):unknown;clearTimeout(id:unknown):void};
export const defaultConfig:Config={
 timezone:'Asia/Ho_Chi_Minh',seed:24122026,lookAheadSec:1.25,tickMs:100,crossfadeSec:4,
 maxVoices:48,noRepeatWindow:40,quietHours:{start:22,end:6},targetLufs:-22,maxTruePeakDbfs:-1,
 levels:{melody:.17,bass:.08,strings:.025,bells:.08,sleigh:.035}
};
export function validateConfig(input:Partial<Config>={}):Config{
 const c={...defaultConfig,...input,quietHours:{...defaultConfig.quietHours,...input.quietHours},levels:{...defaultConfig.levels,...input.levels}};
 if(!Number.isFinite(c.seed))throw new Error('seed must be finite');
 if(c.lookAheadSec<.2||c.lookAheadSec>3)throw new Error('lookAheadSec must be between 0.2 and 3 seconds');
 if(c.tickMs<25||c.tickMs>500)throw new Error('tickMs must be between 25 and 500 ms');
 if(c.crossfadeSec<0||c.crossfadeSec>12)throw new Error('crossfadeSec must be between 0 and 12 seconds');
 if(!Number.isInteger(c.maxVoices)||c.maxVoices<8||c.maxVoices>128)throw new Error('maxVoices must be an integer from 8 to 128');
 if(!Number.isInteger(c.noRepeatWindow)||c.noRepeatWindow<1)throw new Error('noRepeatWindow must be a positive integer');
 if(c.quietHours.start<0||c.quietHours.start>23||c.quietHours.end<0||c.quietHours.end>23)throw new Error('quiet hours must be clock hours 0–23');
 for(const [name,value] of Object.entries(c.levels))if(!Number.isFinite(value)||value<0||value>.5)throw new Error(name+' level must be between 0 and 0.5');
 return c;
}
export function seeded(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export const styles:Style[]=['swing','ballad','musicbox','bellchoir','ambient'];
const keyOffsets=[0,2,5,7,9];
export function virtualTrackIds(catalog:Tune[]){return catalog.flatMap(t=>styles.flatMap(s=>keyOffsets.map(k=>t.id+'.'+s+'.'+((t.key+k)%12))));}
export function composeTrack(tune:Tune,style:Style,key:number,seed:number,cfg:Config=defaultConfig):TrackPlan{
 const random=seeded(seed),range=style==='swing'?[124,144]:style==='ballad'?[66,76]:style==='musicbox'?[72,84]:style==='ambient'?[54,68]:[100,124];
 const bpm=Math.round(range[0]+random()*(range[1]-range[0])),beat=60/bpm,events:NoteEvent[]=[];
 const transpose=key-tune.key,bars=tune.melody.length*4;
 const add=(at:number,duration:number,midi:number,instrument:Instrument,gain:number,pan=0)=>{
  events.push({at:Math.max(0,at+(random()-.5)*.004),duration,midi,instrument,gain,pan,noiseSeed:Math.floor(random()*0xffffffff)});
 };
 const progression=[0,5,7,0,0,9,2,7];
 for(let bar=0;bar<bars;bar++){
  const phraseBar=bar%tune.melody.length,phrase=phraseBar===0||phraseBar===tune.melody.length-1;
  const lift=bar>=bars-8?2:0,root=48+tune.key+progression[bar%8]+transpose+lift;
  const chordThird=[4,4,4,4,4,3,3,4][bar%8];
  add(bar*tune.meter*beat,(style==='ambient'?3.4:2.4)*beat,root-12,'bass',cfg.levels.bass*(style==='ambient'?.7:style==='swing'?1.25:1),-.08);
  if(style==='swing')for(const bassBeat of (tune.meter===4?[2]:[1]))add((bar*tune.meter+bassBeat)*beat,.42*beat,root-12+(bassBeat===2?7:0),'bass',cfg.levels.bass*.9,-.08);
  for(const [interval,pan] of [[chordThird,-.2],[7,.12],[12,.22]] as const)
   add(bar*tune.meter*beat,tune.meter*(style==='ambient'?1.8:.88)*beat,root+interval+12,'strings',cfg.levels.strings*(style==='ambient'?.75:style==='swing'?1.35:1),pan);
  if(style==='swing')for(const stabBeat of (tune.meter===4?[1,3]:[2])){
   for(const interval of [chordThird,7,12])add((bar*tune.meter+stabBeat)*beat,.28*beat,root+interval+12,'piano',cfg.levels.melody*.32,interval===chordThird?-.24:interval===7?.12:.28);
  }
  for(const [b,n,len] of tune.melody[phraseBar]){
   const swing=style==='swing'&&b%1===.5?.16:0,at=(bar*tune.meter+b+swing)*beat,pitch=n+transpose+lift;
   const melodicInstrument=style==='musicbox'||style==='ambient'?'celesta':'piano';
   add(at,len*beat,pitch,melodicInstrument,cfg.levels.melody,.02);
   if((phrase&&b===0)||(style==='bellchoir'&&b%2===0)||(bar%4===3&&len>=1))
    add(at+.012,Math.min(.72,len)*beat,pitch+12,'bell',cfg.levels.bells,.25);
   if(style==='bellchoir'&&len>=1.5&&random()>.55)
    add(at+len*.52*beat,.18*beat,pitch+19,'bell',cfg.levels.bells*.35,-.3);
  }
  const hits=style==='swing'?(tune.meter===4?[0,1,2,3]:[0,1,2]):style==='bellchoir'?[0,2]:style==='ballad'&&bar%2===0?[2]:[];
  for(const b of hits)if(b<tune.meter)add((bar*tune.meter+b)*beat,.14,90,'sleigh',cfg.levels.sleigh*(style==='swing'?1.6:1),random()*1.5-.75);
  if(bar%4===3)add((bar*tune.meter+tune.meter-.5)*beat,1.8*beat,root+24,'bell',cfg.levels.bells*.75,0);
 }
 events.sort((a,b)=>a.at-b.at||a.midi-b.midi);
 return{id:tune.id+'.'+style+'.'+key,tune,style,key,seed,bpm,duration:bars*tune.meter*beat,events};
}

/** Build a same-carol mood change. Keep the current tempo so the melody stays rhythmically aligned. */
export function composeMoodTransition(current:TrackPlan,mood:MusicMood,bars=8,cfg:Config=defaultConfig):TrackPlan{
 if(!Number.isInteger(bars)||bars<1||bars>32)throw new Error('transition bars must be an integer from 1 to 32');
 const targetStyle:Style=mood==='calm'?'ambient':'swing';
 const target=composeTrack(current.tune,targetStyle,current.key,(current.seed^0x5f3759df)>>>0,cfg);
 const scale=target.bpm/current.bpm;
 const events=target.events.map(event=>({...event,at:event.at*scale,duration:event.duration*scale}));
 return{
  ...target,
  id:current.tune.id+'.'+mood+'.'+current.key,
  bpm:current.bpm,
  duration:current.duration,
  events,
  transitionSeconds:Math.min(current.duration,bars*current.tune.meter*60/current.bpm)
 };
}
