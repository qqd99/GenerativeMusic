import {describe,it,expect} from 'vitest';
import {composeTrack,defaultConfig,validateConfig,virtualTrackIds} from '../src/composer';
import {tunes} from '../src/catalog';
import {RotationScheduler} from '../src/scheduler';
import type {Clock,Config,TrackPlan} from '../src/composer';
import {integratedLufs,truePeakDbfs,normalizationGainDb,applyGainDb,estimateTrackGainDb} from '../src/mastering';
import {zipStore} from '../src/zip.js';

class FakeClock implements Clock {
 time:number;private serial=0;private tasks=new Map<number,{at:number;fn:()=>void}>();
 constructor(start:number){this.time=start;}
 now(){return this.time;}
 setTimeout(fn:()=>void,ms:number){const id=++this.serial;this.tasks.set(id,{at:this.time+Math.max(0,ms),fn});return id;}
 clearTimeout(id:unknown){this.tasks.delete(id as number);}
 advance(ms:number){
  const target=this.time+ms;let count=0;
  while(true){
   let selected:number|undefined,task:{at:number;fn:()=>void}|undefined;
   for(const [id,candidate] of this.tasks)if(candidate.at<=target&&(!task||candidate.at<task.at||(candidate.at===task.at&&id<(selected??Infinity)))){selected=id;task=candidate;}
   if(!task||selected===undefined)break;
   this.tasks.delete(selected);this.time=task.at;task.fn();
   if(++count>20000)throw new Error('Fake clock runaway');
  }
  this.time=target;
 }
 get pending(){return this.tasks.size;}
}
const cfg=(seed=123):Config=>({...defaultConfig,seed,timezone:'UTC',quietHours:{start:22,end:6}});
function run72(seed:number){
 const clock=new FakeClock(Date.UTC(2026,11,20,12)),played:string[]=[];
 const scheduler=new RotationScheduler({catalog:tunes,config:cfg(seed),clock,onTrack:p=>played.push(p.id)});
 scheduler.start();clock.advance(72*60*60*1000);
 return {played,clock,scheduler};
}
describe('Generative Music composer and scheduler',()=>{
 it('contains twelve distinct carols with score provenance records',()=>{
  expect(tunes).toHaveLength(12);
  expect(new Set(tunes.map(t=>t.id)).size).toBe(12);
  for(const tune of tunes){expect(tune.source.startsWith('https://')).toBe(true);expect(tune.sourceNote.length).toBeGreaterThan(20);}
 });
 it('creates 300 distinct tune/style/key combinations',()=>{
  const ids=virtualTrackIds(tunes);expect(ids).toHaveLength(300);expect(new Set(ids).size).toBe(300);
 });
 it('is deterministic for the same tune, configuration and seed',()=>{
  const a=composeTrack(tunes[0],'swing',0,123,defaultConfig);
  const b=composeTrack(tunes[0],'swing',0,123,defaultConfig);
  expect(a).toEqual(b);
 });
 it('bounds generated note events to a finite musical plan',()=>{
  const p=composeTrack(tunes[1],'musicbox',5,7,defaultConfig);
  expect(p.events.length).toBeGreaterThan(100);
  expect(p.events.every(e=>Number.isFinite(e.at)&&e.at>=0&&e.duration>0&&e.midi>=0&&e.midi<=127)).toBe(true);
  expect(Math.max(...p.events.map(e=>e.at))).toBeLessThan(p.duration);
 });
 it('rejects unsafe scheduler and audio configuration values',()=>{
  expect(()=>validateConfig({lookAheadSec:10})).toThrow();
  expect(()=>validateConfig({maxVoices:1000})).toThrow();
  expect(()=>validateConfig({tickMs:0})).toThrow();
 });
 it('simulates 72 hours without repeating any track inside the 40-track window',()=>{
  const {played,scheduler}=run72(99);
  expect(played.length).toBeGreaterThan(500);
  for(let i=0;i+40<=played.length;i++)expect(new Set(played.slice(i,i+40)).size).toBe(40);
  expect(new Set(scheduler.recentTrackIds).size).toBe(scheduler.recentTrackIds.length);
 });
 it('reproduces the same 72-hour event sequence for the same seed',()=>{
  expect(run72(2026).played).toEqual(run72(2026).played);
 });
 it('restricts quiet-hour selections to quiet styles',()=>{
  const clock=new FakeClock(Date.UTC(2026,11,20,23)),styles:string[]=[];
  const scheduler=new RotationScheduler({catalog:tunes,config:cfg(),clock,onTrack:p=>styles.push(p.style)});
  scheduler.start();clock.advance(60*60*1000);
  expect(styles.length).toBeGreaterThan(5);
  expect(styles.every(s=>s==='ballad'||s==='musicbox'||s==='ambient')).toBe(true);
 });
 it('cancels pending rotation work on stop',()=>{
  const clock=new FakeClock(Date.UTC(2026,11,20,12)),played:TrackPlan[]=[];
  const scheduler=new RotationScheduler({catalog:tunes,config:cfg(),clock,onTrack:p=>played.push(p)});
  scheduler.start();const count=played.length;scheduler.stop();clock.advance(72*60*60*1000);
  expect(played).toHaveLength(count);expect(clock.pending).toBe(0);
 });
 it('plays dedication first, then resumes normal repertoire rotation',()=>{
  const clock=new FakeClock(Date.UTC(2026,11,20,12)),played:TrackPlan[]=[];
  const scheduler=new RotationScheduler({catalog:tunes,config:cfg(),clock,onTrack:p=>played.push(p)});
  const lullaby=composeTrack(tunes.find(t=>t.id==='silent-night')!,'musicbox',5,77,defaultConfig);
  scheduler.dedication(lullaby);expect(played[0].id).toBe(lullaby.id);
  clock.advance((lullaby.duration+1)*1000);
  expect(played.length).toBeGreaterThan(1);expect(played[1].tune.id).not.toBe('silent-night');
  scheduler.stop();
 });
});

