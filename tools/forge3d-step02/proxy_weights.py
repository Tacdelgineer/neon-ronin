"""Heat-weight a watertight temporary proxy, transfer to the detailed mesh."""
import bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from inspect_source import WORK,render
from rig import pose
bpy.ops.wm.open_mainfile(filepath=str(WORK/'rig-auto.blend'))
rig=bpy.data.objects['NeonRoninRig']
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
proxy=bpy.data.objects.new('TemporaryWeightProxy',mesh.data.copy())
bpy.context.scene.collection.objects.link(proxy)
bpy.ops.object.select_all(action='DESELECT');proxy.select_set(True);bpy.context.view_layer.objects.active=proxy
mod=proxy.modifiers.new('Watertight weight surface','REMESH');mod.mode='VOXEL';mod.voxel_size=.007;mod.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=proxy.modifiers.new('Smooth proxy','SMOOTH');mod.factor=.7;mod.iterations=3
bpy.ops.object.modifier_apply(modifier=mod.name)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
sums=[sum(g.weight for g in v.groups) for v in proxy.data.vertices]
report=dict(proxy_vertices=len(sums),proxy_unweighted=sum(s<1e-6 for s in sums))
print('PROXY '+json.dumps(report),flush=True)
if report['proxy_unweighted']>0:raise RuntimeError('Proxy heat weights incomplete')
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
for group in mesh.vertex_groups:mesh.vertex_groups.remove(group)
for group in proxy.vertex_groups:mesh.vertex_groups.new(name=group.name)
mod=mesh.modifiers.new('Transfer proxy heat weights','DATA_TRANSFER')
mod.object=proxy;mod.use_vert_data=True;mod.data_types_verts={'VGROUP_WEIGHTS'};mod.vert_mapping='POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(proxy,do_unlink=True)
sums=[sum(g.weight for g in v.groups) for v in mesh.data.vertices]
report.update(mesh_unweighted=sum(s<1e-6 for s in sums),mesh_vertices=len(sums))
(WORK/'proxy-weight-report.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'rig-proxy.blend'))
pose(rig,'raised');render('proxy-raised')
pose(rig,'knees');render('proxy-knees',(1,-2,.2))
