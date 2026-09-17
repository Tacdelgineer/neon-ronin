"""Conservative, UV-preserving simplification trials for this character only."""
import sys,json,bpy,bmesh
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from inspect_source import ROOT,WORK,render
bpy.ops.wm.open_mainfile(filepath=str(WORK/'source-inspection.blend'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
# A duplicate datablock preserves the imported reference.
source=obj.data
working=source.copy();obj.data=working
bm=bmesh.new();bm.from_mesh(working)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8)
bm.to_mesh(working);bm.free();working.update()
base_faces=len(working.polygons)
results=[]
for target in (300000,150000):
    obj.data=working.copy()
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Conservative collapse','DECIMATE')
    mod.decimate_type='COLLAPSE';mod.ratio=target/base_faces;mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.name='NeonRonin_Optimized'
    triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    results.append(dict(target=target,triangles=triangles,vertices=len(obj.data.vertices)))
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/f'optimized-{target}.blend'))
    render(f'optimized-{target}-front')
    render(f'optimized-{target}-side',(2,0,.05))
(WORK/'optimization.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results))
