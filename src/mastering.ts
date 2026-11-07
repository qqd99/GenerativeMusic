export type LoudnessReport={integratedLufs:number;truePeakDbfs:number;normalizationGainDb:number;normalizedLufs:number;normalizedTruePeakDbfs:number};
type Coeff={b0:number;b1:number;b2:number;a1:number;a2:number};
function highPass(fs:number):Coeff{
 const w=2*Math.PI*38.13547087602444/fs,c=Math.cos(w),s=Math.sin(w),alpha=s/(2*.5003270373238773),a0=1+alpha;
 return{b0:(1+c)/(2*a0),b1:-(1+c)/a0,b2:(1+c)/(2*a0),a1:-2*c/a0,a2:(1-alpha)/a0};
}
function highShelf(fs:number):Coeff{
 const f=1681.974450955533,db=3.999843853973347,A=Math.pow(10,db/40),w=2*Math.PI*f/fs,c=Math.cos(w),s=Math.sin(w),alpha=s/2*Math.sqrt(2),beta=2*Math.sqrt(A)*alpha;
 const b0=A*((A+1)+(A-1)*c+beta),b1=-2*A*((A-1)+(A+1)*c),b2=A*((A+1)+(A-1)*c-beta);
 const a0=(A+1)-(A-1)*c+beta,a1=2*((A-1)-(A+1)*c),a2=(A+1)-(A-1)*c-beta;
 return{b0:b0/a0,b1:b1/a0,b2:b2/a0,a1:a1/a0,a2:a2/a0};
}
function filter(input:ArrayLike<number>,c:Coeff){
 const out=new Float64Array(input.length);let x1=0,x2=0,y1=0,y2=0;
 for(let i=0;i<input.length;i++){const x=input[i],y=c.b0*x+c.b1*x1+c.b2*x2-c.a1*y1-c.a2*y2;out[i]=y;x2=x1;x1=x;y2=y1;y1=y;}
 return out;
}
export function integratedLufs(channels:readonly Float32Array[],sampleRate:number):number{
 if(!channels.length||!channels[0]?.length)return -Infinity;
 const hp=highPass(sampleRate),hs=highShelf(sampleRate),weighted=channels.map(ch=>filter(filter(ch,hp),hs));
 const block=Math.max(1,Math.round(sampleRate*.4)),step=Math.max(1,Math.round(sampleRate*.1)),count=weighted[0].length;
 const energies:number[]=[];
 for(let start=0;start+block<=count;start+=step){
  let energy=0;
  for(const ch of weighted){let sum=0;for(let i=start;i<start+block;i++)sum+=ch[i]*ch[i];energy+=sum/block;}
  const lufs=-.691+10*Math.log10(Math.max(1e-15,energy));
  if(lufs>=-70)energies.push(energy);
 }
 if(!energies.length)return -Infinity;
 const ungated=energies.reduce((a,b)=>a+b,0)/energies.length;
 const relativeGate=ungated*Math.pow(10,-10/10);
 const gated=energies.filter(e=>e>=relativeGate);
 if(!gated.length)return -Infinity;
 const mean=gated.reduce((a,b)=>a+b,0)/gated.length;
 return -.691+10*Math.log10(Math.max(1e-15,mean));
}
export function truePeakDbfs(channels:readonly Float32Array[]):number{
 let peak=0;
 for(const data of channels){
  for(let i=0;i<data.length;i++){
   const x0=data[Math.max(0,i-1)],x1=data[i],x2=data[Math.min(data.length-1,i+1)],x3=data[Math.min(data.length-1,i+2)];
   peak=Math.max(peak,Math.abs(x1));
   for(const t of [.25,.5,.75]){
    const t2=t*t,t3=t2*t;
    const y=.5*((2*x1)+(-x0+x2)*t+(2*x0-5*x1+4*x2-x3)*t2+(-x0+3*x1-3*x2+x3)*t3);
    peak=Math.max(peak,Math.abs(y));
   }
  }
 }
 return 20*Math.log10(Math.max(1e-12,peak));
}
export function normalizationGainDb(channels:readonly Float32Array[],sampleRate:number,targetLufs=-22,maxTruePeakDbfs=-1){
 const lufs=integratedLufs(channels,sampleRate),peak=truePeakDbfs(channels);
 if(!Number.isFinite(lufs)||!Number.isFinite(peak))return 0;
 return Math.min(targetLufs-lufs,maxTruePeakDbfs-peak);
}
export function applyGainDb(channels:readonly Float32Array[],gainDb:number):Float32Array[]{
 const gain=Math.pow(10,gainDb/20);
 return channels.map(ch=>{const out=new Float32Array(ch.length);for(let i=0;i<ch.length;i++)out[i]=ch[i]*gain;return out;});
}
export function analyzeAndNormalize(channels:readonly Float32Array[],sampleRate:number,targetLufs=-22,maxTruePeakDbfs=-1):{channels:Float32Array[];report:LoudnessReport}{
 const integrated=integratedLufs(channels,sampleRate),peak=truePeakDbfs(channels);
 const gain=normalizationGainDb(channels,sampleRate,targetLufs,maxTruePeakDbfs);
 const normalized=applyGainDb(channels,gain);
 return{channels:normalized,report:{integratedLufs:integrated,truePeakDbfs:peak,normalizationGainDb:gain,normalizedLufs:integrated+gain,normalizedTruePeakDbfs:peak+gain}};
}

export function estimateTrackGainDb(plan:{duration:number;events:readonly {at:number;duration:number;midi:number;instrument:string;gain:number}[]},targetLufs=-22,maxTruePeakDbfs=-1):number{
 let energy=0;const changes:{at:number;delta:number}[]=[];
 for(const event of plan.events){
  const squares=event.instrument==='sleigh'?1.24:1.035;
  const absolute=event.instrument==='sleigh'?1.6:1.38;
  energy+=event.gain*event.gain*squares*.5*event.duration;
  const bound=event.gain*absolute;
  changes.push({at:event.at,delta:bound},{at:event.at+event.duration,delta:-bound});
 }
 const meanPower=energy/Math.max(.001,plan.duration);
 const estimatedLufs=-.691+10*Math.log10(Math.max(1e-15,meanPower))+1.2;
 changes.sort((a,b)=>a.at-b.at||a.delta-b.delta);
 let current=0,peak=0;
 for(const change of changes){current+=change.delta;peak=Math.max(peak,current);}
 const peakDb=20*Math.log10(Math.max(1e-12,peak));
 const lufsGain=targetLufs-estimatedLufs,peakGain=maxTruePeakDbfs-peakDb;
 return Math.min(9,lufsGain,peakGain);
}
