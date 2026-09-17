"""Export this rig, then restore the source's exact WebP payloads and PBR JSON."""
import bpy,sys,json,struct,copy,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from inspect_source import ROOT,WORK,SOURCE
from rig import reset_pose

def read_glb(path):
    data=path.read_bytes();size,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    j=json.loads(data[20:20+size]);start=20+size
    n,kind=struct.unpack_from('<II',data,start);assert kind==0x004e4942
    return j,data[start+8:start+8+n]

def image_bytes(j,bin,i):
    v=j['bufferViews'][j['images'][i]['bufferView']]
    return bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]

def restore_original_textures(exported,destination):
    original,ob=read_glb(SOURCE);j,bb=read_glb(exported)
    old_images={i['bufferView'] for i in j.get('images',[])}
    views=[];binary=bytearray();mapping={}
    def append_view(data,description):
        binary.extend(b'\x00'*((-len(binary))%4))
        view=copy.deepcopy(description);view['buffer']=0;view['byteOffset']=len(binary);view['byteLength']=len(data)
        views.append(view);binary.extend(data);return len(views)-1
    for i,v in enumerate(j['bufferViews']):
        if i in old_images:continue
        start=v.get('byteOffset',0);mapping[i]=append_view(bb[start:start+v['byteLength']],v)
    for a in j['accessors']:
        if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
        assert 'sparse' not in a
    j['images']=copy.deepcopy(original['images'])
    for i,im in enumerate(j['images']):im['bufferView']=append_view(image_bytes(original,ob,i),{})
    for key in ('materials','textures','samplers'):
        if key in original:j[key]=copy.deepcopy(original[key])
        else:j.pop(key,None)
    j['extensionsUsed']=sorted(set(j.get('extensionsUsed',[])+original.get('extensionsUsed',[])))
    j['extensionsRequired']=sorted(set(j.get('extensionsRequired',[])+original.get('extensionsRequired',[])))
    j['bufferViews']=views;j['buffers']=[{'byteLength':len(binary)}]
    binary.extend(b'\x00'*((-len(binary))%4))
    js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    total=12+8+len(js)+8+len(binary)
    destination.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
    jj,nb=read_glb(destination)
    assert all(image_bytes(jj,nb,i)==image_bytes(original,ob,i) for i in range(2))
    report=dict(file_bytes=destination.stat().st_size,triangles=sum(jj['accessors'][p['indices']]['count']//3 for m in jj['meshes'] for p in m['primitives']),
        meshes=len(jj['meshes']),skins=len(jj['skins']),joints=[jj['nodes'][i]['name'] for i in jj['skins'][0]['joints']],
        animations=len(jj.get('animations',[])),images=[dict(mime=i['mimeType'],bytes=len(image_bytes(jj,nb,k)),sha256=hashlib.sha256(image_bytes(jj,nb,k)).hexdigest()) for k,i in enumerate(jj['images'])],
        source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),materials_exact=jj['materials']==original['materials'])
    (WORK/'export-report.json').write_text(json.dumps(report,indent=2))
    print('EXPORT_REPORT '+json.dumps(report),flush=True)
    return report

if __name__=='__main__':
    bpy.ops.wm.open_mainfile(filepath=str(WORK/'neon-ronin-rigged.blend'))
    rig=bpy.data.objects['NeonRoninRig'];mesh=bpy.data.objects['NeonRonin_Skinned']
    reset_pose(rig);bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    intermediate=WORK/'blender-export.glb'
    bpy.ops.export_scene.gltf(filepath=str(intermediate),export_format='GLB',use_selection=True,
        export_animations=False,export_skins=True,export_def_bones=False,export_yup=True,
        export_apply=False,export_image_format='AUTO',export_materials='EXPORT')
    restore_original_textures(intermediate,ROOT/'public/assets/models/neon-ronin-forge3d-rigged.glb')
