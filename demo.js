
import {GenerativeMusic,tunes,composeTrack,defaultConfig,renderTrackOffline} from './dist/index.js';
const $=id=>document.getElementById(id),status=$('status'),renderStatus=$('render-status');
let context=null,master=null,player=null;
const styles=['Festive swing','Gentle ballad','Music box lullaby','Winter bell choir'];
for(const tune of tunes){const option=document.createElement('option');option.value=tune.id;option.textContent=tune.title;$('tune').append(option);
 const card=document.createElement('div');card.className='song';
 const name=document.createElement('strong');name.textContent=tune.title;
 const small=document.createElement('small');small.textContent=tune.sourceNote;
 const link=document.createElement('a');link.href=tune.source;link.target='_blank';link.rel='noreferrer';link.textContent='Open score source';
 card.append(name,small,document.createElement('br'),link);$('catalog').append(card);
}
function selectedPlan(){const tune=tunes.find(t=>t.id===$('tune').value),style=$('style').value,offset=Number($('key').value),seed=Number($('seed').value);
 if(!tune)throw new Error('Select a carol');if(!Number.isInteger(seed))throw new Error('Seed must be a whole number');
 return composeTrack(tune,style,(tune.key+offset)%12,seed,defaultConfig);
}
function ensurePlayer(){
 if(!context){context=new AudioContext();master=context.createGain();master.gain.value=Number($('volume').value);master.connect(context.destination);
  player=new GenerativeMusic({context,output:master,config:defaultConfig,onTrack:p=>{status.textContent='Playing '+p.title+' · '+p.style+' · '+p.bpm+' BPM · '+p.key+' key';},onStatus:m=>{status.textContent=m;}});
 }
 return player;
}
$('start').onclick=async()=>{try{const p=ensurePlayer();if(context.state==='suspended')await context.resume();p.start();}catch(e){status.textContent='Unable to start: '+e.message;}};
$('dedication').onclick=async()=>{try{const p=ensurePlayer();if(context.state==='suspended')await context.resume();p.dedication();}catch(e){status.textContent='Unable to play dedication: '+e.message;}};
$('stop').onclick=()=>{player?.stop();status.textContent='Stopped.';};
$('volume').oninput=()=>{if(master&&context)master.gain.setTargetAtTime(Number($('volume').value),context.currentTime,.025);};
$('play-selected').onclick=async()=>{try{const p=ensurePlayer();if(context.state==='suspended')await context.resume();p.audition(selectedPlan());}catch(e){renderStatus.textContent='Unable to audition: '+e.message;}};
$('render').onclick=async()=>{
 let plan;try{plan=selectedPlan();}catch(e){renderStatus.textContent=e.message;return;}
 const button=$('render');button.disabled=true;renderStatus.textContent='Rendering with OfflineAudioContext. Longer tracks may take a little time…';
 try{
  const result=await renderTrackOffline(plan,{sampleRate:44100,targetLufs:defaultConfig.targetLufs,maxTruePeakDbfs:defaultConfig.maxTruePeakDbfs});
  const url=URL.createObjectURL(result.wav),a=document.createElement('a');a.href=url;a.download=plan.id+'-seed-'+plan.seed+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  const m=result.report;renderStatus.textContent='WAV ready · '+result.duration.toFixed(1)+' s · estimated loudness '+m.normalizedLufs.toFixed(1)+' LUFS · estimated true peak '+m.normalizedTruePeakDbfs.toFixed(1)+' dBTP · gain '+m.normalizationGainDb.toFixed(1)+' dB.';
 }catch(e){renderStatus.textContent='WAV render failed: '+e.message;}finally{button.disabled=false;}
};

function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zipStore(files){
 const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
 for(const file of files){
  const name=encoder.encode(file.name),data=file.data,crc=crc32(data);
  const local=new ArrayBuffer(30),lv=new DataView(local);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);lv.setUint16(8,0,true);
  lv.setUint16(10,0,true);lv.setUint16(12,0x0021,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);
  locals.push(local,name,data);
  const central=new ArrayBuffer(46),cv=new DataView(central);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);
  cv.setUint16(12,0,true);cv.setUint16(14,0x0021,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
  cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);
  centrals.push(central,name);offset+=30+name.length+data.length;
 }
 const centralSize=centrals.reduce((n,x)=>n+x.byteLength,0),end=new ArrayBuffer(22),ev=new DataView(end);
 ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);
 return new Blob([...locals,...centrals,end],{type:'application/zip'});
}
function slug(value){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
$('render-all').onclick=async()=>{
 const button=$('render-all'),files=[],seed=Number($('seed').value);
 if(!Number.isInteger(seed)){renderStatus.textContent='Seed must be a whole number';return;}
 button.disabled=true;
 try{
  for(let i=0;i<tunes.length;i++){
   const tune=tunes[i],plan=composeTrack(tune,'ambient',tune.key,seed+i,defaultConfig);
   const previewBars=Math.min(8,tune.melody.length),previewDuration=previewBars*tune.meter*60/plan.bpm;
   const preview={...plan,duration:previewDuration,events:plan.events.filter(e=>e.at<previewDuration)};
   renderStatus.textContent='Rendering audition '+(i+1)+' / '+tunes.length+': '+tune.title;
   const rendered=await renderTrackOffline(preview,{sampleRate:44100,targetLufs:defaultConfig.targetLufs,maxTruePeakDbfs:defaultConfig.maxTruePeakDbfs});
   files.push({name:String(i+1).padStart(2,'0')+'-'+slug(tune.title)+'-ambient.wav',data:new Uint8Array(await rendered.wav.arrayBuffer())});
  }
  const archive=zipStore(files),url=URL.createObjectURL(archive),a=document.createElement('a');
  a.href=url;a.download='generativemusic-12-auditions.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  renderStatus.textContent='Created '+files.length+' original procedural WAV auditions in a ZIP archive ('+(archive.size/1048576).toFixed(1)+' MB). Each preview uses ambient arrangement and the original key.';
 }catch(e){renderStatus.textContent='Audition pack failed: '+e.message;}finally{button.disabled=false;}
};

function updateSource(){const tune=tunes.find(t=>t.id===$('tune').value);$('source-note').replaceChildren();const text=document.createTextNode(tune.sourceNote+' '),link=document.createElement('a');link.href=tune.source;link.target='_blank';link.rel='noreferrer';link.textContent='View score source';$('source-note').append(text,link);}
$('tune').onchange=updateSource;updateSource();
window.addEventListener('pagehide',()=>player?.dispose());
