"""Author four in-place clips for the checked-in Step 02 character. Blender 4.3.2."""
import bpy, sys, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'work/forge3d-step03';WORK.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools/forge3d-step02'))
import inspect_source, export_rigged
from rig import reset_pose
inspect_source.WORK=WORK;export_rigged.WORK=WORK
SOURCE=ROOT/'public/assets/models/neon-ronin-forge3d-rigged.glb'
DEST=ROOT/'public/assets/models/neon-ronin-forge3d-animated.glb'
FPS=30

def rotate(rig,name,angles):
    b=rig.pose.bones[name]
    rest=b.bone.matrix_local.to_3x3()
    q=Quaternion()
    for axis,deg in zip(((1,0,0),(0,1,0),(0,0,1)),angles):
        q=q@Quaternion(rest.inverted()@Vector(axis),math.radians(deg))
    b.rotation_quaternion=q

def position(rig,name,offset):
    b=rig.pose.bones[name];b.location=b.bone.matrix_local.to_3x3().inverted()@Vector(offset)

def world_rotation(rig,name,q):
    b=rig.pose.bones[name]
    basis=b.bone.matrix_local.to_quaternion()
    if b.parent:
        basis=b.parent.matrix.to_quaternion()@b.parent.bone.matrix_local.to_quaternion().inverted()@basis
    b.rotation_quaternion=basis.inverted()@q
    bpy.context.view_layer.update()

def planted_leg(rig,side,offset):
    """Two-bone placement baked into keys, no runtime IK or controller changes."""
    upper=rig.pose.bones['upper_leg.'+side];lower=rig.pose.bones['lower_leg.'+side]
    foot=rig.pose.bones['foot.'+side]
    a=upper.head.copy();target=foot.bone.head_local+Vector(offset)
    l1=(lower.bone.head_local-upper.bone.head_local).length
    l2=(foot.bone.head_local-lower.bone.head_local).length
    delta=target-a;distance=min(delta.length,l1+l2-.0001);direction=delta.normalized()
    bend=Vector((0,-1,0));bend=(bend-direction*bend.dot(direction)).normalized()
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    knee=a+direction*along+bend*math.sqrt(max(0,l1*l1-along*along))
    for bone,end in ((upper,knee),(lower,target)):
        start=bone.head.copy()
        rest=(bone.bone.tail_local-bone.bone.head_local).normalized()
        q=rest.rotation_difference((end-start).normalized())@bone.bone.matrix_local.to_quaternion()
        world_rotation(rig,bone.name,q)
    world_rotation(rig,foot.name,foot.bone.matrix_local.to_quaternion())

def envelope(t,keys):
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if t<=b:
            q=max(0,min(1,(t-a)/(b-a)));q=q*q*(3-2*q)
            return x+(y-x)*q
    return keys[-1][1]

