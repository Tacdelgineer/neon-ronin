"""Batch final cast using Step 02 cleanup/export and Step 03 pose functions.

Asset-specific fits are deliberate. No source file is modified. Run with Blender 4.3.2.
"""
import bpy, bmesh, sys, json, math, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
sys.path.insert(0,str(ROOT/'tools/forge3d-step03'))
import inspect_source as studio, export_rigged as exporter
from rig import reset_pose
from animate import pose_clip, rotate, position, envelope, planted_leg
WORK=ROOT/'work/forge3d-step04';WORK.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'artifacts/asset-audit'
PUBLIC=ROOT/'public/assets/models'
INVENTORY=json.loads((OUT/'inventory.json').read_text())
SOURCES={r['id'][-2:]:ROOT/r['filename'] for r in INVENTORY}
FITS={
 'hero':dict(asset='06',target=300000,center=(.045,-.15),shoulder=.108,elbow=.155,wrist=.17,hip=.052,knee=.088,ankle=.108,
             sy=.005,ey=.015,wy=.018,hy=.005,ky=.002,ay=.005,sz=.258,ez=.14,wz=.028,kz=-.225,az=-.444),
 'enemy-a':dict(asset='07',target=100000,center=(0,0),shoulder=.24,elbow=.25,wrist=.25,hip=.11,knee=.165,ankle=.232,
             sy=.025,ey=.025,wy=.025,hy=.01,ky=.005,ay=.005,sz=.25,ez=.15,wz=.04,kz=-.235,az=-.44),
 'enemy-b':dict(asset='08',target=120000,center=(0,0),shoulder=.135,elbow=.195,wrist=.221,hip=.10,knee=.132,ankle=.179,
             sy=-.025,ey=-.035,wy=-.04,hy=.01,ky=.085,ay=.085,sz=.29,ez=.135,wz=-.045,kz=-.225,az=-.445),
}
WEAPONS={
 'hero-katana':('05',14000,.49,-1,.13),
 'hero-sheath':('04',8000,.44,-1,.04),
 'enemy-a-cannon':('02',22000,.41,0,.09),
 'enemy-a-shield':('03',8000,.47,1,.5),
 'enemy-b-blade':('01',18000,.56,1,.14),
}

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.world=bpy.data.worlds.new('StudioWorld')

def load(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return mesh

def coords(mesh):
    p=np.empty(len(mesh.data.vertices)*3,dtype=np.float32)
    mesh.data.vertices.foreach_get('co',p)
    return p.reshape(-1,3)

def simplify(mesh,target):
    # Identical weld and conservative collapse strategy to Step 02.
    bm=bmesh.new();bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8)
    bm.to_mesh(mesh.data);bm.free()
    mod=mesh.modifiers.new('Conservative collapse','DECIMATE')
    mod.ratio=min(1,target/len(mesh.data.polygons));mod.use_collapse_triangulate=True
    bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.modifier_apply(modifier=mod.name)

def bones_for(f):
    c=0
    bones=[('root',(0,0,-.500839),(0,0,-.41),None),
      ('hips',(0,f['hy'],-.02),(0,f['hy'],.075),'root'),
      ('spine',(0,f['hy'],.075),(0,f['hy'],.16),'hips'),
      ('chest',(0,f['hy'],.16),(0,f['sy'],.265),'spine'),
      ('neck',(0,f['sy'],.265),(0,f['sy'],.325),'chest'),
      ('head',(0,f['sy'],.325),(0,f['sy'],.445),'neck')]
    for side,sign in [('R',-1),('L',1)]:
        sy,ey,wy=(f['sy'],f['ey'],f['wy'])
        if f['asset']=='06' and side=='R':sy,ey,wy=-.025,-.035,-.035
        sh=(sign*f['shoulder'],sy,f['sz']);el=(sign*f['elbow'],ey,f['ez'])
        wr=(sign*f['wrist'],wy,f['wz']);tip=(sign*(f['wrist']+.005),wy,f['wz']-.078)
        hip=(sign*f['hip'],f['hy'],-.025);kn=(sign*f['knee'],f['ky'],f['kz']);an=(sign*f['ankle'],f['ay'],f['az'])
        bones.extend([('clavicle.'+side,(0,f['sy'],f['sz']),sh,'chest'),
          ('upper_arm.'+side,sh,el,'clavicle.'+side),('lower_arm.'+side,el,wr,'upper_arm.'+side),
          ('hand.'+side,wr,tip,'lower_arm.'+side),('upper_leg.'+side,hip,kn,'hips'),
          ('lower_leg.'+side,kn,an,'upper_leg.'+side),('foot.'+side,an,(an[0],an[1]-.105,-.475),'lower_leg.'+side)])
    return bones

