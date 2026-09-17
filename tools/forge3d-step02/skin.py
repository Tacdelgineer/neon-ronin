"""Asset-specific fallback skinning after heat-weight failure, with rigid accessory fixes."""
import bpy,bmesh,sys,json,math
import numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from inspect_source import WORK,render
from rig import BONES,pose,reset_pose
bpy.ops.wm.open_mainfile(filepath=str(WORK/'rig-auto.blend'))
rig=bpy.data.objects['NeonRoninRig'];mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
names=[b[0] for b in BONES];index={n:i for i,n in enumerate(names)}
p=np.array([v.co[:] for v in mesh.data.vertices]);x,y,z=p.T
weights=np.zeros((len(p),len(names)),dtype=np.float32)
def smooth(a,b,t):
    q=np.clip((t-a)/(b-a),0,1);return q*q*(3-2*q)
def chain(rows,segments,coordinate):
    # segments ordered low to high, with smooth transition centers/half-widths.
    remaining=np.ones(len(rows))
    for i,(name,center,width) in enumerate(segments):
        t=smooth(center-width,center+width,coordinate[rows]) if i<len(segments)-1 else np.zeros(len(rows))
        weights[rows,index[name]]+=remaining*(1-t)
        remaining*=t
# All vertices initially follow the torso's vertical chain.
rows=np.arange(len(p))
chain(rows,[('hips',.073,.036),('spine',.160,.04),('chest',.272,.025),('neck',.317,.016),('head',1,1)],z)
# Legs fade into the pelvis. Each leg only blends its anatomical neighbours.
for side,sign in [('R',-1),('L',1)]:
    rows=np.where((z<-.025)&((x<.095) if side=='R' else (x>=.095)))[0]
    weights[rows]=0
    chain(rows,[('foot.'+side,-.434,.026),('lower_leg.'+side,-.235,.042),('upper_leg.'+side,-.035,.055),('hips',1,1)],z)
# Arms: smoothly blend the shoulder interface; hard limb separation occurs in empty space.
for side,shoulder in [('R',-.005),('L',.191)]:
    # x thresholds follow the sloping upper arms.
    if side=='R':
        border=.024 + np.clip((z-.13)/.12,0,1)*.002
        strength=1-smooth(border-.046,border+.013,x)
    else:
        border=.169 + np.clip((.20-z)/.17,0,1)*.055
        strength=smooth(border-.010,border+.030,x)
    distances=[]
    for bn,ha,ta,pa in BONES:
        if bn in ['upper_arm.'+side,'lower_arm.'+side,'hand.'+side]:
            a=np.array(ha);d=np.array(ta)-a;t=np.clip((p-a)@d/(d@d),0,1)
            distances.append(np.linalg.norm(p-(a+t[:,None]*d),axis=1))
    proximity=1-smooth(.047,.068,np.min(distances,axis=0))
    strength*=proximity*smooth(-.15,-.12,z)*(1-smooth(.27,.304,z))
    rows=np.where(strength>0)[0];base=weights[rows].copy();weights[rows]=0
    chain(rows,[('hand.'+side,.027,.017),('lower_arm.'+side,.150,.026),('upper_arm.'+side,1,1)],z)
    weights[rows]=weights[rows]*strength[rows,None]+base*(1-strength[rows,None])
# The generated hands are very close to the waist. Keep complete lower-limb surfaces
# on their arm chain; do not blend a fingertip back toward the pelvis.
for side in ('R','L'):
    if side=='R': limb=(x<-.026)&(y<.065)
    else: limb=(x>(.232-np.clip((z-.07)/.09,0,1)*.024))&(y<.085)
    rows=np.where(limb&(z<.163)&(z>-.115))[0]
    weights[rows]=0
    chain(rows,[('hand.'+side,.027,.017),('lower_arm.'+side,.150,.026),('upper_arm.'+side,1,1)],z)
