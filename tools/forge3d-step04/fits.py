import bpy, sys, numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source as studio
studio.WORK=ROOT/'artifacts/asset-audit'
for asset in ['06','07','08']:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'work/forge3d-step04/asset-{asset}-raw.blend'))
    studio.render(f'asset-{asset}-side',(2,0,.05))
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    p=np.array([v.co[:] for v in mesh.data.vertices])
    print('FIT',asset,flush=True)
    for a,b in [(.26,.3),(.20,.25),(.12,.16),(.01,.04),(-.05,-.01),(-.25,-.2),(-.45,-.4)]:
        q=p[(p[:,2]>a)&(p[:,2]<b)]
        print(a,b,'x/y',q.min(0)[:2],q.max(0)[:2],flush=True)
