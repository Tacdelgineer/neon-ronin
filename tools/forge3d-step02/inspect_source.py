"""Asset-specific Step 02 inspection and preparation; run with Blender 4.3.2."""
import bpy, bmesh, json, math, sys, time
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work" / "forge3d-step02"
WORK.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / "public/assets/models/neon-ronin-forge3d.glb"

def load_source():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    return next(o for o in bpy.context.scene.objects if o.type == 'MESH')

def mesh_stats(obj):
    m = obj.data
    p = np.empty(len(m.vertices)*3, dtype=np.float32)
    m.vertices.foreach_get('co', p); p = p.reshape(-1,3)
    bm = bmesh.new(); bm.from_mesh(m)
    stats = dict(vertices=len(m.vertices), triangles=sum(len(f.vertices)-2 for f in m.polygons),
        bounds=[p.min(0).tolist(),p.max(0).tolist()], dimensions=(p.max(0)-p.min(0)).tolist(),
        location=list(obj.location), rotation=list(obj.rotation_euler), scale=list(obj.scale),
        custom_normals=m.has_custom_normals, uv_layers=len(m.uv_layers),
        boundary_edges=sum(e.is_boundary for e in bm.edges),
        non_manifold_edges=sum(not e.is_manifold for e in bm.edges),
        zero_area_faces=sum(f.calc_area()<1e-14 for f in bm.faces))
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    seen=set(); components=[]
    for v in bm.verts:
        if v.index in seen: continue
        stack=[v]; seen.add(v.index); verts=[]
        while stack:
            q=stack.pop(); verts.append(q)
            for e in q.link_edges:
                n=e.other_vert(q)
                if n.index not in seen: seen.add(n.index); stack.append(n)
        coords=np.array([v.co[:] for v in verts])
        components.append(dict(vertices=len(verts),min=coords.min(0).tolist(),max=coords.max(0).tolist()))
    stats['welded_topology'] = dict(vertices=len(bm.verts),components=len(components),
        boundary_edges=sum(e.is_boundary for e in bm.edges),
        non_manifold_edges=sum(not e.is_manifold for e in bm.edges),
        components_largest=sorted(components,key=lambda c:-c['vertices'])[:40])
    bm.free()
    return stats

def setup_studio():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=780;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world.color=(.16,.16,.16)
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='Medium High Contrast'
    for name,loc,power,size in [('Key',(-1.2,-1.8,1.5),110,2),('Fill',(1.5,-.7,.3),70,2),('Rim',(0,1.5,1),130,1.5)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('InspectionCamera')
    cam=bpy.data.objects.new('InspectionCamera',data);scene.collection.objects.link(cam)
    data.type='ORTHO';data.ortho_scale=1.18;scene.camera=cam
    return cam

def render(name, eye=(0,-2,.05),target=(0,0,0)):
    scene=bpy.context.scene;cam=scene.camera;cam.location=eye
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(WORK/(name+'.png'))
    bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    obj=load_source()
    stats=mesh_stats(obj)
    stats.update(blender=bpy.app.version_string,objects=len(bpy.context.scene.objects),
        meshes=len({o.data.as_pointer() for o in bpy.context.scene.objects if o.type=='MESH'}),materials=len(obj.data.materials),
        images=[dict(name=i.name,size=list(i.size),packed=bool(i.packed_file),colorspace=i.colorspace_settings.name)
                for i in bpy.data.images if i.type=='IMAGE'])
    (WORK/'source-audit.json').write_text(json.dumps(stats,indent=2))
    print('SOURCE_AUDIT '+json.dumps(stats),flush=True)
    setup_studio()
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'source-inspection.blend'))
    render('source-front')
    render('source-back',(0,2,.05))
    render('source-side',(2,0,.05))