# Sample the existing base-color texture only for classifying rigid armor/cloth.
uv=np.empty(len(mesh.data.loops)*2,dtype=np.float32);mesh.data.uv_layers.active.data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
vi=np.empty(len(mesh.data.loops),dtype=np.int32);mesh.data.loops.foreach_get('vertex_index',vi)
img=bpy.data.images['Image_0'];iw,ih=img.size
pixels=np.empty(iw*ih*4,dtype=np.float32);img.pixels.foreach_get(pixels);pixels=pixels.reshape(ih,iw,4)
rgb=pixels[(np.clip(uv[:,1],0,.999999)*ih).astype(int),(np.clip(uv[:,0],0,.999999)*iw).astype(int),:3]
colors=np.zeros((len(p),3));counts=np.bincount(vi,minlength=len(p))
for c in range(3):np.add.at(colors[:,c],vi,rgb[:,c])
colors/=np.maximum(counts[:,None],1)
red=(colors[:,0]>colors[:,1]*1.6)&(colors[:,0]>colors[:,2]*1.5)&(colors[:,0]>.03)
white=(colors.min(1)>.38)&(colors.max(1)-colors.min(1)<.30)
del pixels,rgb
fixes={}
def rigid(mask,bone,label):
    ids=np.where(mask)[0];weights[ids]=0;weights[ids,index[bone]]=1;fixes[label]=len(ids)
# Original hair and face are a single rigid head surface.
rigid(z>.326,'head','head_hair')
# Cape lives behind the right arm; it must never be dragged with that arm.
cape=(z>-.18)&((x<-.125)|((x<.025)&(y>.060))|((x<.015)&(y>.048)&red))
rigid(cape,'chest','scarf_tails')
# Hanging center sash follows the belt, with no cloth simulation.
sash=(red|(y<-.07))&(z<.045)&(z>-.34)&(x>.05)&(x<.155)
rigid(sash,'hips','waist_sash')
# Sword centerline fitted from front/side views. Single influence throughout.
a=np.array([.164,-.089,.18]);b=np.array([.291,-.014,-.207]);d=b-a
t=np.clip((p-a)@d/(d@d),0,1);distance=np.linalg.norm(p-(a+t[:,None]*d),axis=1)
sword=(distance<.045)&(z<.20)&(z>-.224)
rigid(sword,'hips','sheathed_sword')
for side in ('R','L'):
    arm=(x<.018) if side=='R' else (x>.204)
    rigid(white&arm&(z>.038)&(z<.157)&~cape,'lower_arm.'+side,'forearm_armor_'+side)
    rigid(white&arm&(z<.022)&(z>-.07)&~cape,'hand.'+side,'hand_armor_'+side)
rigid((x>.167)&(z>.203)&(z<.3),'upper_arm.L','shoulder_armor')
rigid((white|(y<.012))&(x>.155)&(z<-.17)&(z>-.421)&~sword,'lower_leg.L','shin_armor')
# Accessory priority: bright sword fittings must not inherit the armor mask.
rigid(sword,'hips','sheathed_sword')
# Below the elbow, anatomy is disjoint: eliminate residual body/arm cross-influences.
arm_cols=[index[n] for n in names if any(n.startswith(k) for k in ('upper_arm','lower_arm','hand'))]
body_cols=[i for i in range(len(names)) if i not in arm_cols]
arm_total=weights[:,arm_cols].sum(1)
low=z<.163
arm_rows=np.where(low&(arm_total>.5))[0];body_rows=np.where(low&(arm_total<=.5))[0]
weights[np.ix_(arm_rows,body_cols)]=0
weights[np.ix_(body_rows,arm_cols)]=0
weights/=weights.sum(1)[:,None]
# Keep only four normalized influences, the portable glTF default.
top=np.argsort(weights,axis=1)[:,-4:]
limited=np.zeros_like(weights)
np.put_along_axis(limited,top,np.take_along_axis(weights,top,axis=1),axis=1)
limited[limited<.001]=0;limited/=limited.sum(1)[:,None];weights=limited
for g in list(mesh.vertex_groups):mesh.vertex_groups.remove(g)
groups=[mesh.vertex_groups.new(name=n) for n in names]
for i,w in enumerate(weights):
    for j in np.flatnonzero(w):groups[j].add([i],float(w[j]),'REPLACE')
