import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodePreset,sculptPresets,sculptedMesh,sizePreset} from '../print-studio/sculpt.js';
import {geometryOBJ} from '../print-studio/token.js';

for(const name of sculptPresets)test(name+' exports a single closed, oriented body before and after a mesh edit',async()=>{
  const bytes=await readFile(new URL('../print-studio/models/'+name+'.mesh',import.meta.url));
  const raw=decodePreset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  for(const [length,base] of [[40,6],[30,15],[100,4]]){
    const mesh=sizePreset(raw,length,base);
    const highest=Math.max(...mesh.vertices.map(p=>p[2]));
    const middle=mesh.vertices.findIndex(v=>v[2]>.4*highest);
    const edited=sculptedMesh(mesh,[{index:middle,radius:.28,offset:[.05,-.023,.015]}],length);
    assert.notDeepEqual(edited.vertices,mesh.vertices);
    for(const target of [mesh,edited]){
      const obj=geometryOBJ(name,target);
      const v=obj.split('\n').filter(line=>line.startsWith('v ')).map(line=>line.slice(2).split(' ').map(Number));
      assert.equal(new Set(v.map(p=>p.join(','))).size,v.length);
      const mins=[0,1,2].map(i=>Math.min(...v.map(p=>p[i])));
      const spans=mins.map((m,i)=>Math.max(...v.map(p=>p[i]))-m);
      assert.equal(mins[2],0);assert.ok(Math.abs(Math.max(...spans)-length)<.0001);
      const edges=new Map(),adj=v.map(()=>new Set());let volume=0;
      for(const [i,j,k] of target.faces){
        const a=v[i], b=v[j], c=v[k];
        const ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2],bx=c[0]-a[0],by=c[1]-a[1],bz=c[2]-a[2];
        const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
        assert.ok(Math.hypot(nx,ny,nz)>1e-11);
        volume+=a[0]*nx+a[1]*ny+a[2]*nz;
        for(const [x,y] of [[i,j],[j,k],[k,i]]){
          adj[x].add(y);adj[y].add(x);
          const key=Math.min(x,y)+'/'+Math.max(x,y);
          const edge=edges.get(key)||[0,0];edge[0]++;edge[1]+=x<y?1:-1;edges.set(key,edge);
        }
      }
      assert.ok(volume>0);
      for(const pair of edges.values())assert.deepEqual(pair,[2,0]);
      const visited=new Set([0]),queue=[0];
      while(queue.length)for(const i of adj[queue.pop()])if(!visited.has(i)){visited.add(i);queue.push(i);}
      assert.equal(visited.size,v.length);
    }
  }
});
