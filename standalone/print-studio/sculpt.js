// Prebuilt surfaces are in longest-dimension units. The base stays on the print bed.
export const sculptPresets = ['oathkeeper','briar-scout','foliage','fir','elder','cottage','watchtower'];

export function decodePreset(buffer) {
  const data=new DataView(buffer);
  if(data.getUint32(0)!==0x45464d31) throw Error('Unknown model format.');
  const nv=data.getUint16(4,true), nf=data.getUint16(6,true);
  if(!nv || !nf || buffer.byteLength!==12+12*nv+6*nf) throw Error('Incomplete model.');
  let offset=12;
  const vertices=Array.from({length:nv},()=>Array.from({length:3},()=>{
    const x=data.getInt32(offset,true)/1e6; offset+=4; return x;
  }));
  const faces=Array.from({length:nf},()=>Array.from({length:3},()=>{
    const i=data.getUint16(offset,true); offset+=2; return i;
  }));
  return {vertices,faces,base:data.getFloat32(8,true),height:Math.max(...vertices.map(v=>v[2]))};
}

export function sizePreset(model, length, baseHeight) {
  const total=length*model.height, base=Math.min(baseHeight,total-.01);
  return {faces:model.faces,vertices:model.vertices.map(([x,y,z])=>[
    x*length,y*length,z<=model.base ? z/model.base*base :
      base+(total-base)*(z-model.base)/(model.height-model.base)
  ])};
}

export function sculptedMesh(source, strokes, size) {
  if(!strokes.length)return source;
  let vertices=source.vertices;
  for(const {index,radius,offset} of strokes){
    const center=vertices[index], spread=size*radius;
    vertices=vertices.map(v=>{
      const distance=Math.hypot(v[0]-center[0],v[1]-center[1],v[2]-center[2])/spread;
      if(distance>=1)return v;
      const fade=(1-distance)**2*(1+2*distance)*size;
      // Fade the brush to zero at the bed to preserve the bottom and bed contact.
      const bed=Math.min(1,v[2]/(spread*.65));
      return [v[0]+offset[0]*fade*bed,v[1]+offset[1]*fade*bed,v[2]+offset[2]*fade*bed];
    });
  }
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const v of vertices)for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}
  const scale=size/Math.max(...max.map((n,i)=>n-min[i]));
  return {faces:source.faces,vertices:vertices.map(v=>[v[0]*scale,v[1]*scale,(v[2]-min[2])*scale])};
}