def make_rig(name,bones):
    arm=bpy.data.armatures.new(name+'Humanoid');rig=bpy.data.objects.new(name+'Rig',arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name,head,tail,parent in bones:
        b=arm.edit_bones.new(name);b.head=head;b.tail=tail;b.use_deform=True
        if parent:b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
    return rig

def smooth(a,b,t):
    q=np.clip((t-a)/(b-a),0,1);return q*q*(3-2*q)

def anatomical_weights(mesh,rig,bones,f):
    # Step 02's anatomical chains, adapted to this fitted pose; four influences maximum.
    p=coords(mesh);x,y,z=p.T;names=[b[0] for b in bones];index={n:i for i,n in enumerate(names)}
    w=np.zeros((len(p),len(names)),np.float32)
    def chain(rows,segments):
        remain=np.ones(len(rows))
        for i,(name,center,width) in enumerate(segments):
            t=smooth(center-width,center+width,z[rows]) if i<len(segments)-1 else np.zeros(len(rows))
            w[rows,index[name]]+=remain*(1-t);remain*=t
    chain(np.arange(len(p)),[('hips',.075,.03),('spine',.16,.03),('chest',.278,.02),('neck',.326,.015),('head',1,1)])
    for side,sign in [('R',-1),('L',1)]:
        rows=np.where((z<-.02)&(x*sign>=0))[0];w[rows]=0
        chain(rows,[('foot.'+side,f['az'],.02),('lower_leg.'+side,f['kz'],.03),('upper_leg.'+side,-.025,.035),('hips',1,1)])
        distances=[]
        for bn,ha,ta,pa in bones:
            if bn in ['upper_arm.'+side,'lower_arm.'+side,'hand.'+side]:
                a=np.array(ha);d=np.array(ta)-a;t=np.clip((p-a)@d/(d@d),0,1)
                distances.append(np.linalg.norm(p-(a+t[:,None]*d),axis=1))
        border=.13+np.clip((.13-z)/.13,0,1)*.026
        strength=smooth(border-.012,border+.012,x*sign)*(1-smooth(.04,.068,y))*(1-smooth(.28,.32,z))*smooth(-.072,-.052,z)
        strength*=1-smooth(.034,.052,np.min(distances,axis=0))
        rows=np.where(strength>0)[0];base=w[rows].copy();w[rows]=0
        chain(rows,[('hand.'+side,f['wz'],.012),('lower_arm.'+side,f['ez'],.023),('upper_arm.'+side,1,1)])
        w[rows]=w[rows]*strength[rows,None]+base*(1-strength[rows,None])
        # Complete gloves/forearms separated from waist; rigid white plates follow one bone.
        mask=(x*sign>.158)&(z<.11)&(z>-.060)&(y<.048)&(np.min(distances,axis=0)<.040)
        ids=np.where(mask)[0];w[ids]=0
        chain(ids,[('hand.'+side,f['wz'],.01),('lower_arm.'+side,1,1)])
    def rigid(mask,bone):
        rows=np.where(mask)[0];w[rows]=0;w[rows,index[bone]]=1
    rigid(z>.326,'head')
    # Loose scarf is behind the body; hanging sash stays with hips.
    rigid((y>.068)&(z>-.14),'chest')
    rigid((abs(x)<.052)&(z<.035)&(z>-.30)&(y<-.045),'hips')
    rigid((x>.09)&(z>.20)&(z<.295)&(y<.06),'upper_arm.L')
    rigid((x>.055)&(z<-.245)&(z>-.43),'lower_leg.L')
    # Texture color separates the red generated strips from gloves near the waist.
    uv=np.empty(len(mesh.data.loops)*2,np.float32);mesh.data.uv_layers.active.data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
    vi=np.empty(len(mesh.data.loops),np.int32);mesh.data.loops.foreach_get('vertex_index',vi)
    img=next(i for i in bpy.data.images if i.type=='IMAGE' and i.colorspace_settings.name=='sRGB')
    iw,ih=img.size;pixels=np.empty(iw*ih*4,np.float32);img.pixels.foreach_get(pixels);pixels=pixels.reshape(ih,iw,4)
    rgb=pixels[(np.clip(uv[:,1],0,.999999)*ih).astype(int),(np.clip(uv[:,0],0,.999999)*iw).astype(int),:3]
    colors=np.zeros((len(p),3));counts=np.bincount(vi,minlength=len(p))
    for c in range(3):np.add.at(colors[:,c],vi,rgb[:,c])
    colors/=np.maximum(counts[:,None],1)
    red=(colors[:,0]>colors[:,1]*2.5)&(colors[:,0]>colors[:,2]*2.2)&(colors[:,0]>.04)
    for side,sign in [('R',-1),('L',1)]:
        lowy,highy=(-.075,.045) if side=='R' else (-.025,.085)
        rigid((x*sign>.15)&(z<.067)&(z>-.108)&(y>lowy)&(y<highy),'hand.'+side)
        rigid((x*sign>.135)&(z>.067)&(z<.14)&(y>lowy)&(y<highy),'lower_arm.'+side)
    rigid(red&(z<.23)&(z>.055),'chest')
    rigid(red&(z<=.055)&(z>-.30)&(y<.09)&(abs(x)<.145),'hips')
    rigid((y>.09)&(z>-.14),'chest')
    # Below elbows no residual torso/arm mixing: same final separation as Step 02.
    arm_ids=[index[n] for n in names if n.startswith(('upper_arm','lower_arm','hand'))]
    body_ids=[i for i in range(len(names)) if i not in arm_ids]
    arm_total=w[:,arm_ids].sum(1)
    arm_rows=np.where((z<.14)&(arm_total>.5))[0];body_rows=np.where((z<.14)&(arm_total<=.5))[0]
    w[np.ix_(arm_rows,body_ids)]=0;w[np.ix_(body_rows,arm_ids)]=0
    w/=w.sum(1)[:,None]
    top=np.argsort(w,axis=1)[:,-4:];limited=np.zeros_like(w)
    np.put_along_axis(limited,top,np.take_along_axis(w,top,axis=1),axis=1)
    limited[limited<.001]=0;limited/=limited.sum(1)[:,None]
    groups=[mesh.vertex_groups.new(name=n) for n in names]
    for i,row in enumerate(limited):
        for j in np.flatnonzero(row):groups[j].add([i],float(row[j]),'REPLACE')
    # Reuse Step 02's contact opening to prevent generated glove/waist bridges exploding.
    arm_ids=[index[n] for n in names if n.startswith(('upper_arm','lower_arm','hand'))]
    is_arm=limited[:,arm_ids].sum(1)>.5
    bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table();bm.verts.index_update()
    def components():
        seen=set();result=[]
        for v in bm.verts:
            if v in seen:continue
            stack=[v];seen.add(v);vertices=[]
            while stack:
                q=stack.pop();vertices.append(q)
                for edge in q.link_edges:
                    if not edge.link_faces:continue
                    other=edge.other_vert(q)
                    if other not in seen:seen.add(other);stack.append(other)
            result.append(vertices)
        return result
    original_size={v:len(c) for c in components() for v in c}
    cut=[face for face in bm.faces if 0<sum(is_arm[v.index] for v in face.verts)<len(face.verts) and max(v.co.z for v in face.verts)<.14]
    bmesh.ops.delete(bm,geom=cut,context='FACES_ONLY')
    scraps=set()
    for c in components():
        faces={face for v in c for face in v.link_faces}
        if 0<len(faces)<150 and all(original_size[v]>10000 for v in c) and max(v.co.z for v in c)<.20:scraps.update(faces)
    bmesh.ops.delete(bm,geom=list(scraps),context='FACES_ONLY');bm.to_mesh(mesh.data);bm.free()
    return dict(method='Step 02 anatomical chains and rigid accessory corrections',contact_faces_removed=len(cut),scrap_faces_removed=len(scraps))

def mechanical_weights(mesh,rig,name,f):
    # Every triangle has one rigid bone. Split joint boundaries: armor cannot rubber-stretch.
    bm=bmesh.new();bm.from_mesh(mesh.data);layer=bm.faces.layers.int.new('RigidBone')
    names=[b.name for b in rig.data.bones];index={n:i for i,n in enumerate(names)}
    for face in bm.faces:
        x,y,z=face.calc_center_median();side='R' if x<0 else 'L'
        if abs(x)<.058 and z<.02 and z>-.32 and y<-.05:bone='hips'
        elif name=='enemy-b' and abs(x)>.157 and z>-.13:
            bone=('upper_arm.' if z>f['ez'] else 'lower_arm.' if z>f['wz'] else 'hand.')+side
        elif z<-.07:bone=('foot.' if z<f['az'] else 'lower_leg.' if z<f['kz'] else 'upper_leg.')+side
        elif z<.045:bone='hips'
        elif z>.365:bone='head'
        else:bone='chest'
        face[layer]=index[bone]
    boundaries=[e for e in bm.edges if len({face[layer] for face in e.link_faces})>1]
    # Generated non-manifold point contacts also need isolation, beyond edge boundaries.
    bmesh.ops.split_edges(bm,edges=list(bm.edges),verts=list(bm.verts),use_verts=True)
    for label in range(len(names)):
        region=[v for v in bm.verts if v.link_faces and next(iter(v.link_faces))[layer]==label]
        bmesh.ops.remove_doubles(bm,verts=region,dist=1e-6)
    bm.verts.ensure_lookup_table();bm.verts.index_update()
    labels=[next(iter(v.link_faces))[layer] if v.link_faces else index['hips'] for v in bm.verts]
    assert all(len({face[layer] for face in v.link_faces})<=1 for v in bm.verts)
    bm.to_mesh(mesh.data);bm.free()
    groups=[mesh.vertex_groups.new(name=n) for n in names]
    for j,g in enumerate(groups):
        ids=[i for i,label in enumerate(labels) if label==j]
        if ids:g.add(ids,1,'REPLACE')
    return dict(method='Rigid per-triangle bone weights with split joint seams',joint_edges_split=len(boundaries))

def socket(rig,name,bone,pos,angles=(0,0,0)):
    obj=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(obj)
    obj.empty_display_type='ARROWS';obj.empty_display_size=.07
    obj.parent=rig;obj.parent_type='BONE';obj.parent_bone=bone
    bpy.context.view_layer.update()
    obj.matrix_world=Matrix.Translation(Vector(pos))@Euler(tuple(math.radians(v) for v in angles)).to_matrix().to_4x4()
    return obj

def enemy_pose(rig,name,t,role):
    if name in ['idle','run','attack']:
        pose_clip(rig,name,t)
        if role=='enemy-a':
            # Torso-mounted gun uses a short recoil/aim motion; static armored side panels.
            for side in ['R','L']:
                for part in ['upper_arm','lower_arm','hand']:rotate(rig,part+'.'+side,(0,0,0))
            if name=='attack':
                k=envelope(t,[(0,0),(.28,.3),(.32,1),(.6,0),(1,0)])
                rotate(rig,'hips',(0,0,0));rotate(rig,'spine',(0,0,0));rotate(rig,'chest',(-k*5,0,0))
    elif name=='hit':
        reset_pose(rig);k=math.sin(t*math.pi)
        rotate(rig,'chest',(-k*10,0,k*5));rotate(rig,'head',(k*5,0,0))
    elif name=='death':
        reset_pose(rig);k=envelope(t,[(0,0),(.65,1),(1,1)])
        rotate(rig,'root',(-85*k,0,0));position(rig,'root',(0,0,.075*k))
        rotate(rig,'chest',(k*9,0,0))
    bpy.context.view_layer.update()

def author_clips(rig,role):
    clips={};rig.animation_data_create();bpy.context.scene.render.fps=30
    states=[('idle',72),('run',20),('attack',18),('dodge',9)] if role=='hero' else [('idle',72),('run',30),('attack',30),('hit',9),('death',24)]
    for name,frames in states:
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
        for frame in range(frames+1):
            (pose_clip(rig,name,frame/frames) if role=='hero' else enemy_pose(rig,name,frame/frames,role))
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame);bone.keyframe_insert('location',frame=frame)
        for curve in action.fcurves:
            for key in curve.keyframe_points:key.interpolation='LINEAR'
        clips[name]=action
    rig.animation_data.action=clips['idle'];bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=72
    bpy.context.scene.frame_set(0)
    return clips

