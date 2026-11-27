"""Build the private Blender workshop from the customer starter meshes.

blender -b -P blender_project.py -- /path/to/Eldritch_Fable_Print_Workshop.blend
"""
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector

MODELS = {
    "watchtower": "Crenellated watchtower",
    "cottage": "Timber cottage",
    "elder": "Elder oak",
    "fir": "Mountain fir",
    "foliage": "Ferns and mushrooms",
    "oathkeeper": "Oathkeeper",
    "briar-scout": "Briar Scout",
}
GUIDE = """Eldritch Fable print workshop

Each starter has its own scene. Use the Scene selector at the top right to switch.
The models share the studio defaults of 40 mm longest dimension and 6 mm base.
Each model sits at the origin with the bottom on Z = 0. One grid unit is 1 mm.

Edit your copy in Blender
1. Choose a scene. Use Tab for Edit Mode, or choose Sculpt Mode.
2. Use File > Save As to keep your own .blend master.
3. In Object Mode, select just the finished model. Choose File > Export > Wavefront (.obj).
   Turn on Selection Only, use scale 1, Forward Y, Up Z, and apply modifiers.
4. Open https://eldritchfable.com/print-studio/#upload in your signed-in browser.
   Choose the OBJ and enter its intended longest dimension in millimeters.
   Submit for inspection before requesting a print quote.

The OBJ upload is private to your account. Editing this file does not publish a
model to the customer workbench or place an order.
"""


def read_surface(path, length=40, base_mm=6):
    data = path.read_bytes()
    magic, count, faces, base = struct.unpack_from("<4sHHf", data)
    if magic != b"EFM1" or len(data) != 12 + 12 * count + 6 * faces:
        raise ValueError(f"Invalid studio mesh: {path.name}")
    end = 12 + 12 * count
    raw = [(x / 1e6, y / 1e6, z / 1e6)
           for x, y, z in struct.iter_unpack("<iii", data[12:end])]
    height = max(z for x, y, z in raw)
    def sized_z(z):
        if z <= base:
            return base_mm * z / base
        return base_mm + (length * height - base_mm) * (z - base) / (height - base)
    vertices = [(length * x, length * y, sized_z(z)) for x, y, z in raw]
    return vertices, list(struct.iter_unpack("<HHH", data[end:]))


def build(output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    window = bpy.context.window
    root = Path(__file__).resolve().parents[1] / "models"
    first_scene = window.scene
    for slug, title in MODELS.items():
        scene = first_scene if slug == "watchtower" else bpy.data.scenes.new(title)
        scene.name = title
        window.scene = scene
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.scale_length = .001
        scene.unit_settings.length_unit = 'MILLIMETERS'
        vertices, faces = read_surface(root / (slug + ".mesh"))
        mesh = bpy.data.meshes.new(title)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(title, mesh)
        scene.collection.objects.link(obj)
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    window.scene = first_scene
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.region_3d.view_distance = 83
                space.region_3d.view_location = (0, 0, 19)
                space.region_3d.view_rotation = Vector((.55, -1, .38)).to_track_quat('Z','Y')
                space.region_3d.view_perspective = 'ORTHO'
                space.clip_end = 2000
                space.shading.light = 'STUDIO'
                space.shading.show_cavity = True
                space.overlay.show_floor = False
    bpy.data.texts.new("Workshop guide").write(GUIDE)
    bpy.ops.wm.save_as_mainfile(filepath=str(output.resolve()), compress=True)


if __name__ == "__main__":
    build(Path(sys.argv[sys.argv.index("--") + 1]))
