"""Fresh GLB re-import validation, adapted from Step 03's independent sampler."""
import bpy, sys, json, hashlib
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
from export_rigged import read_glb, image_bytes
OUT=ROOT/'artifacts/asset-audit';WORK=ROOT/'work/forge3d-step04'
inventory=json.loads((OUT/'inventory.json').read_text())
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hero','enemy-a','enemy-b']
for name in names:
    path=ROOT/f'public/assets/models/{name}-final.glb'
    report=json.loads((OUT/(name+'-report.json')).read_text())
    report['original_file']=report['original_file'].replace('\\','/')
    source=ROOT/report['original_file'];original,ob=read_glb(source);j,bb=read_glb(path)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==next(r['sha256'] for r in inventory if r['filename']==report['original_file'])
    assert j['materials']==original['materials']
    assert all(image_bytes(j,bb,i)==image_bytes(original,ob,i) for i in range(len(j['images'])))
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    rig.animation_data.use_nla=False
    sums=np.array([sum(g.weight for g in v.groups) for v in mesh.data.vertices])
    assert np.all(abs(sums-1)<.0001)
    assert len(rig.data.bones)==20
    rest=np.empty(len(mesh.data.vertices)*3);mesh.data.vertices.foreach_get('co',rest);rest=rest.reshape(-1,3)
    edge=np.empty(len(mesh.data.edges)*2,dtype=np.int32);mesh.data.edges.foreach_get('vertices',edge);edge=edge.reshape(-1,2)
    base=np.linalg.norm(rest[edge[:,0]]-rest[edge[:,1]],axis=1);valid=base>1e-5
    validation=dict(bones=len(rig.data.bones),triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons),unweighted=int(sum(sums<.999)),clips={})
    expected=['idle','run','attack','dodge'] if name=='hero' else ['idle','run','attack','hit','death']
    assert sorted(a['name'] for a in j['animations'])==sorted(expected)
    for clip in expected:
        action=next(a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_'))
        rig.animation_data.action=action;samples=[]
        for phase in np.linspace(0,1,9):
            frame=action.frame_range[0]+phase*(action.frame_range[1]-action.frame_range[0])
            bpy.context.scene.frame_set(int(frame),subframe=float(frame-int(frame)))
            ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=ev.to_mesh()
            p=np.empty(len(posed.vertices)*3);posed.vertices.foreach_get('co',p);p=p.reshape(-1,3);ev.to_mesh_clear()
            assert np.isfinite(p).all() and np.abs(p).max()<1.6
            ratio=np.linalg.norm(p[edge[:,0]]-p[edge[:,1]],axis=1)[valid]/base[valid]
            samples.append(dict(phase=float(phase),min=p.min(0).tolist(),max=p.max(0).tolist(),edge_stretch_p99=float(np.percentile(ratio,99)),feet_game_y=float((p[:,2].min()*2.6+1.3021823167800903)*1.04)))
        validation['clips'][clip]=samples
    validation['sockets']={o.name:list(o.location) for o in bpy.context.scene.objects if o.name.startswith('weapon_')}
    assert 'weapon_hand_r' in validation['sockets']
    if name=='hero':assert 'weapon_sheath' in validation['sockets']
    if name!='hero':
        # Metal must stay rigid within every triangle even in attack/death.
        assert all(s['edge_stretch_p99']<1.002 for samples in validation['clips'].values() for s in samples)
    (OUT/(name+'-validation.json')).write_text(json.dumps(validation,indent=2))
    print('VALIDATED',name,{clip:round(max(s['edge_stretch_p99'] for s in samples),3) for clip,samples in validation['clips'].items()},flush=True)