def export_asset(name,source,objects,animated):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    temp=WORK/(name+'-blender.glb');dest=PUBLIC/(name+'-final.glb')
    bpy.ops.export_scene.gltf(filepath=str(temp),export_format='GLB',use_selection=True,export_animations=animated,
        export_animation_mode='ACTIONS',export_anim_single_armature=True,export_force_sampling=True,
        export_frame_range=False,export_skins=True,export_def_bones=False,export_yup=True,export_apply=False,
        export_materials='EXPORT',export_image_format='AUTO')
    exporter.SOURCE=source;exporter.WORK=WORK
    report=exporter.restore_original_textures(temp,dest)
    report.update(asset=name,original_file=str(source.relative_to(ROOT)).replace('\\','/'),source_triangles=next(r['source_triangles'] for r in INVENTORY if ROOT/r['filename']==source),
                  output=str(dest.relative_to(ROOT)),sha256=hashlib.sha256(dest.read_bytes()).hexdigest())
    (OUT/(name+'-report.json')).write_text(json.dumps(report,indent=2))
    return report

def prepare_character(name,f,source):
    optimized=WORK/(name+'-optimized.blend')
    if optimized.exists():
        bpy.ops.wm.open_mainfile(filepath=str(optimized))
        return next(o for o in bpy.context.scene.objects if o.type=='MESH')
    clear();mesh=load(source)
    p=coords(mesh);scale=1.00165528/(p[:,2].max()-p[:,2].min())
    p[:,:2]-=np.array(f['center']);p*=scale;p[:,2]+=-.500839-p[:,2].min()
    mesh.data.vertices.foreach_set('co',p.ravel());mesh.data.update();mesh.name=name+'Mesh'
    studio.WORK=OUT;studio.setup_studio();bpy.context.scene.cycles.samples=16
    bpy.context.scene.render.resolution_x=640;bpy.context.scene.render.resolution_y=800
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-source.blend')))
    studio.render(name+'-source',(.6,-2,.08))
    wire=mesh.modifiers.new('Recording wireframe','WIREFRAME');wire.thickness=.00014;wire.use_replace=True
    studio.render(name+'-source-wire',(0,-2,.05));mesh.modifiers.remove(wire)
    simplify(mesh,f['target'])
    studio.render(name+'-optimized',(.6,-2,.08))
    wire=mesh.modifiers.new('Recording wireframe','WIREFRAME');wire.thickness=.0002
    studio.render(name+'-optimized-wire',(0,-2,.05));mesh.modifiers.remove(wire)
    bpy.ops.wm.save_as_mainfile(filepath=str(optimized))
    return mesh

