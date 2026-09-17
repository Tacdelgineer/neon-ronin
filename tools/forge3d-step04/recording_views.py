"""Refresh wireframe screenshots from the selected optimized checkpoints."""
import bpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source as studio
studio.WORK=ROOT/'artifacts/asset-audit'
for name in ['enemy-a','enemy-b']:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'work/forge3d-step04/{name}-optimized.blend'))
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    wire=mesh.modifiers.new('Recording wireframe','WIREFRAME');wire.thickness=.0002
    studio.render(name+'-optimized-wire',(0,-2,.05))
