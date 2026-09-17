"""Independently re-import the shipped animated GLB and sample its deformed mesh."""
import bpy,json,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'work/forge3d-step03'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/neon-ronin-forge3d-animated.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
rig.animation_data.use_nla=False
sums=np.array([sum(g.weight for g in v.groups) for v in mesh.data.vertices])
assert np.all(abs(sums-1)<.0001)
rest=np.empty(len(mesh.data.vertices)*3);mesh.data.vertices.foreach_get('co',rest);rest=rest.reshape(-1,3)
edge=np.empty(len(mesh.data.edges)*2,dtype=np.int32);mesh.data.edges.foreach_get('vertices',edge);edge=edge.reshape(-1,2)
base=np.linalg.norm(rest[edge[:,0]]-rest[edge[:,1]],axis=1);valid=base>1e-5
report={'bones':len(rig.data.bones),'vertices':len(rest),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'unweighted':int(np.sum(sums<.999)), 'actions':[a.name for a in bpy.data.actions],'clips':{}}
for name in ['idle','run','attack','dodge']:
    action=next(a for a in bpy.data.actions if a.name==name or a.name.startswith(name+'_'))
    rig.animation_data.action=action
    samples=[]
    for phase in np.linspace(0,1,9):
        frame=action.frame_range[0]+phase*(action.frame_range[1]-action.frame_range[0])
        bpy.context.scene.frame_set(int(frame),subframe=float(frame-int(frame)))
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=evaluated.to_mesh()
        p=np.empty(len(posed.vertices)*3);posed.vertices.foreach_get('co',p);p=p.reshape(-1,3)
        evaluated.to_mesh_clear()
        assert np.isfinite(p).all() and np.abs(p).max()<1.5
        lengths=np.linalg.norm(p[edge[:,0]]-p[edge[:,1]],axis=1)
        ratio=lengths[valid]/base[valid]
        low=p.min(0);high=p.max(0)
        samples.append({'phase':float(phase),'min':low.tolist(),'max':high.tolist(),'edge_stretch_p99':float(np.percentile(ratio,99)), 'feet_game_y':float((low[2]*2.6+1.3021823167800903)*1.04)})
    report['clips'][name]=samples
assert report['bones']==20 and report['triangles']==298498
(WORK/'deformation-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({name:{'p99_max':max(s['edge_stretch_p99'] for s in samples),'feet_min':min(s['feet_game_y'] for s in samples),'feet_max':max(s['feet_game_y'] for s in samples)} for name,samples in report['clips'].items()}),flush=True)
