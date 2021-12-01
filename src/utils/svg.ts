import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { computeAABB } from "./math";

export function parseSVG(
  text: string,
  { ccw = true }: { color?: string | number; ccw?: boolean } = {}
): THREE.Object3D {
  let loader = new SVGLoader();

  const svgResult = loader.parse(text);
  const paths = svgResult.paths;
  const group = new THREE.Group();

  for (const path of paths) {
    let material = new THREE.MeshBasicMaterial({
      color: path.color,
      side: THREE.DoubleSide,
    });

    const shapes = path.toShapes(ccw);
    const geometry = new THREE.ShapeBufferGeometry(shapes);
    const mesh = new THREE.Mesh(geometry, material);

    let name = path.userData.node.id as string;

    // Remove prefix of MathJax "MJX-*-""
    name = name.replace(/MJX-\d-/g, "");

    mesh.name = name;
    group.add(mesh);
  }

  // Get bounding box of the whole object
  const aabb = computeAABB(group);

  const aabbCenter = new THREE.Vector3();
  aabb.getCenter(aabbCenter);

  const aabbSize = new THREE.Vector3();
  aabb.getSize(aabbSize);

  const geometryScale = 1 / 600;

  for (const object3d of group.children) {
    const mesh = object3d as THREE.Mesh;

    // Scale and translate geometry
    mesh.geometry.translate(-aabbCenter.x, -aabbCenter.y, -aabbCenter.z);
    mesh.geometry.scale(geometryScale, -geometryScale, geometryScale);

    // Set center of the subMesh to (0, 0)
    const center = new THREE.Vector3();
    mesh.geometry.boundingBox.getCenter(center);
    const d = mesh.geometry.boundingBox.getSize(new THREE.Vector3()).length();

    mesh.geometry.translate(-center.x, -center.y, -center.z);
    mesh.geometry.scale(1 / d, 1 / d, 1 / d);
    mesh.position.add(center);
    mesh.scale.set(d, d, d);
  }

  return group;
}