describe('offline loudness and true-peak tools',()=>{
 it('measures a finite K-weighted integrated loudness for a steady tone',()=>{
  const fs=48000,data=new Float32Array(fs*2);
  for(let i=0;i<data.length;i++)data[i]=.1*Math.sin(2*Math.PI*1000*i/fs);
  expect(Number.isFinite(integratedLufs([data,data],fs))).toBe(true);
 });
 it('estimates true peak and respects the configured ceiling',()=>{
  const data=new Float32Array(48000);
  for(let i=0;i<data.length;i++)data[i]=.7*Math.sin(2*Math.PI*997*i/48000);
  const gain=normalizationGainDb([data,data],48000,-22,-1);
  const normalized=applyGainDb([data,data],gain);
  expect(truePeakDbfs(normalized)).toBeLessThanOrEqual(-.9);
 });
});

it('estimates a bounded live music gain before the app master bus',()=>{
 const plan=composeTrack(tunes[0],'ballad',0,77,defaultConfig);
 const gain=estimateTrackGainDb(plan,-22,-1);
 expect(Number.isFinite(gain)).toBe(true);
 expect(gain).toBeLessThanOrEqual(9);
});

it('makes repeated start and stop calls safe',()=>{
 const clock=new FakeClock(Date.UTC(2026,11,20,12)),played:TrackPlan[]=[];
 const scheduler=new RotationScheduler({catalog:tunes,config:cfg(),clock,onTrack:p=>played.push(p)});
 scheduler.start();scheduler.start();expect(played).toHaveLength(1);expect(clock.pending).toBe(1);
 scheduler.stop();scheduler.stop();expect(clock.pending).toBe(0);
});

it('creates a valid uncompressed ZIP for the audition WAV pack',async()=>{
 const payload=new TextEncoder().encode('abc'),archive=zipStore([{name:'sample.wav',data:payload}]);
 const bytes=new Uint8Array(await archive.arrayBuffer()),view=new DataView(bytes.buffer);
 expect(archive.type).toBe('application/zip');
 expect(view.getUint32(0,true)).toBe(0x04034b50);
 expect(view.getUint32(14,true)).toBe(0x352441c2);
 expect(view.getUint32(bytes.length-22,true)).toBe(0x06054b50);
 expect(view.getUint16(bytes.length-12,true)).toBe(1);
});
