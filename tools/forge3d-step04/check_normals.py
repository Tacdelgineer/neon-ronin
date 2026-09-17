import bpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source as studio
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'work/forge3d-step04/enemy-a-optimized.blend'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=mesh
if mesh.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
for p in mesh.data.polygons:p.use_smooth=True
studio.WORK=ROOT/'artifacts/asset-audit';studio.render('enemy-a-recalculated-normals',(.6,-2,.08))
