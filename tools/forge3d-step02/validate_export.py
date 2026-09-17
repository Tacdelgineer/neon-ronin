"""Independent re-import of the final deliverable, plus recording-friendly views."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from inspect_source import ROOT,WORK,setup_studio,render
from rig import pose,reset_pose
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/neon-ronin-forge3d-rigged.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
sums=[sum(g.weight for g in v.groups) for v in mesh.data.vertices]
report=dict(objects=len(bpy.context.scene.objects),skinned_mesh_objects=sum(o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers) for o in bpy.context.scene.objects),helper_meshes=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and not any(m.type=='ARMATURE' for m in o.modifiers)],
    armatures=sum(o.type=='ARMATURE' for o in bpy.context.scene.objects),bones=[b.name for b in rig.data.bones],
    armature_modifiers=sum(m.type=='ARMATURE' for m in mesh.modifiers),unweighted=sum(s<.999 for s in sums),
    images=[dict(name=i.name,size=list(i.size)) for i in bpy.data.images if i.type=='IMAGE' and i.packed_file],
    animation_actions=len(bpy.data.actions))
assert len(report['bones'])==20
assert report['unweighted']==0 and report['armature_modifiers']==1
assert len(mesh.data.materials)==1
setup_studio()
render('exported-neutral')
pose(rig,'attack');render('exported-attack',(.7,-2,.15),(.08,0,0));reset_pose(rig)
# A temporary projection of actual imported bone endpoints, in front of the model.
mat=bpy.data.materials.new('BoneOverlay');mat.use_nodes=True
ns=mat.node_tree.nodes;ns.clear();em=ns.new('ShaderNodeEmission');em.inputs[0].default_value=(.06,.8,1,1);em.inputs[1].default_value=.8
out=ns.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(em.outputs[0],out.inputs[0])
overlays=[]
for b in rig.data.bones:
    a=b.head_local.copy();c=b.tail_local.copy();a.y=c.y=-.25
    if (a-c).length<.001:continue
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.0025,depth=(c-a).length,location=(a+c)/2)
    o=bpy.context.object;o.rotation_euler=(c-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);overlays.append(o)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.005,location=a)
    o=bpy.context.object;o.data.materials.append(mat);overlays.append(o)
render('armature-front')
for o in overlays:bpy.data.objects.remove(o,do_unlink=True)
original=mesh.data.materials[0]
mat=original.copy();ns=mat.node_tree.nodes;links=mat.node_tree.links
bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED');colorlink=bs.inputs['Base Color'].links[0]
mix=ns.new('ShaderNodeMixRGB');mix.blend_type='MIX';links.new(colorlink.from_socket,mix.inputs[1]);mix.inputs[2].default_value=(.008,.015,.02,1)
wire=ns.new('ShaderNodeWireframe');wire.use_pixel_size=True;wire.inputs['Size'].default_value=.45
links.new(wire.outputs[0],mix.inputs[0]);links.new(mix.outputs[0],bs.inputs['Base Color'])
mesh.data.materials[0]=mat;render('optimized-wireframe');mesh.data.materials[0]=original
(WORK/'reimport-report.json').write_text(json.dumps(report,indent=2))
print('REIMPORT '+json.dumps(report),flush=True)