# Show classification in a temporary colored render for accessory-mask inspection.
attr=mesh.data.color_attributes.new(name='WeightInspection',type='FLOAT_COLOR',domain='POINT')
palette=np.array([[.08,.1,.14,1]]*len(p))
palette[cape]=[0,1,1,1];palette[sword]=[1,0,.45,1];palette[sash]=[.9,.55,.08,1]
attr.data.foreach_set('color',palette.ravel())
mat=bpy.data.materials.new('TemporaryWeightInspection');mat.use_nodes=True
ns=mat.node_tree.nodes;ns.clear();out=ns.new('ShaderNodeOutputMaterial');em=ns.new('ShaderNodeEmission');at=ns.new('ShaderNodeVertexColor');at.layer_name=attr.name
mat.node_tree.links.new(at.outputs['Color'],em.inputs['Color']);mat.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
original=mesh.data.materials[0];mesh.data.materials[0]=mat
render('accessory-masks-front');render('accessory-masks-side',(2,0,.05))
mesh.data.materials[0]=original;mesh.data.color_attributes.remove(attr)
# The source has fused contact triangles between gloves/clothing/accessories.
# Open those non-anatomical contacts below the elbows so independent limbs can move.
arm_indices=[index[n] for n in names if any(n.startswith(k) for k in ('upper_arm','lower_arm','hand'))]
arm_vertex=weights[:,arm_indices].sum(1)>.5
bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table();bm.verts.index_update()
# Mark original islands so cleanup retains all pre-existing hair/armor/sword details.
original_size={};seen=set()
for v in bm.verts:
    if v in seen:continue
    stack=[v];seen.add(v);vs=[]
    while stack:
        q=stack.pop();vs.append(q)
        for e in q.link_edges:
            n=e.other_vert(q)
            if n not in seen:seen.add(n);stack.append(n)
    for q in vs:original_size[q]=len(vs)
cut=[]
for f in bm.faces:
    ids=[v.index for v in f.verts]
    count=sum(arm_vertex[ids])
    if 0<count<len(ids) and max(z[ids])<.163:cut.append(f)
contact_faces_removed=len(cut)
bmesh.ops.delete(bm,geom=cut,context='FACES_ONLY')
# Remove only small scraps newly isolated by contact cleanup, not source islands.
seen=set();scraps=set()
for v in bm.verts:
    if v in seen:continue
    stack=[v];seen.add(v);vs=[]
    while stack:
        q=stack.pop();vs.append(q)
        for e in q.link_edges:
            if not e.link_faces:continue
            n=e.other_vert(q)
            if n not in seen:seen.add(n);stack.append(n)
    fs=set(f for q in vs for f in q.link_faces)
    if 0<len(fs)<250 and all(original_size[q]>10000 for q in vs) and max(q.co.z for q in vs)<.20:
        scraps.update(fs)
scrap_faces_removed=len(scraps)
bmesh.ops.delete(bm,geom=list(scraps),context='FACES_ONLY')
bm.to_mesh(mesh.data);bm.free();mesh.data.update()
mesh.name='NeonRonin_Skinned'
report=dict(method='anatomical smooth chains after failed heat weighting',rigid_vertex_counts=fixes,
    contact_faces_removed=contact_faces_removed,scrap_faces_removed=scrap_faces_removed,triangles=len(mesh.data.polygons),vertices=len(p),unweighted=int(np.sum(weights.sum(1)<.999)),max_influences=int((weights>0).sum(1).max()),
    bone_names=names,poses={})
used_edges=set(l.edge_index for l in mesh.data.loops)
edges=np.array([e.vertices[:] for e in mesh.data.edges if e.index in used_edges]);rest=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)
for name in ['neutral','raised','step','knees','attack']:
    pose(rig,name)
    dg=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(dg);m=ev.to_mesh()
    pp=np.array([v.co[:] for v in m.vertices]);ev.to_mesh_clear()
    lengths=np.linalg.norm(pp[edges[:,0]]-pp[edges[:,1]],axis=1)
    valid=rest>1e-5;ratio=lengths[valid]/rest[valid]
    report['poses'][name]=dict(finite=bool(np.isfinite(pp).all()),edge_stretch_p99=float(np.percentile(ratio,99)),max_edge_length=float(lengths.max()))
    bpy.context.scene.camera.data.ortho_scale=1.35 if name=='raised' else 1.18
    render('pose-'+name,(.7,-2,.15) if name in ['step','knees','attack'] else (.08,-2,.05),target=(.08,0,0))
    if name in ['raised','knees','attack']:render('pose-'+name+'-side',(2,0,.05))
reset_pose(rig);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'neon-ronin-rigged.blend'))
(WORK/'skin-validation.json').write_text(json.dumps(report,indent=2))
print('SKIN_VALIDATION '+json.dumps(report),flush=True)