def character(name):
    f=FITS[name];source=SOURCES[f['asset']];mesh=prepare_character(name,f,source)
    studio.WORK=OUT
    bones=bones_for(f);rig=make_rig(name,bones)
    skin=anatomical_weights(mesh,rig,bones,f) if name=='hero' else mechanical_weights(mesh,rig,name,f)
    mesh.parent=rig;mod=mesh.modifiers.new('Humanoid deformation','ARMATURE');mod.object=rig
    reset_pose(rig)
    if name=='hero':
        hand=rig.data.bones['hand.R'];grip=hand.head_local.lerp(hand.tail_local,.45)
        sockets=[socket(rig,'weapon_hand_r','hand.R',grip,(-45,0,0)),
                 socket(rig,'weapon_sheath','hips',(.082,.05,.005),(65,0,-18))]
    elif name=='enemy-a':
        sockets=[socket(rig,'weapon_hand_r','chest',(0,-.17,.15)),socket(rig,'weapon_sheath','chest',(.265,0,.15),(-90,0,0))]
    else:sockets=[socket(rig,'weapon_hand_r','hand.R',(-f['wrist'],f['wy'],f['wz']-.04),(-40,0,0))]
    clips=author_clips(rig,name)
    report=export_asset(name,source,[rig,mesh]+sockets,True);report['skin_strategy']=skin
    (OUT/(name+'-report.json')).write_text(json.dumps(report,indent=2))
    rig.animation_data.action=clips['idle'];bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-final.blend')))
    for clip,action in clips.items():
        rig.animation_data.action=action
        for phase in ([0,.25,.5,.75] if clip=='run' else [.3] if clip=='attack' else [.5] if clip!='death' else [1]):
            bpy.context.scene.frame_set(round(action.frame_range[1]*phase))
            studio.render(f'{name}-{clip}-{phase}',(.6,-2,.10))
    print('BUILT',name,report['triangles'],flush=True)

