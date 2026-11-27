// Project the same triangular mesh that is written to the downloadable OBJ.
export function modelViewport(canvas, controls) {
  const ctx = canvas.getContext('2d');
  const initialYaw = -0.57;
  let mesh, span, figure, yaw = initialYaw, elevation = 0.28, zoom = 1, wire = false;
  let drag;

  function paint() {
    if (!ctx || !mesh || !canvas.clientWidth || !canvas.clientHeight) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const ce = Math.cos(elevation), se = Math.sin(elevation);
    const scale = Math.min(w * .70, h * (figure ? .89 : 1.20)) * zoom / span;
    const middle = mesh.height / 2;
    function project([x, y, z]) {
      const side = x * ca + y * sa, front = x * sa - y * ca;
      return [w / 2 + side * scale, h / 2 - ((z-middle)*ce-front*se)*scale, front*ce+(z-middle)*se];
    }
    function line(a, b) {
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(213,181,161,.13)';ctx.lineWidth = .8;
    const step = span / 6, limit = step * 10;
    for (let i=-10;i<=10;i++) {
      line(project([i*step,-limit,0]),project([i*step,limit,0]));
      line(project([-limit,i*step,0]),project([limit,i*step,0]));
    }
    const points = mesh.vertices.map(project);
    const faces = mesh.faces.map(face => {
      const [a,b,c] = face.map(i => points[i]);
      const ab = b.map((v,i) => v-a[i]), ac = c.map((v,i) => v-a[i]);
      // Screen Y points down. Convert projected X/Y to equal depth units for lighting.
      ab[0]/=scale;ab[1]/=-scale;ac[0]/=scale;ac[1]/=-scale;
      const nx=ab[1]*ac[2]-ab[2]*ac[1], ny=ab[2]*ac[0]-ab[0]*ac[2], nz=ab[0]*ac[1]-ab[1]*ac[0];
      const length=Math.hypot(nx,ny,nz)||1;
      const light=Math.max(0,(-nx*.47+ny*.72+nz*.51)/length);
      return {a,b,c, depth:(a[2]+b[2]+c[2])/3, visible:nz>0, light};
    }).filter(f=>f.visible).sort((a,b)=>a.depth-b.depth);
    for (const {a,b,c,light} of faces) {
      const color = 'rgb('+[105+137*light,83+131*light,70+122*light].map(Math.round).join(',')+')';
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();
      ctx.fillStyle=wire?'#342d32':color;ctx.fill();
      ctx.strokeStyle=wire?'#d7b887':color;ctx.lineWidth=wire ? .9 : .65;ctx.stroke();
    }
    canvas.setAttribute('aria-description', 'View angle '+Math.round(yaw*180/Math.PI)+' degrees. Zoom '+Math.round(zoom*100)+' percent.');
  }
  function rotate(dx, dy) {
    yaw+=dx; elevation=Math.max(.08,Math.min(1.45,elevation+dy));paint();
  }
  function magnify(factor) {
    zoom=Math.max(.6,Math.min(1.8,zoom*factor));paint();
    controls.zoomOut.disabled=zoom<=.601;controls.zoomIn.disabled=zoom>=1.799;
  }
  function reset() {
    yaw=initialYaw;elevation=figure ? .28 : .73;zoom=1;magnify(1);
  }
  canvas.addEventListener('pointerdown', e=>{
    if(e.button!==0 || drag) return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e=>{
    if(drag?.id!==e.pointerId)return;
    rotate((e.clientX-drag.x)*.009,(e.clientY-drag.y)*.008);
    drag.x=e.clientX;drag.y=e.clientY;
  });
  canvas.addEventListener('lostpointercapture',()=>{drag=null;});
  canvas.addEventListener('keydown',e=>{
    const arrows={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};
    if(arrows[e.key]){e.preventDefault();rotate(...arrows[e.key]);}
  });
  controls.wire.onclick=()=>{wire=!wire;controls.wire.setAttribute('aria-pressed',String(wire));paint();};
  controls.zoomIn.onclick=()=>magnify(1.2);controls.zoomOut.onclick=()=>magnify(1/1.2);
  controls.resetView.onclick=reset;
  new ResizeObserver(paint).observe(canvas);
  return (geometry,width,isFigure)=>{
    mesh={...geometry,height:Math.max(...geometry.vertices.map(v=>v[2]))};span=width;
    if(isFigure!==figure){figure=isFigure;reset();}else paint();
  };
}
