"""Build the original Print Studio sculpts. Offline tools: NumPy, SciPy, scikit-image, manifold3d and fast-simplification."""
from pathlib import Path
import struct
import numpy as np
from scipy.ndimage import gaussian_filter, binary_fill_holes
from skimage.measure import marching_cubes
from manifold3d import Manifold, Mesh64
import fast_simplification

STEP = .0094
axis = np.arange(-.6443, .65, STEP, dtype=np.float32)
vertical = np.arange(-.0607, 1.20, STEP, dtype=np.float32)
X, Y, Z = np.meshgrid(axis, axis, vertical, indexing="ij", sparse=True)
OUT = Path(__file__).resolve().parents[1] / "models"


def ball(x, y, z, a, b, c):
    return (np.sqrt(((X-x)/a)**2+((Y-y)/b)**2+((Z-z)/c)**2)-1)*min(a,b,c)


def box(x, y, z, a, b, c, bevel=.008):
    return np.maximum(np.maximum(abs(X-x)-a, abs(Y-y)-b), abs(Z-z)-c)-bevel


def limb(start, end, r, tip=None):
    tip = r if tip is None else tip
    dx, dy, dz = np.subtract(end,start)
    x,y,z = X-start[0],Y-start[1],Z-start[2]
    t = np.clip((x*dx+y*dy+z*dz)/(dx*dx+dy*dy+dz*dz),0,1)
    return np.sqrt((x-t*dx)**2+(y-t*dy)**2+(z-t*dz)**2)-(r+(tip-r)*t)


def trunk(x,y,low,high,r1,r2,fy=1):
    t=np.clip((Z-low)/(high-low),0,1)
    ring=np.sqrt((X-x)**2+((Y-y)/fy)**2) - (r1+(r2-r1)*t)
    return np.maximum(np.maximum(low-Z,Z-high),ring)


class Sculpt:
    def __init__(self, base=.33, square=False):
        self.field = (box(0,0,.033,base,base*.82,.030,.003) if square else
                      trunk(0,0,.0,.067,base,base*.97,.89))
        self.field=np.minimum(self.field,trunk(0,0,.055,.085,base*.97,base*.88,.89)) if not square else self.field

    def add(self,*pieces):
        for p in pieces:
            self.field=np.minimum(self.field,p)

    def cut(self,*pieces):
        for p in pieces:
            self.field=np.maximum(self.field,-p)


def oathkeeper():
    s=Sculpt(.31)
    for side in [-1,1]:
        x=side*.095
        s.add(ball(x,-.035,.127,.082,.125,.085),limb((x,.005,.18),(x*.82,.005,.44),.069,.089),
              ball(x,-.044,.30,.077,.070,.104),ball(x,-.08,.342,.062,.034,.061))
    s.add(trunk(0,.018,.36,.51,.184,.12,.83),ball(0,.015,.58,.170,.12,.188),
          trunk(0,.012,.455,.494,.151,.15,.89),box(0,-.118,.473,.035,.016,.022),
          ball(0,-.072,.61,.15,.064,.11),limb((-.113,-.096,.695),(.105,-.12,.496),.024))
    for side in [-1,1]:
        x=side*.163
        s.add(limb((x,.005,.67),(side*.21,-.005,.53),.070,.055),
              ball(x,.002,.68,.103,.115,.077),ball(x,.002,.655,.104,.113,.046),
              limb((side*.21,-.005,.53),(side*.221,-.070,.44),.057,.049),
              ball(side*.22,-.072,.431,.052,.054,.058))
    # Long cloak falls behind the legs. Raised folds connect along its surface.
    s.add(limb((0,.092,.66),(0,.123,.25),.097,.130))
    for side in [-1,1]:
        s.add(limb((side*.097,.079,.66),(side*.143,.125,.25),.052,.041))
    s.add(trunk(0,.003,.687,.768,.085,.105,.98),ball(0,-.006,.814,.111,.111,.133),
          ball(0,-.066,.818,.105,.077,.084),
          limb((0,-.136,.79),(0,-.134,.854),.015),
          limb((0,.002,.907),(0,.105,.98),.039,.045),
          limb((0,.103,.98),(0,.154,.911),.046,.018))
    # Inset visor and breaths, shield boss and rim.
    for side in [-1,1]:
        s.cut(limb((side*.014,-.132,.833),(side*.092,-.103,.846),.020))
        s.add(limb((side*.016,-.131,.858),(side*.091,-.099,.87),.013))
    s.add(ball(-.236,-.115,.475,.121,.047,.175),ball(-.236,-.156,.48,.052,.026,.065),
          limb((-.236,-.15,.35),(-.236,-.15,.61),.013))
    # Branch-shaped relief on the face of the heraldic shield.
    for sign in [-1,1]:
        s.add(limb((-.236,-.168,.493),(-.236+sign*.069,-.149,.547),.013))
    return s


