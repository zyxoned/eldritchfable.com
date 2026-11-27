// Three concentric rings give each single-piece token a flat back and beveled rim.
export function tokenGeometry(shape, width, height) {
  if(['warden','seer'].includes(shape)) return figureGeometry(shape,width,height);
  const sides = {hexagon:6, octagon:8, circle:48, star:10}[shape];
  if (!sides || !Number.isFinite(width) || width<30 || width>100 || !Number.isFinite(height) || height<4 || height>15) throw Error('Choose a supported token size.');
  const contour=Array.from({length:sides},(_,i)=>{
    const angle=i*2*Math.PI/sides, r=shape==='star' && i%2 ? 0.62 : 1;
    return [Math.cos(angle)*r,Math.sin(angle)*r];
  });
  const span=axis=>Math.max(...contour.map(v=>v[axis]))-Math.min(...contour.map(v=>v[axis]));
  const factor=width/Math.max(span(0),span(1));
  const vertices=[];
  for(const [scale,z] of [[1,0],[1,height-1],[0.94,height]]) {
    for(const [x,y] of contour) vertices.push([x*factor*scale,y*factor*scale,z]);
  }
  vertices.push([0,0,0],[0,0,height]);
  const faces=[];
  for(let i=0;i<sides;i++) {
    const j=(i+1)%sides;
    faces.push([3*sides,j,i],[3*sides+1,2*sides+i,2*sides+j]);
    for(let ring=0;ring<2;ring++) {
      const a=ring*sides,b=a+sides;
      faces.push([a+i,a+j,b+j],[a+i,b+j,b+i]);
    }
  }
  return {vertices,faces,contour};
}
export function tokenOBJ(shape,width,height) {
  const {vertices,faces}=tokenGeometry(shape,width,height);
  return ['# Eldritch Fable tabletop token. Dimensions in millimeters.','o '+shape,
    ...vertices.map(v=>'v '+v.map(n=>n.toFixed(5)).join(' ')),...faces.map(f=>'f '+f.map(i=>i+1).join(' ')),''].join('\n');
}

// A single closed surface runs from the base through the collar to the crown.
function figureGeometry(shape,height,baseHeight) {
  if(!Number.isFinite(height)||height<30||height>100||!Number.isFinite(baseHeight)||baseHeight<4||baseHeight>15) throw Error('Choose a supported figure size.');
  const base=Math.min(baseHeight/height,0.22), n=shape==='seer'?12:16;
  const profile=shape==='seer'?[[0,.22],[base,.22],[base+.025,.18],[.48,.135],[.62,.11],[.68,.18],[.74,.13],[.78,.075],[.82,.11],[.90,.105],[1,.025]]:
    [[0,.23],[base,.23],[base+.025,.18],[.38,.12],[.47,.135],[.62,.19],[.68,.205],[.71,.13],[.75,.075],[.79,.12],[.88,.13],[.96,.11],[1,.065]];
  const vertices=[],faces=[];
  for(const [z,r] of profile) for(let i=0;i<n;i++){
    const a=2*Math.PI*i/n;vertices.push([height*r*Math.cos(a),height*r*Math.sin(a),height*z]);
  }
  const top=(profile.length-1)*n, bottomCenter=vertices.push([0,0,0])-1,topCenter=vertices.push([0,0,height])-1;
  for(let i=0;i<n;i++){
    const j=(i+1)%n;faces.push([bottomCenter,j,i],[topCenter,top+i,top+j]);
    for(let k=0;k<profile.length-1;k++){const a=k*n,b=a+n;faces.push([a+i,a+j,b+j],[a+i,b+j,b+i]);}
  }
  const contour=[...profile.map(([z,r])=>[r*2,z*2-1]),...profile.toReversed().map(([z,r])=>[-r*2,z*2-1])];
  return {vertices,faces,contour};
}
