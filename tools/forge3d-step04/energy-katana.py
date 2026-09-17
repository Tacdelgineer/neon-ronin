"""Fit the supplied energy katana to the existing +Z hero hand socket; keep the source intact."""
import sys, hashlib, json
from pathlib import Path
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/forge3d-step04'))
from build import clear, load, coords, simplify
sys.path.insert(0, str(ROOT / 'tools/forge3d-step02'))
import export_rigged as exporter
import inspect_source as studio

source = ROOT / 'incoming-assets/ChatGPT Image Sep 17 2026 03_42_06 PM.glb'
checksum = hashlib.sha256(source.read_bytes()).hexdigest()
work = ROOT / 'work/forge3d-step04'
clear()
mesh = load(source)
source_triangles = len(mesh.data.polygons)
simplify(mesh, 18000)
p = coords(mesh)
q = p - p.mean(0)
_, vectors = np.linalg.eigh(q.T @ q)
axis = vectors[:, 2]
if axis[2] < 0:
    axis = -axis
lateral = vectors[:, 1]
normal = np.cross(axis, lateral)
t = q @ axis
low, high = np.quantile(t, [.0001, .9999])
pivot = low + (high - low) * .14
p = np.column_stack((q @ lateral, -(t - pivot), q @ normal)) * .66 / (high - low)
mesh.data.vertices.foreach_set('co', p.ravel())
mesh.data.update()
mesh.name = 'hero-energy-katana'
if mesh.data.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
for poly in mesh.data.polygons:
    poly.use_smooth = True
temp = work / 'hero-energy-katana-blender.glb'
bpy.ops.export_scene.gltf(filepath=str(temp), export_format='GLB', use_selection=True,
    export_animations=False, export_materials='EXPORT', export_image_format='AUTO')
exporter.SOURCE = source
exporter.WORK = work
dest = ROOT / 'public/assets/models/hero-energy-katana-final.glb'
report = exporter.restore_original_textures(temp, dest)
report.update(original_file=str(source.relative_to(ROOT)), source_sha256=checksum,
              source_triangles=source_triangles, output=str(dest.relative_to(ROOT)))
(ROOT / 'artifacts/asset-audit/hero-energy-katana-report.json').write_text(json.dumps(report, indent=2))
assert hashlib.sha256(source.read_bytes()).hexdigest() == checksum
studio.WORK = work
studio.setup_studio()
bpy.context.scene.camera.data.ortho_scale = .85
bpy.context.scene.cycles.samples = 8
bpy.context.scene.render.resolution_x = 512
bpy.context.scene.render.resolution_y = 512
studio.render('energy-katana-fit', (1, -1, 1), (0, -.2, 0))
