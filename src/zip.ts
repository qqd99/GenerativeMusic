export type ZipEntry={name:string;data:Uint8Array};
function crc32(bytes:Uint8Array){
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return(crc^0xffffffff)>>>0;
}
export function zipStore(files:readonly ZipEntry[]):Blob{
 if(files.length>65535)throw new Error('ZIP supports at most 65,535 entries');
 const encoder=new TextEncoder(),locals:BlobPart[]=[],centrals:BlobPart[]=[];
 let localOffset=0;
 for(const file of files){
  const name=encoder.encode(file.name),data=new Uint8Array(file.data),crc=crc32(data);
  if(name.length>65535||data.length>0xffffffff||localOffset>0xffffffff)throw new Error('ZIP64 is not supported for very large audition archives');
  const local=new ArrayBuffer(30),lv=new DataView(local);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);
  lv.setUint16(10,0,true);lv.setUint16(12,0x0021,true);lv.setUint32(14,crc,true);
  lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);
  locals.push(local,name,data.buffer as ArrayBuffer);
  const central=new ArrayBuffer(46),cv=new DataView(central);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);
  cv.setUint16(12,0,true);cv.setUint16(14,0x0021,true);cv.setUint32(16,crc,true);
  cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);
  cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);
  cv.setUint32(38,0,true);cv.setUint32(42,localOffset,true);
  centrals.push(central,name);
  localOffset+=30+name.length+data.length;
 }
 const centralSize=centrals.reduce((sum,part)=>sum+(part instanceof ArrayBuffer?part.byteLength:part instanceof Uint8Array?part.byteLength:0),0);
 if(centralSize>0xffffffff||localOffset>0xffffffff)throw new Error('ZIP64 is not supported for very large audition archives');
 const end=new ArrayBuffer(22),ev=new DataView(end);
 ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
 ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
 ev.setUint32(12,centralSize,true);ev.setUint32(16,localOffset,true);ev.setUint16(20,0,true);
 return new Blob([...locals,...centrals,end],{type:'application/zip'});
}