def briar_scout():
    s=Sculpt(.32)
    for side in [-1,1]:
        x=side*.085
        s.add(ball(x,-.048,.128,.084,.112,.072),limb((x,0,.16),(x*.88,0,.36),.058,.073))
    s.add(ball(0,.013,.398,.158,.12,.155),trunk(0,.005,.416,.454,.156,.15,.77),
          limb((-.133,0,.456),(-.177,-.042,.354),.057,.052),
          limb((.132,.003,.457),(.208,-.012,.514),.061,.041),
          limb((.208,-.012,.514),(.232,-.017,.613),.043,.043),
          ball(.23,-.015,.61,.05,.043,.058),ball(.195,-.043,.598,.025,.024,.031))
    s.add(ball(0,-.005,.624,.212,.166,.171),ball(0,-.171,.608,.059,.048,.040),
          ball(0,-.145,.559,.084,.034,.025),trunk(0,.0,.472,.512,.13,.14,.91),
          limb((.052,-.102,.495),(.089,-.122,.383),.035,.029))
    for side in [-1,1]:
        s.add(limb((side*.163,.003,.623),(side*.272,.026,.698),.069,.023),
              ball(side*.082,-.146,.654,.051,.035,.058),
              ball(side*.084,-.177,.656,.025,.022,.034),
              limb((side*.05,-.15,.70),(side*.115,-.131,.71),.017))
    s.cut(limb((-.052,-.156,.578),(.045,-.157,.57),.013))
    # Broad cap, bent tip and raised band.
    s.add(ball(0,.009,.748,.236,.182,.047),ball(-.015,.022,.787,.183,.152,.092),
          limb((-.035,.032,.819),(-.114,.050,.937),.11,.048),
          limb((-.114,.05,.937),(-.199,.04,.91),.047,.022),
          ball(-.197,.038,.90,.036,.036,.039))
    return s


def fir():
    s=Sculpt(.35)
    s.add(trunk(0,0,.064,.97,.087,.029))
    for layer,(z,r,h) in enumerate([(.26,.335,.32),(.43,.278,.30),(.595,.219,.26),(.74,.145,.26)]):
        angle=np.arctan2(Y,X)
        wave=.90+.10*np.cos(9*angle+layer*1.24)
        low=z+.034*np.cos(9*angle+layer*1.24)
        radius=r*wave*np.clip(1-(Z-z)/h,.0,1.12)
        s.add(np.maximum.reduce(np.broadcast_arrays(np.hypot(X,Y)-radius,low-Z,Z-(z+h))))
    return s


def elder():
    s=Sculpt(.38)
    s.add(limb((0,0,.07),(.035,.0,.35),.112,.082),limb((.035,0,.35),(0,.015,.68),.088,.061))
    for i in range(7):
        a=i*2.399
        x,y=np.cos(a),np.sin(a)
        s.add(limb((x*.24,y*.23,.072),(x*.035,y*.035,.25),.029,.055))
        z=.42+(i%3)*.071; tip=(x*.225,y*.205,.65+(i%3)*.073)
        s.add(limb((.012,.01,z),tip,.058,.033),ball(*tip,.14,.136,.15))
        s.add(ball(tip[0]+x*.052,tip[1]+y*.038,tip[2]-.025,.116,.115,.10))
    s.add(ball(0,.005,.717,.215,.205,.155))
    s.add(ball(-.033,.008,.84,.172,.153,.139),ball(.047,.053,.917,.117,.119,.089))
    return s


def foliage():
    s=Sculpt(.36)
    for i in range(13):
        a=i*2.399; length=.18+(i%4)*.040; height=.22+(i%5)*.067
        radial=X*np.cos(a)+Y*np.sin(a); tang=-X*np.sin(a)+Y*np.cos(a)
        t=np.clip((Z-.072)/height,0,1)
        mid=length*(.1*t+.9*t*t)
        half=.010+.052*np.clip(np.sin(np.pi*t),0,1)**.78
        thick=.012+.019*np.sin(np.pi*t)
        leaf=(np.sqrt((tang/half)**2+((radial-mid)/thick)**2)-1)*.025
        s.add(np.maximum(np.maximum(.065-Z,Z-(.072+height)),leaf))
    for x,y,h,r in [(-.16,-.143,.25,.080),(.16,-.13,.185,.064)]:
        s.add(trunk(x,y,.066,h,.027,.035),
              np.maximum(ball(x,y,h,r,r,.058),h-.012-Z))
    return s


