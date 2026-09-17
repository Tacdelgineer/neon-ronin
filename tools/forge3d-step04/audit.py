"""Read-only batch audit; reuse the milestone studio and GLB reader."""
import bpy, sys, json, hashlib, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source as studio
from export_rigged import read_glb
OUT=ROOT/'artifacts/asset-audit';OUT.mkdir(parents=True,exist_ok=True)
WORK=ROOT/'work/forge3d-step04';WORK.mkdir(parents=True,exist_ok=True)
sources=sorted((ROOT/'incoming-assets').rglob('*.glb')) if (ROOT/'incoming-assets').exists() else sorted((ROOT/'docs').glob('*.glb'))
records=[]
for idx,path in enumerate(sources,1):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects=list(bpy.context.scene.objects);meshes=[o for o in objects if o.type=='MESH']
    points=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    j,_=read_glb(path)
    record=dict(id=f'asset-{idx:02}',filename=str(path.relative_to(ROOT)).replace('\\','/'),
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,
        dimensions_blender=list(hi-lo),bounds_blender=[list(lo),list(hi)],object_count=len(objects),
        mesh_count=len(meshes),source_triangles=sum(j['accessors'][p['indices']]['count']//3 if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']//3 for m in j['meshes'] for p in m['primitives']),
        imported_triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
        materials=j.get('materials',[]),textures=[dict(name=i.name,dimensions=list(i.size),colorspace=i.colorspace_settings.name) for i in bpy.data.images if i.type=='IMAGE'],
        skeleton=any(o.type=='ARMATURE' for o in objects),skin=bool(j.get('skins')),
        animation_clips=[a.get('name','unnamed') for a in j.get('animations',[])])
    # Normalize preview only to the existing one-unit studio; source bytes are untouched.
    root=bpy.data.objects.new('PreviewNormalization',None);bpy.context.scene.collection.objects.link(root)
    for o in objects:
        if o.parent is None:o.parent=root
    scale=1/max(hi-lo);root.scale=(scale,)*3;root.location=-(lo+hi)*.5*scale
    bpy.context.scene.world=bpy.data.worlds.new('AuditWorld')
    studio.WORK=OUT;studio.setup_studio()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
    scene.render.resolution_x=512;scene.render.resolution_y=512
    scene.camera.data.ortho_scale=1.22
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.12,.14,1)
    for view,eye in [('front',(0,-2,.05)),('angle',(1,-2,.22)),('back',(0,2,.05))]:
        studio.render(record['id']+'-'+view,eye)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(record['id']+'-raw.blend')))
    record['previews']=[f'artifacts/asset-audit/{record["id"]}-{v}.png' for v in ['front','angle','back']]
    records.append(record)
    (OUT/'inventory.json').write_text(json.dumps(records,indent=2))
    print('AUDITED',record['id'],path.name,record['source_triangles'],flush=True)
