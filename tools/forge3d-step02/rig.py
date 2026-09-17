"""Fit a small deform armature to this asset's native asymmetric standing pose."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector,Quaternion
sys.path.insert(0,str(Path(__file__).parent))
from inspect_source import ROOT,WORK,render
# Blender coordinates: X right in the front view, -Y forward, Z up.
BONES=[
('root',(.095,0,-.500839),(.095,0,-.41),None),
('hips',(.095,.012,-.015),(.095,.012,.075),'root'),
('spine',(.095,.012,.075),(.095,.012,.16),'hips'),
('chest',(.095,.012,.16),(.095,.012,.265),'spine'),
('neck',(.095,.005,.265),(.095,.002,.322),'chest'),
('head',(.095,.002,.322),(.095,.012,.445),'neck'),
('clavicle.R',(.095,.01,.245),(-.005,.02,.247),'chest'),
('upper_arm.R',(-.005,.02,.247),(-.056,.005,.150),'clavicle.R'),
('lower_arm.R',(-.056,.005,.150),(-.082,0,.026),'upper_arm.R'),
('hand.R',(-.082,0,.026),(-.077,0,-.068),'lower_arm.R'),
('clavicle.L',(.095,.01,.245),(.191,.02,.25),'chest'),
('upper_arm.L',(.191,.02,.25),(.230,.023,.150),'clavicle.L'),
('lower_arm.L',(.230,.023,.150),(.266,.035,.027),'upper_arm.L'),
('hand.L',(.266,.035,.027),(.275,.035,-.068),'lower_arm.L'),
('upper_leg.R',(.045,.018,-.025),(-.012,.012,-.235),'hips'),
('lower_leg.R',(-.012,.012,-.235),(-.041,.02,-.434),'upper_leg.R'),
('foot.R',(-.041,.02,-.434),(-.055,-.103,-.475),'lower_leg.R'),
('upper_leg.L',(.145,.018,-.025),(.193,.012,-.235),'hips'),
('lower_leg.L',(.193,.012,-.235),(.226,.02,-.434),'upper_leg.L'),
('foot.L',(.226,.02,-.434),(.246,-.103,-.475),'lower_leg.L'),
]
def reset_pose(rig):
    for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
def rotate(rig,name,axis,deg):
    b=rig.pose.bones[name]
    local=b.bone.matrix_local.to_3x3().inverted()@Vector(axis)
    b.rotation_quaternion=Quaternion(local,math.radians(deg))
def pose(rig,name):
    reset_pose(rig)
    if name=='raised':
        rotate(rig,'upper_arm.R',(0,1,0),70);rotate(rig,'upper_arm.L',(0,1,0),-70)
    elif name=='step':
        rotate(rig,'upper_leg.L',(1,0,0),-32);rotate(rig,'lower_leg.L',(1,0,0),25)
        rotate(rig,'upper_arm.R',(1,0,0),-20)
    elif name=='knees':
        for side in ('L','R'):
            rotate(rig,'upper_leg.'+side,(1,0,0),-30);rotate(rig,'lower_leg.'+side,(1,0,0),65)
            rotate(rig,'foot.'+side,(1,0,0),-25)
    elif name=='attack':
        rotate(rig,'chest',(0,0,1),-25);rotate(rig,'upper_arm.R',(1,0,0),-65)
        rotate(rig,'lower_arm.R',(1,0,0),-65);rotate(rig,'upper_arm.L',(1,0,0),-30)
        rotate(rig,'lower_arm.L',(1,0,0),-45)
    bpy.context.view_layer.update()

if __name__=='__main__':
    bpy.ops.wm.open_mainfile(filepath=str(WORK/'optimized-300000.blend'))
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    arm=bpy.data.armatures.new('NeonRoninHumanoid')
    rig=bpy.data.objects.new('NeonRoninRig',arm);bpy.context.scene.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name,head,tail,parent in BONES:
        b=arm.edit_bones.new(name);b.head=head;b.tail=tail;b.use_deform=(name!='root')
        if parent:b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;arm.display_type='OCTAHEDRAL'
    mesh.select_set(True)
    outcome='completed'
    try:bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except RuntimeError as e:outcome=str(e)
    totals=[sum(g.weight for g in v.groups) for v in mesh.data.vertices]
    outcome='heat weighting produced no weights' if not any(totals) else outcome
    report=dict(auto_weight_result=outcome,bones=[b[0] for b in BONES],unweighted=sum(v<1e-6 for v in totals),
                vertices=len(totals),weight_sum_min=min(totals),weight_sum_max=max(totals))
    (WORK/'auto-weight-report.json').write_text(json.dumps(report,indent=2))
    print('AUTO_WEIGHTS '+json.dumps(report),flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'rig-auto.blend'))
    pose(rig,'raised');render('auto-raised')
    pose(rig,'step');render('auto-step',(1,-2,.2))