def cottage():
    s=Sculpt(.425,True)
    s.add(box(0,0,.248,.325,.238,.18))
    # The gable runs along Y; roof boards and tiles trace the sloped faces.
    s.add(np.maximum.reduce(np.broadcast_arrays(abs(Y)-.252,abs(X)-.325,Z-(.667-abs(X)*.76),.407-Z)))
    roof=Z-(.695-abs(X)*.76)
    s.add(np.maximum.reduce(np.broadcast_arrays(abs(Y)-.306,abs(X)-.382,abs(roof)-.021)))
    for i in [-1,1]:
        for y in [-.215,0,.215]:s.add(box(i*.322,y,.25,.012,.014,.181))
        s.add(box(i*.163,-.24,.25,.013,.017,.178))
        for y in [-.26,-.135,-.01,.115,.24]:
            s.add(limb((i*.015,y,.69),(i*.375,y,.414),.009))
    s.add(box(.17,.106,.65,.045,.05,.144),box(.17,.106,.793,.054,.059,.019))
    s.cut(box(-.068,-.253,.184,.058,.041,.105))
    for x in [.16,-.235]:
        s.cut(box(x,-.252,.31,.054,.033,.054))
        s.add(box(x,-.235,.31,.007,.016,.057),box(x,-.235,.31,.052,.017,.006))
    s.add(box(0,-.243,.413,.327,.019,.016),box(0,0,.10,.34,.25,.023))
    return s


def watchtower():
    s=Sculpt(.35)
    s.add(trunk(0,0,.06,.185,.285,.245),trunk(0,0,.16,.82,.241,.209),
          trunk(0,0,.77,.836,.217,.259),trunk(0,0,.835,.882,.259,.259))
    for z in [.18,.38,.60,.75]:
        r=.241-(z-.16)*.048
        s.add(trunk(0,0,z,z+.017,r+.009,r+.009))
    for i in range(10):
        a=i*np.pi/5
        radial=X*np.cos(a)+Y*np.sin(a); tang=-X*np.sin(a)+Y*np.cos(a)
        s.add(np.maximum.reduce(np.broadcast_arrays(abs(radial-.223)-.031,abs(tang)-.044,abs(Z-.902)-.046)))
    s.cut(trunk(0,0,.842,.968,.183,.183))
    for a,z in [(0,.31),(.88,.55),(2,.53),(-1.4,.61),(3,.35)]:
        radial=-Y*np.cos(a)+X*np.sin(a); tang=X*np.cos(a)+Y*np.sin(a)
        s.cut(np.maximum.reduce(np.broadcast_arrays(.174-radial,abs(tang)-.029,abs(Z-z)-.058)))
    return s


def save(slug,sculpt,faces_wanted):
    if slug in ('oathkeeper','briar-scout'):
        values=gaussian_filter(sculpt.field,.70)
        surface=.00031
    else:
        values=gaussian_filter(binary_fill_holes(sculpt.field<0).astype(np.float32),1.05)
        surface=.4813
    v,f,_,_=marching_cubes(values,level=surface,spacing=(STEP,STEP,STEP),allow_degenerate=False)
    v=v.astype(float)+[axis[0],axis[0],vertical[0]]
    obj=Manifold(Mesh64(np.ascontiguousarray(v),np.ascontiguousarray(f,dtype=np.uint64)))
    assert obj.num_tri()>0,(slug,obj.status())
    shell=max(obj.decompose(),key=lambda component:abs(component.volume()))
    mesh=shell.simplify(.0012).to_mesh64()
    points=mesh.vert_properties[:,:3].copy()
    triangles=mesh.tri_verts.astype(np.int32)
    # Small windows and overlapping branches may pinch under an aggressive reduction.
    # Keep the coarsest closed result and reject any collapsed edge after quantizing.
    for ratio in [1,1.35,1.8,2.4,3.2,5,8,12]:
        v,f=fast_simplification.simplify(points,triangles,target_count=min(int(faces_wanted*ratio),len(triangles)),agg=5)
        v[:,:2]-=(v[:,:2].max(0)+v[:,:2].min(0))/2;v[:,2]-=v[:,2].min()
        longest=np.ptp(v,axis=0).max();v/=longest
        v=np.rint(v*1000000).astype('<i4')
        volume=np.einsum('ij,ij->i',v[f[:,0]]/1e6,np.cross(v[f[:,1]]/1e6,v[f[:,2]]/1e6)).sum()
        if volume<0:f=f[:,[0,2,1]]
        edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]])
        _,counts=np.unique(np.sort(edges,axis=1),axis=0,return_counts=True)
        if np.all(counts==2) and len(np.unique(v,axis=0))==len(v):
            break
    else:
        raise ValueError('Could not simplify a closed surface: '+slug)
    data=struct.pack('<4sHHf',b'EFM1',len(v),len(f),(.065 if slug=='cottage' else .082)/longest)
    (OUT/(slug+'.mesh')).write_bytes(data+v.tobytes()+f.astype('<u2').tobytes())
    print(slug,len(v),len(f),flush=True)


if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    for name,build,count in [('oathkeeper',oathkeeper,5300),('briar-scout',briar_scout,4400),
                            ('fir',fir,1600),('elder',elder,2000),('foliage',foliage,2200),
                            ('cottage',cottage,2400),('watchtower',watchtower,2200)]:
        save(name,build(),count)
