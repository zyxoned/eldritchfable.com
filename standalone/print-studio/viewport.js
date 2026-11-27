// Average adjacent surface normals for the sculpted presets. Keep sharp profile edges on pawns and tokens.
function surfaceNormals(vertices,faces){
  if(faces.length<800)return null;
  const sums=vertices.map(()=>[0,0,0]);
  for(const face of faces){
    const [a,b,c]=face.map(i=>vertices[i]);
    const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],u=c[0]-a[0],v=c[1]-a[1],w=c[2]-a[2];
    const nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u;
    for(const i of face){sums[i][0]+=nx;sums[i][1]+=ny;sums[i][2]+=nz;}
  }
  return sums.map(n=>{const len=Math.hypot(...n)||1;return n.map(x=>x/len);});
}

// The renderer and the OBJ exporter consume the same indexed triangle mesh.
export function modelViewport(canvas, controls, editor) {
  const ctx=canvas.getContext('2d');
  let mesh,span=40,upright,yaw=-.57,elevation=.28,zoom=1;
  let editing=false,wire=false,drag,projection,frame,selected=-1,brushFrame=0,pendingStroke;

  function paint() {
    frame=0;
    if(!ctx || !canvas.clientWidth || !canvas.clientHeight)return;
    const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    if(!mesh){projection=null;return;}
    const ca=Math.cos(yaw),sa=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);
    const scale=Math.min(width*.74,height*(upright ? .88 : 1.1))*zoom/span;
    function project([x,y,z]) {
      const side=x*ca+y*sa,front=x*sa-y*ca,up=z-mesh.height/2;
      return [width/2+side*scale,height/2-(up*ce-front*se)*scale,front*ce+up*se];
    }
    const points=mesh.vertices.map(project), visible=[];
    const vertexLight=mesh.normals?.map(([x,y,z])=>{
      const front=x*sa-y*ca;
      return Math.max(0,-.47*(x*ca+y*sa)+.72*(z*ce-front*se)+.51*(front*ce+z*se));
    });
    ctx.beginPath();
    const step=span/6,limit=step*10;
    function grid(a,b){ctx.moveTo(...a.slice(0,2));ctx.lineTo(...b.slice(0,2));}
    for(let i=-10;i<=10;i++){
      grid(project([i*step,-limit,0]),project([i*step,limit,0]));
      grid(project([-limit,i*step,0]),project([limit,i*step,0]));
    }
    ctx.strokeStyle='rgba(213,181,161,.13)';ctx.lineWidth=.8;ctx.stroke();
    for(const face of mesh.faces){
      const a=points[face[0]],b=points[face[1]],c=points[face[2]];
      const ax=(b[0]-a[0])/scale,ay=(a[1]-b[1])/scale,az=b[2]-a[2];
      const bx=(c[0]-a[0])/scale,by=(a[1]-c[1])/scale,bz=c[2]-a[2];
      const nz=ax*by-ay*bx;
      if(nz<=0)continue;
      const nx=ay*bz-az*by,ny=az*bx-ax*bz;
      let light=Math.max(0,(-nx*.47+ny*.72+nz*.51)/Math.hypot(nx,ny,nz));
      if(vertexLight)light=.25*light+.25*(vertexLight[face[0]]+vertexLight[face[1]]+vertexLight[face[2]]);
      visible.push({face,a,b,c,depth:a[2]+b[2]+c[2],light});
    }
    visible.sort((a,b)=>a.depth-b.depth);
    for(const {a,b,c,light} of visible){
      const color='rgb('+Math.round(85+157*light)+','+Math.round(70+149*light)+','+Math.round(63+133*light)+')';
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();
      ctx.fillStyle=wire?'#342d32':color;ctx.fill();ctx.strokeStyle=wire?'#d7b887':color;ctx.lineWidth=wire ? .72 : .62;ctx.stroke();
    }
    if(editing && selected>=0 && points[selected]){
      const [x,y]=points[selected];
      ctx.beginPath();ctx.arc(x,y,editor.radius()*span*scale,0,2*Math.PI);ctx.strokeStyle='rgba(255,209,127,.65)';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,7,0,2*Math.PI);ctx.fillStyle='#ffd07d';ctx.fill();
      ctx.strokeStyle='#392612';ctx.lineWidth=2;ctx.stroke();
    }
    projection={points,visible,ca,sa,ce,se,scale};
    canvas.setAttribute('aria-description','View angle '+Math.round(yaw*180/Math.PI)+' degrees. Zoom '+Math.round(zoom*100)+' percent.');
  }
  function repaint(){if(!frame)frame=requestAnimationFrame(paint);}
  function rotate(dx,dy){yaw+=dx;elevation=Math.max(.08,Math.min(1.45,elevation+dy));repaint();}
  function magnify(factor){
    zoom=Math.max(.6,Math.min(1.8,zoom*factor));repaint();
    controls.zoomOut.disabled=zoom<=.601;controls.zoomIn.disabled=zoom>=1.799;
  }
  function reset(){yaw=-.57;elevation=upright ? .25 : .64;zoom=1;magnify(1);}
  function setWire(value){wire=value;controls.wire.setAttribute('aria-pressed',String(wire));repaint();}
  function pick(x,y) {
    if(!projection)return -1;
    const edge=(a,b)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
    for(let i=projection.visible.length-1;i>=0;i--){
      const {face,a,b,c}=projection.visible[i];
      if(edge(a,b)>.01 || edge(b,c)>.01 || edge(c,a)>.01)continue;
      let best=-1,distance=Infinity;
      for(const index of face){
        if(mesh.vertices[index][2]<.005*span)continue;
        const v=projection.points[index],d=Math.hypot(x-v[0],y-v[1]);
        if(d<distance){best=index;distance=d;}
      }
      return best;
    }
    return -1;
  }
  function stroke(dx,dy,index,radius){
    const {ca,sa,ce,se,scale}=projection;
    const factor=1/(scale*span);
    const size=Math.hypot(dx,dy)*factor;
    const amount=Math.min(1,.3*radius/(size||1))*factor;
    return {index,radius,offset:[(ca*dx+sa*se*dy)*amount,(sa*dx-ca*se*dy)*amount,-dy*ce*amount]};
  }
  function finish(e,cancel=false){
    if(drag?.id!==e.pointerId)return;
    if(editing){
      cancelAnimationFrame(brushFrame);brushFrame=0;pendingStroke=null;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(cancel||Math.hypot(dx,dy)<2)editor.preview(null);
      else editor.commit(stroke(dx,dy,selected,drag.radius));
    }
    drag=null;
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0 || drag || !mesh || !projection)return;
    if(editing){
      const box=canvas.getBoundingClientRect();
      selected=pick(e.clientX-box.left,e.clientY-box.top);repaint();
      if(selected<0){editor.note('Touch a point on the model above the base.');return;}
      editor.note('Point selected. Drag it or use the arrow keys.');
    }
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,radius:editor.radius()};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(editing){
      pendingStroke=stroke(dx,dy,selected,drag.radius);
      if(!brushFrame)brushFrame=requestAnimationFrame(()=>{brushFrame=0;editor.preview(pendingStroke);});
      return;
    }
    rotate(dx*.009,dy*.008);drag.x=e.clientX;drag.y=e.clientY;
  });
  canvas.addEventListener('pointerup',e=>finish(e));
  canvas.addEventListener('lostpointercapture',e=>finish(e,true));
  canvas.addEventListener('pointercancel',e=>finish(e,true));
  canvas.addEventListener('keydown',e=>{
    const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(!arrows[e.key]||!mesh||!projection)return;
    e.preventDefault();const [x,y]=arrows[e.key];
    if(!editing){rotate(x*.16,-y*.12);return;}
    if(selected<0){
      selected=pick(canvas.clientWidth/2,canvas.clientHeight/2);
      if(selected<0){
        const surface=projection.visible.findLast(({face})=>face.some(i=>mesh.vertices[i][2]>.05*span));
        if(surface)selected=surface.face.find(i=>mesh.vertices[i][2]>.05*span);
      }
    }
    if(selected>=0)editor.commit(stroke(x*6,y*6,selected,editor.radius()));
  });
  controls.edit.onclick=()=>{
    editing=!editing;setWire(editing||wire);
    controls.edit.setAttribute('aria-pressed',String(editing));
    controls.brush.hidden=!editing;controls.hint.textContent=editing?'Drag a mesh point to reshape it. Arrow keys nudge the selected point.':'Drag to rotate · Arrow keys also rotate';
    editor.note('');repaint();
  };
  controls.wire.onclick=()=>setWire(!wire);controls.zoomIn.onclick=()=>magnify(1.2);
  controls.zoomOut.onclick=()=>magnify(1/1.2);controls.resetView.onclick=reset;
  new ResizeObserver(repaint).observe(canvas);
  let currentShape;
  return (geometry,width,isUpright,shape)=>{
    if(shape!==currentShape){selected=-1;drag=null;currentShape=shape;}
    mesh=geometry?{...geometry,normals:surfaceNormals(geometry.vertices,geometry.faces),height:Math.max(...geometry.vertices.map(v=>v[2]))}:null;
    span=width;if(upright!==isUpright){upright=isUpright;reset();}else repaint();
  };
}
