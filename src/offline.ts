import type {TrackPlan,NoteEvent} from './composer';
import {analyzeAndNormalize,type LoudnessReport} from './mastering';
import {seeded} from './composer';
export type OfflineRenderOptions={sampleRate?:number;targetLufs?:number;maxTruePeakDbfs?:number};
export type OfflineRenderResult={wav:Blob;duration:number;sampleRate:number;report:LoudnessReport};
function scheduleEvent(ctx:OfflineAudioContext,out:AudioNode,event:NoteEvent,when:number){
 const f=440*Math.pow(2,(event.midi-69)/12),gain=ctx.createGain(),pan=ctx.createStereoPanner();
 const partials=event.instrument==='bell'?[1,.25,.1]:event.instrument==='strings'?[1,.3,.08]:event.instrument==='bass'?[1,.18,.05]:[1,.18,.05];
 for(let i=0;i<partials.length;i++){
  const osc=ctx.createOscillator(),part=ctx.createGain();
  osc.type=event.instrument==='strings'?'sawtooth':'sine';
  osc.frequency.value=f*(i===0?1:i===1?2.01:3.98);part.gain.value=partials[i];
  osc.connect(part);part.connect(gain);osc.start(when);osc.stop(when+event.duration+.08);
 }
 if(event.instrument==='sleigh'){
  const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
  const length=Math.ceil(ctx.sampleRate*.2),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0),random=seeded(event.noiseSeed);
  for(let i=0;i<length;i++)data[i]=random()*2-1;
  noise.buffer=buffer;filter.type='highpass';filter.frequency.value=2600;noise.connect(filter);filter.connect(gain);
  noise.start(when);noise.stop(when+.13);
 }
 const attack=event.instrument==='strings'?.25:.012,release=Math.min(.8,event.duration*.25);
 gain.gain.setValueAtTime(.0001,when);gain.gain.linearRampToValueAtTime(event.gain,when+attack);
 gain.gain.setValueAtTime(event.gain,Math.max(when+attack,when+event.duration-release));
 gain.gain.linearRampToValueAtTime(.0001,when+event.duration);
 pan.pan.value=event.pan;gain.connect(pan);pan.connect(out);
}
function encodeWav(channels:Float32Array[],sampleRate:number){
 const channelCount=channels.length,frames=channels[0]?.length??0,bits=16,bytes=44+frames*channelCount*2;
 const data=new ArrayBuffer(bytes),view=new DataView(data);
 const write=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
 write(0,'RIFF');view.setUint32(4,bytes-8,true);write(8,'WAVE');write(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channelCount,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channelCount*2,true);
 view.setUint16(32,channelCount*2,true);view.setUint16(34,bits,true);write(36,'data');view.setUint32(40,bytes-44,true);
 let offset=44;
 for(let i=0;i<frames;i++)for(let ch=0;ch<channelCount;ch++){
  const sample=Math.max(-1,Math.min(1,channels[ch][i]));
  view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;
 }
 return new Blob([data],{type:'audio/wav'});
}
export async function renderTrackOffline(plan:TrackPlan,options:OfflineRenderOptions={}):Promise<OfflineRenderResult>{
 const sampleRate=options.sampleRate??44100,tail=1.5;
 const context=new OfflineAudioContext(2,Math.ceil((plan.duration+tail)*sampleRate),sampleRate);
 const output=context.createGain();output.gain.value=.45;output.connect(context.destination);
 for(const event of plan.events)scheduleEvent(context,output,event,.05+event.at);
 const rendered=await context.startRendering();
 const raw=Array.from({length:rendered.numberOfChannels},(_,ch)=>rendered.getChannelData(ch));
 const normalized=analyzeAndNormalize(raw,sampleRate,options.targetLufs??-22,options.maxTruePeakDbfs??-1);
 return{wav:encodeWav(normalized.channels,sampleRate),duration:rendered.duration,sampleRate,report:normalized.report};
}