def pose_clip(rig,name,t):
    reset_pose(rig)
    if name=='idle':
        breath=math.sin(t*math.tau)
        rotate(rig,'spine',(breath*.7,0,0));rotate(rig,'chest',(breath*.9,0,0))
        rotate(rig,'head',(-breath*.8,0,breath*.5))
        for side,sgn in [('R',1),('L',-1)]:
            rotate(rig,'upper_arm.'+side,(-2-breath,sgn*1.5,0))
            rotate(rig,'lower_arm.'+side,(-3-breath*.7,0,0))
    elif name=='run':
        phase=t*math.tau
        position(rig,'hips',(0,0,-.003-.008*math.cos(phase*2)))
        rotate(rig,'hips',(2,0,math.sin(phase)*3))
        rotate(rig,'spine',(5,0,-math.sin(phase)*2))
        rotate(rig,'chest',(2,0,-math.sin(phase)*2))
        rotate(rig,'head',(-5,0,math.sin(phase)))
        bpy.context.view_layer.update()
        for side,shift in [('R',0),('L',math.pi)]:
            p=phase+shift
            planted_leg(rig,side,(0,.145*math.cos(p),max(0,math.sin(p))*.03))
            rotate(rig,'upper_arm.'+side,(-6+math.cos(p)*20,3 if side=='R' else -3,0))
            rotate(rig,'lower_arm.'+side,(-25-max(0,-math.cos(p))*12,0,0))
    elif name=='attack':
        wind=envelope(t,[(0,0),(.16,1),(.32,0),(1,0)])
        strike=envelope(t,[(0,0),(.16,0),(.30,1),(.55,.75),(1,0)])
        rotate(rig,'hips',(0,0,-wind*5+strike*7))
        rotate(rig,'spine',(strike*3,0,-wind*7+strike*8))
        rotate(rig,'chest',(strike*2,0,-wind*8+strike*8))
        rotate(rig,'head',(0,0,wind*5-strike*8))
        rotate(rig,'upper_arm.R',(-wind*24-strike*42,wind*12+strike*18,wind*8-strike*12))
        rotate(rig,'lower_arm.R',(-wind*32-strike*26,0,0))
        rotate(rig,'hand.R',(0,strike*8,0))
        rotate(rig,'upper_arm.L',(-wind*12-strike*17,-4*(wind+strike),0))
        rotate(rig,'lower_arm.L',(-wind*24-strike*30,0,0))
        bpy.context.view_layer.update()
        for side in ['R','L']:planted_leg(rig,side,(0,0,0))
    elif name=='dodge':
        crouch=envelope(t,[(0,0),(.25,1),(.65,1),(1,0)])
        position(rig,'hips',(0,0,-.045*crouch))
        rotate(rig,'hips',(crouch*8,0,0));rotate(rig,'spine',(crouch*9,0,0))
        rotate(rig,'chest',(crouch*4,0,0));rotate(rig,'head',(-crouch*10,0,0))
        for side,sgn in [('R',1),('L',-1)]:
            rotate(rig,'upper_arm.'+side,(-crouch*23,sgn*crouch*6,0))
            rotate(rig,'lower_arm.'+side,(-crouch*38,0,0))
        bpy.context.view_layer.update()
        for side in ['R','L']:planted_leg(rig,side,(0,0,0))
    bpy.context.view_layer.update()

if __name__=='__main__':
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
    rig.show_in_front=True
    bpy.context.scene.render.fps=FPS
    rig.animation_data_create()
    clips={};report={}
    for name,frames in [('idle',72),('run',20),('attack',18),('dodge',9)]:
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
        for f in range(frames+1):
            pose_clip(rig,name,f/frames)
            for b in rig.pose.bones:
                b.keyframe_insert('rotation_quaternion',frame=f)
                b.keyframe_insert('location',frame=f)
        for curve in action.fcurves:
            for k in curve.keyframe_points:k.interpolation='LINEAR'
        clips[name]=action;report[name]={'frames':frames+1,'duration':frames/FPS,'fcurves':len(action.fcurves)}
    rig.animation_data.action=clips['idle'];bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=72
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(WORK/'blender-animated.glb'),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,
        export_force_sampling=True,export_frame_range=False,export_skins=True,export_def_bones=False,
        export_yup=True,export_apply=False,export_materials='EXPORT',export_image_format='AUTO')
    export_rigged.restore_original_textures(WORK/'blender-animated.glb',DEST)
    j,_=export_rigged.read_glb(DEST)
    assert sorted(a['name'] for a in j['animations'])==['attack','dodge','idle','run']
    assert sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])==298498
    report['source_sha256']=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    report['output_sha256']=hashlib.sha256(DEST.read_bytes()).hexdigest()
    report['file_bytes']=DEST.stat().st_size
    (WORK/'animation-report.json').write_text(json.dumps(report,indent=2))
    inspect_source.setup_studio()
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'neon-ronin-animated.blend'))
    for name,phases in [('idle',[.25]),('run',[0,.25,.5,.75]),('attack',[.16,.32,.55]),('dodge',[.5])]:
        rig.animation_data.action=clips[name]
        frames=report[name]['frames']-1
        for t in phases:
            bpy.context.scene.frame_set(round(t*frames))
            inspect_source.render(name+'-'+str(t),(.65,-2,.12),(.06,0,0))
            if name in ['run','dodge']:inspect_source.render(name+'-'+str(t)+'-side',(2,0,.05),(.06,0,0))
    print('ANIMATION_REPORT '+json.dumps(report),flush=True)
