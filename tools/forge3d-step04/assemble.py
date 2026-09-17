"""Recording scenes with actual exported weapons attached to the named sockets."""
import bpy,sys,json
from pathlib import Path
from mathutils import Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'work/forge3d-step04';OUT=ROOT/'artifacts/asset-audit'
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source as studio
studio.WORK=OUT
bindings={
 'hero':[('weapon_hand_r','hero-katana'),('weapon_sheath','hero-sheath')],
 'enemy-a':[('weapon_hand_r','enemy-a-cannon'),('weapon_sheath','enemy-a-shield')],
 'enemy-b':[('weapon_hand_r','enemy-b-blade')],
}
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(bindings)
for name in names:
    bpy.ops.wm.open_mainfile(filepath=str(WORK/(name+'-final.blend')))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    weapons={}
    for socket,weapon in bindings[name]:
        before=set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/assets/models/{weapon}-final.glb'))
        new=set(bpy.context.scene.objects)-before
        marker=bpy.data.objects[socket]
        for obj in new:
            if obj.parent is None:
                local=obj.matrix_world.copy();obj.parent=marker;obj.matrix_parent_inverse=Matrix.Identity(4);obj.matrix_basis=local
        weapons[weapon]=list(new)
    clips={clip:next(a for a in bpy.data.actions if a.name==clip) for clip in (['idle','run','attack','dodge'] if name=='hero' else ['idle','run','attack','hit','death'])}
    rig.animation_data.action=clips['idle'];bpy.context.scene.frame_set(0)
    if name=='hero':
        for obj in weapons['hero-katana']:obj.hide_render=True;obj.hide_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-attachments.blend')))
    for clip,phase in [('idle',.25),('run',.25),('attack',.30),('dodge',.5)] if name=='hero' else [('idle',.25),('run',.25),('attack',.35),('hit',.5),('death',1)]:
        rig.animation_data.action=clips[clip];bpy.context.scene.frame_set(round(clips[clip].frame_range[1]*phase))
        if name=='hero':
            for obj in weapons['hero-katana']:obj.hide_render=clip!='attack';obj.hide_set(clip!='attack')
            for obj in weapons['hero-sheath']:obj.hide_render=clip=='attack';obj.hide_set(clip=='attack')
        bpy.context.scene.camera.data.ortho_scale=1.55 if clip=='attack' else 1.22
        studio.render(name+'-equipped-'+clip,(.65,-2,.1))
        if clip=='idle':
            scene=bpy.context.scene;w=scene.render.resolution_x;h=scene.render.resolution_y
            def project(point):
                v=world_to_camera_view(scene,scene.camera,rig.matrix_world@point)
                return [v.x*w,(1-v.y)*h]
            (OUT/(name+'-armature-projection.json')).write_text(json.dumps(dict(width=w,height=h,bones=[dict(name=b.name,head=project(b.head),tail=project(b.tail)) for b in rig.pose.bones]),indent=2))
        if clip=='attack':bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+'-combat.blend')))
