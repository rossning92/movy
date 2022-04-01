import * as THREE from 'three';
import { SVGLoader, SVGResult } from 'three/examples/jsm/loaders/SVGLoader';
import { toThreeColor } from './color';
import { computeAABB } from './math';

interface SVGParameters {
  color?: string | number;
  ccw?: boolean;
  opacity?: number;
}

function createSVGObject(svgResult: SVGResult, params: SVGParameters = {}) {
  const paths = svgResult.paths;
  const group = new THREE.Group();

  for (const path of paths) {
    const material = new THREE.MeshBasicMaterial({
      color: params.color !== undefined ? toThreeColor(params.color) : path.color,
      side: THREE.DoubleSide,
      opacity: params.opacity || 1.0,
      transparent: params.opacity !== undefined && params.opacity < 1,
    });

    const shapes = path.toShapes(params.ccw !== undefined ? params.ccw : true);
    const geometry = new THREE.ShapeBufferGeometry(shapes);
    const mesh = new THREE.Mesh(geometry, material);

    let name = path.userData.node.id as string;
    mesh.name = name;

    {
      // HACK: turn off the blending for matrix brackets, as this will cause
      // artifacts during fade in animation.
      if (name.includes('TEX-S4-23A2') || name.includes('TEX-S4-23A5')) {
        material.blending = THREE.CustomBlending;
        material.blendEquation = THREE.AddEquation;
        material.blendSrc = THREE.SrcAlphaFactor;
        material.blendDst = THREE.DstColorFactor;
      }
    }

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
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());

    // Center geometry and normalize its size
    mesh.geometry.translate(-center.x, -center.y, -center.z);
    mesh.geometry.scale(1 / size.x, 1 / size.y, 1);
    mesh.position.add(center);
    mesh.scale.set(size.x, size.y, 1);
  }

  return group;
}

export async function loadSVG(url: string, params: SVGParameters = {}): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    let loader = new SVGLoader();
    loader.load(
      url,
      function (results) {
        resolve(createSVGObject(results, params));
      },
      function (xhr) {
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      function (error) {
        console.log('An error happened');
        reject(error);
      }
    );
  });
}

export function parseSVG(text: string, params: SVGParameters = {}): THREE.Object3D {
  let loader = new SVGLoader();
  const svgResult = loader.parse(text);
  return createSVGObject(svgResult, params);
}