def weapon(name):
    asset,target,length,tip_sign,grip=WEAPONS[name];source=SOURCES[asset];clear();mesh=load(source)
    simplify(mesh,target);p=coords(mesh);center=p.mean(0);q=p-center
    values,vectors=np.linalg.eigh(q.T@q)
    axis=vectors[:,2]
    # Blade/scabbard endpoints are visually confirmed. Cannon barrel runs along X.
    if tip_sign:
        if axis[2]*tip_sign<0:axis=-axis
    elif axis[0]<0:axis=-axis
    lateral=vectors[:,1];normal=np.cross(axis,lateral)
    t=q@axis;s=q@lateral;h=q@normal
    low,high=np.quantile(t,[.0001,.9999]);pivot=low+(high-low)*grip
    # Export local glTF +Z along blade/barrel; origin is at grip/mount.
    p=np.column_stack((s,-(t-pivot),h))*length/(high-low)
    mesh.data.vertices.foreach_set('co',p.ravel());mesh.data.update();mesh.name=name
    # Rotated geometry needs corresponding normals; discard stale imported split normals.
    bpy.context.view_layer.objects.active=mesh
    if mesh.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for poly in mesh.data.polygons:poly.use_smooth=True
    export_asset(name,source,[mesh],False)
    studio.WORK=OUT;studio.setup_studio();bpy.context.scene.camera.data.ortho_scale=.72
    bpy.context.scene.cycles.samples=12;bpy.context.scene.render.resolution_x=512;bpy.context.scene.render.resolution_y=512
    studio.render(name+'-processed',(1,-1,1),(0,-.15,0))
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-final.blend')))

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(WEAPONS)+list(FITS)
    for name in args:
        weapon(name) if name in WEAPONS else character(name)
