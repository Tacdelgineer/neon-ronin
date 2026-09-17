import bpy,sys,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source as studio
from rig import reset_pose
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'work/forge3d-step04/hero-final.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data.action=None;reset_pose(rig)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
p=np.array([v.co[:] for v in mesh.data.vertices]);x,y,z=p.T
for side,s in [('R',-1),('L',1)]:
    q=p[(x*s>.14)&(z<.06)&(z>-.10)]
    print(side,'hand candidates min/max',q.min(0),q.max(0),'y',np.quantile(q[:,1],[0,.1,.25,.5,.75,.9,1]),flush=True)
colors=[]
for v in mesh.data.vertices:
    group=max(v.groups,key=lambda g:g.weight).group;name=mesh.vertex_groups[group].name
    colors.append((0,1,0,1) if name.startswith('hand') else (0,.2,1,1) if name.startswith('lower_arm') else (1,1,0,1) if name.startswith('upper_arm') else (1,0,1,1) if name=='hips' else (0,1,1,1) if name=='chest' else (.25,.25,.25,1))
attr=mesh.data.color_attributes.new(name='WeightDebug',type='FLOAT_COLOR',domain='POINT');attr.data.foreach_set('color',np.array(colors).ravel())
mat=bpy.data.materials.new('WeightDebug');mat.use_nodes=True;ns=mat.node_tree.nodes;ns.clear()
out=ns.new('ShaderNodeOutputMaterial');em=ns.new('ShaderNodeEmission');at=ns.new('ShaderNodeVertexColor');at.layer_name=attr.name
mat.node_tree.links.new(at.outputs['Color'],em.inputs['Color']);mat.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
mesh.data.materials[0]=mat;studio.WORK=ROOT/'artifacts/asset-audit'
studio.render('hero-weights-front',(0,-2,.05));studio.render('hero-weights-side',(2,0,.05))
