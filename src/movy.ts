/**
 * @file The main file that implements all movy.js APIs.
 * @author Ross Ning
 */

import * as dat from "dat.gui";
import gsap from "gsap";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";
import { WEBGL } from "three/examples/jsm/WebGL.js";
import { toThreeColor } from "utils/color";
import { createTexObject } from "utils/tex";
import TextMeshObject from "./objects/TextMeshObject";
import "./style/player.css";
import { GlitchPass } from "./utils/GlitchPass";
import WebmMediaRecorder from "./utils/WebmMediaRecorder";

const DEFAULT_LINE_WIDTH = 0.02;
const defaultEase = "power2.out";
const DEG2RAD = Math.PI / 180;

declare class CCapture {
  constructor(params: any);
}

gsap.ticker.remove(gsap.updateRoot);

let isRunning = false;

let glitchPassEnabled = false;
let renderTargetWidth = 1920;
let renderTargetHeight = 1080;
let motionBlurSamples = 1;
let bloomEnabled = false;
let globalTimeline = gsap.timeline({ onComplete: stopRender });
const mainTimeline = gsap.timeline();
let stats: Stats;
let capturer: CCapture;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;

let currentLayer = "default";
let scene = new THREE.Scene();
let camera: THREE.Camera;
let uiScene = new THREE.Scene();
let uiCamera: THREE.Camera;
let renderTarget: THREE.WebGLMultisampleRenderTarget;

let lightGroup: THREE.Group;
let cameraControls: OrbitControls;
let glitchPass: any;
let gridHelper: THREE.GridHelper;
let backgroundAlpha = 1.0;
let fxaaEnabled: boolean = false;

let lastTimestamp: number;
let timeElapsed = 0;

let recorder: WebmMediaRecorder;

const animationCallbacks: ((t: number) => void)[] = [];

globalTimeline.add(mainTimeline, "0");

let options = {
  format: "webm",
  framerate: 30,
  render: function () {
    startRender();
  },
  timeline: 0,
};

const gui = new dat.GUI();
gui.add(options, "format", ["webm", "webm-fast", "png"]);
gui.add(options, "framerate", [10, 25, 30, 60, 120]);
gui.add(options, "render");

const seedrandom = require("seedrandom");
let rng = seedrandom("hello.");

const commandQueue: Function[] = [];

function startRender({ resetTiming = true, name = document.title } = {}) {
  if (gridHelper !== undefined) {
    gridHelper.visible = false;
  }

  if (resetTiming) {
    // Reset gsap
    gsap.ticker.remove(gsap.updateRoot);

    lastTimestamp = undefined;
  }

  if (options.format == "webm-fast") {
    if (!recorder) {
      recorder = new WebmMediaRecorder({ name, framerate: options.framerate });
    }
    recorder.start();
  } else {
    capturer = new CCapture({
      verbose: true,
      display: false,
      framerate: options.framerate,
      motionBlurFrames: motionBlurSamples,
      quality: 100,
      format: options.format,
      workersPath: "dist/src/",
      timeLimit: 0,
      frameLimit: 0,
      autoSaveTime: 0,
      name,
    });
    (capturer as any).start();
  }

  (window as any).movy.isRendering = true;
}

(window as any).movy = {
  startRender,
  isRendering: false,
};

function stopRender() {
  if (options.format == "webm-fast") {
    if (recorder) {
      recorder.stop();
    }
  } else {
    if (capturer) {
      (capturer as any).stop();
      (capturer as any).save();
      capturer = undefined;
    }
  }

  (window as any).movy.isRendering = false;
}

function createOrthographicCamera() {
  const aspect = renderTargetWidth / renderTargetHeight;
  const viewportHeight = 10;
  const camera = new THREE.OrthographicCamera(
    (viewportHeight * aspect) / -2,
    (viewportHeight * aspect) / 2,
    viewportHeight / 2,
    viewportHeight / -2,
    -1000,
    1000
  );

  camera.position.set(0, 0, 10);
  return camera;
}

function createPerspectiveCamera(): THREE.Camera {
  // This will ensure the size of 10 in the vertical direction.
  const camera = new THREE.PerspectiveCamera(
    60,
    renderTargetWidth / renderTargetHeight,
    0.1,
    5000
  );
  camera.position.set(0, 0, 8.66);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  return camera;
}

function setupScene() {
  if (WEBGL.isWebGL2Available() === false) {
    document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
    return;
  }

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    alpha: true,
  });
  renderer.localClippingEnabled = true;
  renderer.setSize(renderTargetWidth, renderTargetHeight);
  renderer.setClearColor(0x000000, backgroundAlpha);
  document.body.appendChild(renderer.domElement);

  {
    stats = Stats();
    // stats.showPanel(1); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
  }

  scene.background = new THREE.Color(0);

  if (!camera) {
    camera = createOrthographicCamera();
  }

  uiCamera = createOrthographicCamera();

  cameraControls = new OrbitControls(camera, renderer.domElement);

  // Create multi-sample render target in order to reduce aliasing (better
  // quality than FXAA).
  renderTarget = new THREE.WebGLMultisampleRenderTarget(
    renderTargetWidth,
    renderTargetHeight
  );
  renderTarget.samples = 8; // TODO: don't hardcode

  composer = new EffectComposer(renderer, renderTarget);
  composer.setSize(renderTargetWidth, renderTargetHeight);

  // Glitch pass
  if (glitchPassEnabled) {
    glitchPass = new GlitchPass();
    composer.addPass(glitchPass);
  }

  // Always use a render pass for gamma correction. This avoid adding an extra
  // copy pass to resolve MSAA samples.
  composer.insertPass(new ShaderPass(GammaCorrectionShader), 1);

  // Bloom pass
  if (bloomEnabled) {
    let bloomPass = new UnrealBloomPass(
      new THREE.Vector2(renderTargetWidth, renderTargetHeight),
      0.5, // Strength
      0.4, // radius
      0.85 // threshold
    );
    composer.addPass(bloomPass);

    // TODO: find a better way to remove the aliasing introduced in BloomPass.
    fxaaEnabled = true;
  }

  if (fxaaEnabled) {
    const fxaaPass = new ShaderPass(FXAAShader);
    const ratio = renderer.getPixelRatio();
    fxaaPass.uniforms["resolution"].value.x = 1 / (renderTargetWidth * ratio);
    fxaaPass.uniforms["resolution"].value.y = 1 / (renderTargetHeight * ratio);
    composer.addPass(fxaaPass);
  }
}

function animate() {
  // time /* `time` parameter is buggy in `ccapture`. Do not use! */
  const nowInSecs = Date.now() / 1000;

  requestAnimationFrame(animate);

  let delta: number;
  {
    // Compute `timeElapsed`. This works for both animation preview and capture.
    if (lastTimestamp === undefined) {
      delta = 0.000001;
      lastTimestamp = nowInSecs;
      globalTimeline.seek(0, false);
    } else {
      delta = nowInSecs - lastTimestamp;
      lastTimestamp = nowInSecs;
    }

    timeElapsed += delta;
  }

  gsap.updateRoot(timeElapsed);

  // Call animation callbacks for custom animation.
  for (const callback of animationCallbacks) {
    callback(timeElapsed);
  }

  // cameraControls.update();

  renderer.setRenderTarget(renderTarget);

  // Render scene
  renderer.render(scene, camera);

  // Render UI on top of the scene
  renderer.autoClearColor = false;
  renderer.render(uiScene, uiCamera);
  renderer.autoClearColor = true;

  renderer.setRenderTarget(null);

  // Post processing
  composer.readBuffer = renderTarget;
  composer.render();

  stats.update();

  if (capturer) (capturer as any).capture(renderer.domElement);
}

interface MoveCameraParameters extends Transform, AnimationParameters {
  lookAt?: { x?: number; y?: number; z?: number } | number[];
  fov?: number;
  zoom?: number;
}
export function cameraMoveTo(params: MoveCameraParameters = {}) {
  commandQueue.push(() => {
    const { t, lookAt, duration = 0.5, ease = "expo.out", fov, zoom } = params;

    const tl = gsap.timeline({
      defaults: {
        duration,
        ease,
        onUpdate: () => {
          // Keep looking at the target while camera is moving.
          if (lookAt) {
            camera.lookAt(toThreeVector3(lookAt));
          }
        },
      },
    });

    if (camera instanceof THREE.PerspectiveCamera) {
      const perspectiveCamera = camera as THREE.PerspectiveCamera;

      // Animate FoV
      if (fov !== undefined) {
        tl.to(
          perspectiveCamera,
          {
            fov,
            onUpdate: () => {
              perspectiveCamera.updateProjectionMatrix();
            },
          },
          "<"
        );
      }
    }

    createTransformAnimation({
      ...params,
      tl,
      object3d: camera,
      preScale: new THREE.Vector3(1, 1, 1),
    });

    if (zoom !== undefined) {
      tl.to(
        camera,
        {
          zoom,
          onUpdate: () => {
            (camera as any).updateProjectionMatrix();
          },
        },
        "<"
      );
    }

    mainTimeline.add(tl, t);
  });
}

export function generateRandomString(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function createLine3d(
  material: THREE.Material,
  {
    points = [],
    lineWidth = 0.1,
  }: {
    color: THREE.Color;
    points: THREE.Vector3[];
    lineWidth: number;
  }
) {
  if (points.length === 0) {
    points.push(new THREE.Vector3(-1.73, -1, 0));
    points.push(new THREE.Vector3(1.73, -1, 0));
    points.push(new THREE.Vector3(0, 2, 0));
    points.push(points[0]);
  }

  let lineColor = new THREE.Color(0xffffff);
  let style = SVGLoader.getStrokeStyle(
    lineWidth,
    lineColor.getStyle(),
    "miter",
    "butt",
    4
  );
  // style.strokeLineJoin = "round";
  let geometry = SVGLoader.pointsToStroke(points, style, 12, 0.001);

  let mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function getAllMaterials(object3d: THREE.Object3D): THREE.Material[] {
  const materials = new Set<THREE.Material>();

  const getMaterialsRecursive = (object3d: THREE.Object3D) => {
    const mesh = object3d as THREE.Mesh;
    if (mesh && mesh.material) {
      materials.add(mesh.material as THREE.Material);
    }

    if (object3d.children) {
      object3d.children.forEach((child) => {
        getMaterialsRecursive(child);
      });
    }
  };

  getMaterialsRecursive(object3d);
  return Array.from(materials);
}

function createFadeInAnimation(
  object3d: THREE.Object3D,
  { duration = 0.25, ease = "linear" }: AnimationParameters = {}
) {
  const tl = gsap.timeline();

  // Set initial visibility to false.
  object3d.visible = false;

  tl.set(object3d, { visible: true }, "<");

  const materials = getAllMaterials(object3d);
  for (const material of materials) {
    tl.set(material, { transparent: true, opacity: 0 }, "<");
    tl.to(
      material,
      {
        opacity: 1,
        duration,
        ease,
      },
      "<"
    );
  }

  return tl;
}

function createFadeOutAnimation(
  obj: THREE.Object3D,
  { duration = 0.25, ease = "linear" }: AnimationParameters = {}
): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { duration, ease } });

  const materials = getAllMaterials(obj);
  materials.forEach((material) => {
    material.transparent = true;
    tl.to(
      material,
      {
        opacity: 0,
      },
      "<"
    );
  });

  return tl;
}

function addDefaultLights() {
  if (lightGroup === undefined) {
    lightGroup = new THREE.Group();
    scene.add(lightGroup);

    if (0) {
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
      directionalLight.position.set(0.3, 1, 0.5);
      lightGroup.add(directionalLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); // soft white light
      lightGroup.add(ambientLight);
    } else {
      // Experiment with HemisphereLight
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
      directionalLight.position.set(0.3, 1, 0.5);
      lightGroup.add(directionalLight);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3f3f3f, 0.3);
      lightGroup.add(hemiLight);
    }
  }
}

function createExplosionAnimation(
  objectGroup: THREE.Object3D,
  {
    ease = "expo.out",
    duration = 2,
    minRotation = -4 * Math.PI,
    maxRotation = 4 * Math.PI,
    minRadius = 1,
    maxRadius = 4,
    minScale = 1,
    maxScale = 1,
    stagger = 0.03,
  } = {}
) {
  const tl = gsap.timeline({
    defaults: {
      duration,
      ease: ease,
    },
  });

  let delay = 0;
  objectGroup.children.forEach((child, i) => {
    const r = minRadius + (maxRadius - minRadius) * rng();
    const theta = rng() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    child.position.z += 0.01 * i; // z-fighting

    tl.fromTo(child.position, { x: 0, y: 0 }, { x, y }, delay);

    const rotation = minRotation + rng() * (maxRotation - minRotation);
    tl.fromTo(child.rotation, { z: 0 }, { z: rotation }, delay);

    const targetScale = child.scale.setScalar(
      minScale + (maxScale - minScale) * rng()
    );
    tl.fromTo(
      child.scale,
      { x: 0.001, y: 0.001, z: 0.001 },
      { x: targetScale.x, y: targetScale.y, z: targetScale.z },
      delay
    );

    delay += stagger;
  });

  return tl;
}

function createGroupFlyInAnimation(
  objectGroup: THREE.Object3D,
  { ease = "expo.out", duration = 1, stagger = 0 } = {}
) {
  const tl = gsap.timeline({
    defaults: {
      duration,
      ease: ease,
    },
  });

  let delay = 0;
  objectGroup.children.forEach((child) => {
    const targetScale = child.scale.clone().multiplyScalar(0.01);
    tl.from(
      child.scale,
      { x: targetScale.x, y: targetScale.y, z: targetScale.z },
      delay
    );

    delay += stagger;
  });

  return tl;
}

// Deprecated
function getCompoundBoundingBox(object3D: THREE.Object3D) {
  let box: THREE.Box3;
  object3D.traverse(function (obj3D: any) {
    const geometry = obj3D.geometry;
    if (geometry === undefined) {
      return;
    }
    geometry.computeBoundingBox();
    if (box === undefined) {
      box = geometry.boundingBox;
    } else {
      box.union(geometry.boundingBox);
    }
  });
  return box;
}

function _getNodeName(node: any): any {
  if (!node) return "";
  if (node.id) {
    return _getNodeName(node.parentNode) + "/" + node.id;
  } else {
    return _getNodeName(node.parentNode);
  }
}

async function loadSVG(
  url: string,
  { color, ccw = true }: { color?: string | number; ccw: boolean }
): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    // instantiate a loader
    let loader = new SVGLoader();

    // load a SVG resource
    loader.load(
      // resource URL
      url,
      // called when the resource is loaded
      function (data) {
        let paths = data.paths;

        let parentGroup = new THREE.Group();

        const unnamedGroup = new THREE.Group();
        parentGroup.add(unnamedGroup);

        for (let i = 0; i < paths.length; i++) {
          let path = paths[i];

          let material = new THREE.MeshBasicMaterial({
            color: toThreeColor(
              color === undefined ? (path as any).color : color
            ),
            side: THREE.DoubleSide,
            // depthWrite: false,
          });

          const shapes = path.toShapes(ccw);

          let geometry = new THREE.ShapeBufferGeometry(shapes);

          let mesh = new THREE.Mesh(geometry, material);

          const name = _getNodeName((path as any).userData.node);

          if (name) {
            let group = parentGroup.children.filter((x) => x.name === name)[0];
            if (!group) {
              group = new THREE.Group();
              group.name = name;
              parentGroup.add(group);
            }

            group.add(mesh);
          } else {
            unnamedGroup.add(mesh);
          }
        }

        // Get bounding box of the whole object
        const box = getCompoundBoundingBox(parentGroup);

        const boxCenter = new THREE.Vector3();
        box.getCenter(boxCenter);

        const boxSize = new THREE.Vector3();
        box.getSize(boxSize);

        const scale = 1.0 / Math.max(boxSize.x, boxSize.y, boxSize.z);

        parentGroup.children.forEach((group) => {
          group.children.forEach((object3d) => {
            const subMesh = object3d as THREE.Mesh;

            // Scale and translate geometry
            subMesh.geometry.translate(
              -boxCenter.x,
              -boxCenter.y,
              -boxCenter.z
            );
            subMesh.geometry.scale(scale, -scale, scale);

            // Set center of the subMesh to (0, 0)
            const center = new THREE.Vector3();
            subMesh.geometry.boundingBox.getCenter(center);

            subMesh.geometry.translate(-center.x, -center.y, -center.z);
            subMesh.position.add(center);
          });
        });

        resolve(parentGroup);
      },
      // called when loading is in progresses
      function (xhr) {
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      // called when loading has errors
      function (error) {
        console.log("An error happened");
        reject(error);
      }
    );
  });
}

export function addGlitch({ duration = 0.2, t }: AnimationParameters = {}) {
  glitchPassEnabled = true;

  commandQueue.push(() => {
    const tl = gsap.timeline();
    tl.set(glitchPass, { factor: 1 });
    tl.set(glitchPass, { factor: 0 }, `<${duration}`);
    mainTimeline.add(tl, t);
  });
}

export function run() {
  if (isRunning) return;
  isRunning = true;
  (async () => {
    setupScene();

    for (const cmd of commandQueue) {
      if (typeof cmd === "function") {
        const ret = cmd();
        if (ret instanceof Promise) {
          await ret;
        }
      } else {
        throw `invalid command`;
      }
    }

    // Always Add 0.5s to the end of animation to avoid zero-length video.
    if (mainTimeline.duration() < Number.EPSILON) {
      mainTimeline.set({}, {}, "+=0.5");
    }

    {
      // Create timeline GUI

      options.timeline = 0;
      gui
        .add(options, "timeline", 0, globalTimeline.totalDuration())
        .onChange((val) => {
          globalTimeline.seek(val, false);
        });

      Object.keys(globalTimeline.labels).forEach((key) => {
        console.log(`${key} ${globalTimeline.labels[key]}`);
      });

      const folder = gui.addFolder("Timeline Labels");
      const labels: any = {};
      Object.keys(globalTimeline.labels).forEach((key) => {
        const label = key;
        const time = globalTimeline.labels[key];

        console.log(this);
        labels[label] = () => {
          globalTimeline.seek(time, false);
        };
        folder.add(labels, label);
      });
    }

    if (0) {
      // Grid helper
      const size = 20;
      const divisions = 20;
      const colorCenterLine = "#008800";
      const colorGrid = "#888888";

      gridHelper = new THREE.GridHelper(
        size,
        divisions,
        new THREE.Color(colorCenterLine),
        new THREE.Color(colorGrid)
      );
      gridHelper.rotation.x = Math.PI / 2;
      scene.add(gridHelper);
    }

    // Start animation
    requestAnimationFrame(animate);
  })();
}

function createArrow2DGeometry(arrowLength: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    // prettier-ignore
    new THREE.BufferAttribute(new Float32Array([
      -0.5 * arrowLength, -0.5 * arrowLength, 0,
      0.5 * arrowLength, -0.5 * arrowLength, 0,
      0, 0.5 * arrowLength, 0
    ]), 3)
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createArrowLine2D(
  material: THREE.Material,
  {
    from = new THREE.Vector3(0, 0, 0),
    to = new THREE.Vector3(1, 0, 0),
    lineWidth = DEFAULT_LINE_WIDTH,
    arrowEnd = true,
    arrowStart = false,
  } = {}
) {
  const direction = new THREE.Vector3();
  direction.subVectors(to, from);
  const halfLength = direction.length() * 0.5;
  direction.subVectors(to, from).normalize();

  const center = new THREE.Vector3();
  center.addVectors(from, to).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion(); // create one and reuse it
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

  const group = new THREE.Group();

  let length = halfLength * 2;
  const arrowLength = lineWidth * 10;
  let offset = 0;

  {
    // Create line
    if (arrowEnd) {
      length -= arrowLength;
      offset -= 0.5 * arrowLength;
    }
    if (arrowStart) {
      length -= arrowLength;
      offset += 0.5 * arrowLength;
    }

    // const geometry = new THREE.CylinderGeometry(
    //   lineWidth / 2,
    //   lineWidth / 2,
    //   length,
    //   16
    // );

    const geometry = new THREE.PlaneGeometry(lineWidth, length);

    const line = new THREE.Mesh(geometry, material);
    line.position.copy(direction.clone().multiplyScalar(offset).add(center));
    line.setRotationFromQuaternion(quaternion);

    group.add(line);
  }

  // Create arrows
  for (let i = 0; i < 2; i++) {
    if (i === 0 && !arrowStart) continue;
    if (i === 1 && !arrowEnd) continue;

    // const geometry = new THREE.ConeGeometry(lineWidth * 2, arrowLength, 16);
    const geometry = createArrow2DGeometry(arrowLength);
    geometry.translate(0, -arrowLength / 2, 0);

    const arrow = new THREE.Mesh(geometry, material);
    arrow.setRotationFromQuaternion(quaternion);
    arrow.position.copy(i === 0 ? from : to);
    group.add(arrow);

    if (i === 0) arrow.rotateZ(Math.PI);
  }

  scene.add(group);
  return group;
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (texture) => {
      resolve(texture);
    });
  });
}

export function getPolygonVertices({ sides = 3, radius = 0.5 } = {}) {
  const verts = [];
  for (let i = 0; i < sides; i++) {
    verts.push([
      radius * Math.sin((2 * i * Math.PI) / sides),
      radius * Math.cos((2 * i * Math.PI) / sides),
      0,
    ]);
  }
  return verts;
}

export function getTriangleVertices({
  radius = 0.5,
}: { radius?: number } = {}) {
  return getPolygonVertices({ sides: 3, radius });
}

interface AnimationParameters {
  t?: number | string;
  duration?: number;
  ease?: string;
}

interface MoveObjectParameters extends Transform, AnimationParameters {}

interface Shake2DParameters extends AnimationParameters {
  interval?: number;
  strength?: number;
}

interface FadeObjectParameters extends AnimationParameters {
  opacity?: number;
}

interface WipeInParameters extends AnimationParameters {
  direction?: "up" | "down" | "left" | "right";
}

interface RevealParameters extends AnimationParameters {
  direction?: "up" | "down" | "left" | "right";
}

interface RotateParameters extends AnimationParameters {
  x?: number;
  y?: number;
  repeat?: number;
}

function createTransformAnimation({
  position,
  x,
  y,
  z,
  rx,
  ry,
  rz,
  sx,
  sy,
  sz,
  scale,
  tl,
  object3d,
  preScale = new THREE.Vector3(1, 1, 1),
}: {
  x?: number | ((t: number) => number);
  y?: number | ((t: number) => number);
  z?: number | ((t: number) => number);
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  position?: [number, number] | [number, number, number];
  scale?: number;

  tl: gsap.core.Timeline;
  object3d: THREE.Object3D;
  preScale?: THREE.Vector3;
}) {
  if (position) {
    const p = toThreeVector3(position);
    tl.to(object3d.position, { x: p.x, y: p.y, z: p.z }, "<");
  } else {
    if (x !== undefined) tl.to(object3d.position, { x }, "<");
    if (y !== undefined) tl.to(object3d.position, { y }, "<");
    if (z !== undefined) tl.to(object3d.position, { z }, "<");
  }

  if (rx !== undefined) tl.to(object3d.rotation, { x: rx }, "<");
  if (ry !== undefined) tl.to(object3d.rotation, { y: ry }, "<");
  if (rz !== undefined) tl.to(object3d.rotation, { z: rz }, "<");

  if (scale !== undefined) {
    tl.to(
      object3d.scale,
      {
        x: scale * preScale.x,
        y: scale * preScale.y,
        z: scale * preScale.z,
      },
      "<"
    );
  } else {
    if (sx !== undefined) tl.to(object3d.scale, { x: sx }, "<");
    if (sy !== undefined) tl.to(object3d.scale, { y: sy }, "<");
    if (sz !== undefined) tl.to(object3d.scale, { z: sz }, "<");
  }
}

function createLine(
  positions: number[],
  {
    lineWidth,
    color,
  }: { lineWidth?: number; color?: string | number; opacity?: number } = {}
) {
  const geometry = new LineGeometry();
  geometry.setPositions(positions);

  const material = new LineMaterial({
    color: toThreeColor(color).getHex(),
    linewidth: lineWidth || DEFAULT_LINE_WIDTH,
    worldUnits: true,
  });

  const line = new Line2(geometry, material);
  return { line, geometry, material };
}

class SceneObject {
  object3D: THREE.Object3D;
  children: SceneObject[] = [];

  private preScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);

  protected addObjectToScene(obj: SceneObject, transform: Transform) {
    if (transform.parent) {
      transform.parent.object3D.add(obj.object3D);
    } else {
      console.assert(obj.object3D);
      this.object3D.add(obj.object3D);
    }
  }

  private add3DGeometry(
    params: AddObjectParameters = {},
    geometry: THREE.BufferGeometry
  ) {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = true;
      const material = createMaterial(params);

      obj.object3D = new THREE.Mesh(geometry, material);

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  _addMesh(mesh: THREE.Mesh, params: AddObjectParameters = {}): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      addDefaultLights();

      obj.object3D = mesh;

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addGroup(params: AddGroupParameters = {}) {
    const obj = new GroupObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(() => {
      obj.object3D = new THREE.Group();

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  _add3DModel(url: string, params: AddObjectParameters = {}): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      addDefaultLights();

      const object = await loadObj(url);

      const aabb = getBoundingBox(object);
      const center = new THREE.Vector3();
      aabb.getCenter(center);
      object.position.sub(center);

      const group = new THREE.Group();
      group.add(object);

      if (params.wireframe) {
        const materials = getAllMaterials(object);
        for (const material of materials) {
          (material as any).wireframe = true;
        }
      }

      obj.object3D = group;
      updateTransform(group, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addCircle(params: AddCircleParameters = {}): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      const geometry = new THREE.CircleGeometry(params.radius || 0.5, 128);

      obj.object3D = new THREE.Mesh(geometry, material);

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addArrow(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddArrowParameters = {}
  ): SceneObject {
    // For back compat
    if (!Array.isArray(p1)) {
      params = p1;
      p1 = (params as any).from;
      p2 = (params as any).to;
    }

    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    const {
      lineWidth = DEFAULT_LINE_WIDTH,
      arrowStart = false,
      arrowEnd = true,
    } = params;

    commandQueue.push(async () => {
      addDefaultLights();

      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      obj.object3D = createArrowLine2D(material, {
        from: toThreeVector3(p1),
        to: toThreeVector3(p2),
        arrowStart,
        arrowEnd,
        lineWidth,
      });

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }


  addArc(
    startAngle: number,
    endAngle: number,
    radius = 1,
    params: AddLineParameters = {}
  ): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      addDefaultLights();

      if (params.lighting === undefined) params.lighting = false;

      const curve = new THREE.EllipseCurve(
        0,
        0,
        radius,
        radius,
        startAngle * DEG2RAD,
        endAngle * DEG2RAD,
        false,
        0
      );

      const points = curve.getSpacedPoints(64);
      const points2 = [];
      for (const pt of points) {
        points2.push(pt.x, pt.y, 0);
      }
      const { line } = createLine(points2, params);

      obj.object3D = line;
      updateTransform(obj.object3D, params);
      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addGrid(params: AddGridParameters = {}): SceneObject {
    const { gridSize = 10, color = 0xc0c0c0 } = params;

    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      obj.object3D = new THREE.GridHelper(
        gridSize,
        gridSize,
        0x00ff00,
        toThreeColor(color)
      );
      obj.object3D.rotation.x = Math.PI / 2;

      updateTransform(obj.object3D, params);
      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addImage(file: string, params: AddTextParameters = {}): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    const { color = "white", ccw = false, opacity = 1.0 } = params;

    commandQueue.push(async () => {
      if (file.endsWith(".svg")) {
        obj.object3D = await loadSVG(file, {
          ccw,
          color,
        });
      } else {
        const texture = await loadTexture(file);
        texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          opacity,
          color: toThreeColor(color),
        });

        const geometry = new THREE.PlaneBufferGeometry(1, 1);
        const mesh = new THREE.Mesh(geometry, material);

        const aspect = texture.image.width / texture.image.height;
        if (aspect > 1) {
          mesh.scale.y /= aspect;
        } else {
          mesh.scale.x *= aspect;
        }

        obj.object3D = mesh;
        obj.preScale = mesh.scale.clone();
      }

      updateTransform(obj.object3D, params);
      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addLine(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddLineParameters = {}
  ): SceneObject {
    // For back compat
    if (!Array.isArray(p1)) {
      params = p1;
      p1 = (params as any).from;
      p2 = (params as any).to;
    }

    return this.addPolyline([p1, p2], params);
    }

  // TODO: extract this into a separate class: LineObject
  verts: number[] = [];

  addPolyline(
    points:
      | [number, number, number?][]
      | ((t: number) => [number, number, number][]),
    params: AddLineParameters = {}
  ): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      let positions: number[];

      if (Array.isArray(points)) {
        positions = [];
        for (const pt of points) {
          positions.push(pt[0], pt[1], pt.length <= 2 ? 0 : pt[2]);
        }
      } else if (points instanceof Function) {
        positions = points(0).reduce((acc, val) => acc.concat(val), []);
        animationCallbacks.push((t) => {
          const positions = points(t).reduce((acc, val) => acc.concat(val), []);
          geometry.setPositions(positions);
        });
      }
      obj.verts = positions;

      const { geometry, line } = createLine(positions, params);
      obj.object3D = line;

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addPyramid(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.ConeGeometry(0.5, 1.0, 4, defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addCube(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    return this.add3DGeometry(params, geometry);
  }

  addSphere(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.SphereGeometry(
      0.5,
      defaultSeg(params),
      defaultSeg(params)
    );
    return this.add3DGeometry(params, geometry);
  }

  addCone(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.ConeGeometry(
      0.5,
      1.0,
      defaultSeg(params),
      defaultSeg(params)
    );
    return this.add3DGeometry(params, geometry);
  }

  addCylinder(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.CylinderGeometry(
      0.5,
      0.5,
      1,
      defaultSeg(params)
    );
    return this.add3DGeometry(params, geometry);
  }

  addTorus(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.TorusGeometry(
      0.375,
      0.125,
      defaultSeg(params),
      defaultSeg(params)
    );
    return this.add3DGeometry(params, geometry);
  }

  addCircleOutline(params: AddCircleOutlineParameters = {}) {
    const { lineWidth = DEFAULT_LINE_WIDTH, color } = params;

    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      const verts = getPolygonVertices({
        sides: 128,
        radius: params.radius || 0.5,
      });
      const v3d = verts.map((v) => new THREE.Vector3(v[0], v[1], v[2]));
      obj.object3D = createLine3d(material, {
        points: v3d.concat(v3d[0]),
        lineWidth,
        color: toThreeColor(color),
      });

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addRectOutline(params: AddOutlineParameters = {}) {
    const {
      width = 1,
      height = 1,
      lineWidth = DEFAULT_LINE_WIDTH,
      color,
    } = params;

    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      const halfWidth = width * 0.5;
      const halfHeight = height * 0.5;
      obj.object3D = createLine3d(material, {
        points: [
          new THREE.Vector3(-halfWidth, -halfHeight, 0),
          new THREE.Vector3(-halfWidth, halfHeight, 0),
          new THREE.Vector3(halfWidth, halfHeight, 0),
          new THREE.Vector3(halfWidth, -halfHeight, 0),
          new THREE.Vector3(-halfWidth, -halfHeight, 0),
        ],
        lineWidth,
        color: toThreeColor(color),
      });

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addRect(params: AddRectParameters = {}): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      const { width = 1, height = 1 } = params;
      const geometry = new THREE.PlaneGeometry(width, height);

      obj.object3D = new THREE.Mesh(geometry, material);

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addTriangle(params: AddTriangleParameters = {}): SceneObject {
    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      let verts = params.verts;
      if (!verts) {
        verts = getPolygonVertices();
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(verts.flat()), 3)
      );
      geometry.computeVertexNormals();

      obj.object3D = new THREE.Mesh(geometry, material);

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addTriangleOutline(params: AddOutlineParameters = {}) {
    const { lineWidth = DEFAULT_LINE_WIDTH, color } = params;

    const obj = new SceneObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial(params);

      const verts = getPolygonVertices();
      const v3d = verts.map((v) => new THREE.Vector3(v[0], v[1], v[2]));
      obj.object3D = createLine3d(material, {
        points: v3d.concat(v3d[0]),
        lineWidth,
        color: toThreeColor(color),
      });

      updateTransform(obj.object3D, params);

      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addText(text: string, params: AddTextParameters = {}): TextObject {
    const {
      color,
      letterSpacing,
      font,
      fontSize = 1,
      centerTextVertically,
    } = params;
    const obj = new TextObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      const material = createMaterial(params);

      const textObject = new TextMeshObject({
        font,
        color: toThreeColor(color),
        fontSize: fontSize,
        letterSpacing,
        centerTextVertically,
        material,
      });
      await textObject.init();
      await textObject.setText(text);
      obj.object3D = textObject as any;

      updateTransform(obj.object3D, params);
      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  addTex(tex: string, params: AddTextParameters = {}): TextObject {
    const obj = new TextObject();
    if (params.parent) {
      params.parent.children.push(obj);
    } else {
      this.children.push(obj);
    }

    commandQueue.push(async () => {
      const { color } = params;

      const parent = await createTexObject(tex, {
        color: "#" + toThreeColor(color as string).getHexString(),
      });
      obj.object3D = parent;

      updateTransform(obj.object3D, params);
      this.addObjectToScene(obj, params);
    });

    return obj;
  }

  moveTo(params: MoveObjectParameters = {}) {
    const { t, duration = 0.5, ease = "power2.out" } = params;

    commandQueue.push(() => {
      let tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      createTransformAnimation({
        ...params,
        tl,
        object3d: this.object3D,
        preScale: this.preScale,
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  scale(s: number, params: AnimationParameters = {}) {
    const { t, duration = 0.5, ease = "power2.out" } = params;

    commandQueue.push(() => {
      let tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      createTransformAnimation({
        scale: s,
        tl,
        object3d: this.object3D,
        preScale: this.preScale,
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  fadeIn({ duration = 0.25, ease = "linear", t }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = createFadeInAnimation(this.object3D, { duration, ease });
      mainTimeline.add(tl, t);
    });
    return this;
  }

  fadeOut(params: FadeObjectParameters = {}) {
    this.changeOpacity(params.opacity === undefined ? 0 : params.opacity, {
      ...params,
    });
    return this;
  }

  changeOpacity(
    opacity: number,
    { duration = 0.25, ease = "linear", t }: FadeObjectParameters = {}
  ) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      const materials = getAllMaterials(this.object3D);
      for (const material of materials) {
        tl.set(material, { transparent: true }, "<");
        tl.to(
          material,
          {
            opacity,
          },
          "<"
        );
      }

      if (opacity == 0) {
        tl.set(this.object3D, { visible: false }, ">");
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  changeColor(
    color: string | number,
    { duration = 0.25, ease = "power1.inOut", t }: AnimationParameters = {}
  ) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      const materials = getAllMaterials(this.object3D);
      for (const material of materials) {
        if ((material as any).color) {
          const destColor = toThreeColor(color);
          tl.to(
            (material as any).color,
            {
              r: destColor.r,
              g: destColor.g,
              b: destColor.b,
            },
            "<"
          );
        }
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotate({ t, duration = 5, ease = "none" }: RotateParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      tl.to(this.object3D.rotation, { y: duration }, "<");

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotate3D({
    t,
    duration = 5,
    repeat = 2,
    ease = "none",
    x = Math.PI * 2,
    y = -Math.PI * 2,
  }: RotateParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({
        defaults: { duration, ease, repeat: repeat ? repeat - 1 : undefined },
      });

      tl.to(this.object3D.rotation, { x, y }, "<");

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotateIn({ t, duration = 0.5, ease = "expo.out" }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      tl.from(this.object3D.rotation, { z: Math.PI * 4, duration }, "<");
      tl.from(
        this.object3D.scale,
        {
          x: Number.EPSILON,
          y: Number.EPSILON,
          z: Number.EPSILON,
          duration,
        },
        "<"
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  grow({ t }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline();

      tl.fromTo(
        this.object3D,
        { visible: false },
        { visible: true, duration: 0.001 },
        "<"
      );

      tl.from(
        this.object3D.scale,
        { x: 0.01, y: 0.01, z: 0.01, ease: "expo.out" },
        "<"
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  grow2({ t }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline();

      tl.fromTo(
        this.object3D,
        { visible: false },
        { visible: true, ease: "none", duration: 0.001 }
      );

      tl.from(
        this.object3D.scale,
        {
          x: 0.01,
          y: 0.01,
          z: 0.01,
          ease: "elastic.out(1, 0.75)",
          onStart: () => {
            this.object3D.visible = true;
          },
        },
        "<"
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  grow3({ t }: AnimationParameters = {}) {
    commandQueue.push(() => {
      mainTimeline.from(
        this.object3D.scale,
        {
          x: 0.01,
          y: 0.01,
          z: 0.01,
          ease: "elastic.out(1, 0.2)",
          duration: 1.0,
        },
        t
      );
    });
    return this;
  }

  flying({ t, duration = 5 }: AnimationParameters = {}) {
    const WIDTH = 30;
    const HEIGHT = 15;

    commandQueue.push(() => {
      const tl = gsap.timeline();

      this.object3D.children.forEach((x) => {
        tl.fromTo(
          x.position,
          {
            x: rng() * WIDTH - WIDTH / 2,
            y: rng() * HEIGHT - HEIGHT / 2,
          },
          {
            x: rng() * WIDTH - WIDTH / 2,
            y: rng() * HEIGHT - HEIGHT / 2,
            duration,
            ease: "none",
          },
          0
        );
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  reveal({
    direction = "up",
    t,
    duration = 0.5,
    ease = "expo.out",
  }: RevealParameters = {}) {
    commandQueue.push(() => {
      const object3d = this.object3D;
      const clippingPlanes: THREE.Plane[] = [];
      const box = getBoundingBox(object3d);
      const materials = getAllMaterials(object3d);

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      // Attach clipping planes to each material.
      tl.set(
        {},
        {
          onComplete: () => {
            for (const material of materials) {
              material.clippingPlanes = clippingPlanes;
            }
          },
        }
      );

      tl.fromTo(
        object3d,
        { visible: false },
        {
          visible: true,
          duration: 0.001,
        },
        "<"
      );

      if (direction === "right") {
        clippingPlanes.push(
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x)
        );
        tl.from(object3d.position, {
          x: object3d.position.x - (box.max.x - box.min.x),
        });
      } else if (direction === "left") {
        clippingPlanes.push(
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x)
        );
        tl.from(object3d.position, {
          x: object3d.position.x + (box.max.x - box.min.x),
        });
      } else if (direction === "up") {
        clippingPlanes.push(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y)
        );
        tl.from(object3d.position, {
          y: object3d.position.y - (box.max.y - box.min.y),
        });
      } else if (direction === "down") {
        clippingPlanes.push(
          new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y)
        );
        tl.from(object3d.position, {
          y: object3d.position.y + (box.max.y - box.min.y),
        });
      }

      // Detach clipping planes to each material.
      tl.set(
        {},
        {
          onComplete: () => {
            for (const material of materials) {
              material.clippingPlanes = null;
            }
          },
        }
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  updateVert(
    i: number,
    vert: [number, number, number?],
    params: AnimationParameters = {}
  ) {
    commandQueue.push(() => {
      const mesh = this.object3D as THREE.Mesh;
      // TODO: add support for all object types instead of just LineGeometry.
      const geometry = mesh.geometry as LineGeometry;

      const tl = gsap.timeline({
        defaults: { duration: 0.5, ease: defaultEase },
      });

      const x = this.verts[3 * i];
      const y = this.verts[3 * i + 1];
      const z = this.verts[3 * i + 2];

      const data = { x, y, z };
      tl.to(data, {
        x: vert[0],
        y: vert[1],
        z: vert[2] || 0,
        onUpdate: () => {
          this.verts[3 * i] = data.x;
          this.verts[3 * i + 1] = data.y;
          this.verts[3 * i + 2] = data.z;
          // TODO: perf optimization: multiple vertice update.
          geometry.setPositions(this.verts);
        },
      });

      this.verts[3 * i] = vert[0];
      this.verts[3 * i + 1] = vert[1];
      this.verts[3 * i + 2] = vert[2] || 0;

      mainTimeline.add(tl, params.t);
    });
    return this;
  }

  wipeIn({
    direction = "right",
    t,
    duration = 0.5,
    ease = "power.out",
  }: WipeInParameters = {}) {
    commandQueue.push(() => {
      const boundingBox = getBoundingBox(this.object3D);

      const tl = gsap.timeline({
        defaults: { duration, ease },
      });
      let clipPlane;
      if (direction === "right") {
        clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0));
        tl.fromTo(
          clipPlane,
          { constant: boundingBox.min.x },
          { constant: boundingBox.max.x }
        );
      } else if (direction === "left") {
        clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0));
        tl.fromTo(
          clipPlane,
          { constant: boundingBox.min.x },
          { constant: boundingBox.max.x }
        );
      } else if (direction === "up") {
        clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0));
        tl.fromTo(
          clipPlane,
          { constant: boundingBox.min.y },
          { constant: boundingBox.max.y }
        );
      } else if (direction === "down") {
        clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
        tl.fromTo(
          clipPlane,
          { constant: boundingBox.min.y },
          { constant: boundingBox.max.y }
        );
      }

      const materials = getAllMaterials(this.object3D);
      for (const material of materials) {
        material.clippingPlanes = [clipPlane];
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  shake2D({
    interval = 0.01,
    duration = 0.2,
    strength = 0.2,
    t,
  }: Shake2DParameters = {}) {
    function R(max: number, min: number) {
      return rng() * (max - min) + min;
    }

    commandQueue.push(() => {
      const object3d = this.object3D;

      const tl = gsap.timeline({ defaults: { ease: "none" } });
      tl.set(object3d, { x: "+=0" }); // this creates a full _gsTransform on object3d

      //store the transform values that exist before the shake so we can return to them later
      const initProps = {
        x: object3d.position.x,
        y: object3d.position.y,
        rotation: object3d.position.z,
      };

      //shake a bunch of times
      for (var i = 0; i < duration / interval; i++) {
        const offset = R(-strength, strength);
        tl.to(object3d.position, {
          x: initProps.x + offset,
          y: initProps.y - offset,
          // rotation: initProps.rotation + R(-5, 5)
          duration: interval,
        });
      }
      //return to pre-shake values
      tl.to(object3d.position, interval, {
        x: initProps.x,
        y: initProps.y,
        // scale: initProps.scale,
        // rotation: initProps.rotation
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  show({ duration = 0.001, t }: Shake2DParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { ease: "none", duration } });
      tl.fromTo(this.object3D, { visible: false }, { visible: true });

      mainTimeline.add(tl, t);
    });
    return this;
  }
}

interface ExplodeParameters extends AnimationParameters {
  speed?: string;
  minRotation?: number;
  maxRotation?: number;
  minRadius?: number;
  maxRadius?: number;
  minScale?: number;
  maxScale?: number;
  stagger?: number;
}

class GroupObject extends SceneObject {
  explode2D({
    t,
    ease = "expo.out",
    duration = 2,
    minRotation = -2 * Math.PI,
    maxRotation = 2 * Math.PI,
    minRadius = 0,
    maxRadius = 4,
    minScale = 1,
    maxScale = 1,
    stagger = 0,
    speed,
  }: ExplodeParameters = {}) {
    commandQueue.push(() => {
      let tl: gsap.core.Timeline;

      tl = createExplosionAnimation(this.object3D, {
        ease,
        duration,
        minRotation,
        maxRotation,
        minRadius,
        maxRadius,
        minScale,
        maxScale,
        stagger,
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  implode2D({ t = undefined, duration = 0.5 }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({
        defaults: {
          duration,
          ease: "expo.inOut",
        },
      });

      tl.to(
        this.object3D.children.map((x) => x.position),
        {
          x: 0,
          y: 0,
        },
        0
      );
      tl.to(
        this.object3D.children.map((x) => x.scale),
        {
          x: 0.001,
          y: 0.001,
        },
        0
      );
      tl.to(
        this.object3D.children.map((x) => x.rotation),
        {
          x: 0,
          y: 0,
          z: 0,
        },
        0
      );
      mainTimeline.add(tl, t);
    });
    return this;
  }

  flyIn({ t, duration = 0.5, ease = "power.in" }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      this.object3D.children.forEach((child) => {
        tl.from(child.rotation, { x: -Math.PI / 2 }, "<0.03");
        tl.from(
          child.position,
          {
            y: -child.scale.length(),
            z: -child.scale.length() * 2,
          },
          "<"
        );
        tl.add(createFadeInAnimation(child, { duration }), "<");
      });

      mainTimeline.add(tl, t);

      return tl;
    });
    return this;
  }
}

function addCustomAnimation(
  tl: gsap.core.Timeline,
  callback: (t: number) => void
) {
  const data = { val: 0 };
  tl.fromTo(
    data,
    { val: 0 },
    {
      val: 1,
      ease: "linear",
      onUpdate: () => {
        callback(data.val);
      },
    },
    "<"
  );
}

interface ChangeTextParameters extends AnimationParameters {
  from?: number;
  to?: number;
}

class TextObject extends GroupObject {
  changeText(
    func: (val: number) => any,
    {
      from = 0,
      to = 1,
      duration = 5,
      ease = "expo.out",
      t,
    }: ChangeTextParameters = {}
  ) {
    commandQueue.push(() => {
      const textObject = this.object3D as any;
      const tl = gsap.timeline({ defaults: { duration, ease } });

      const data = { val: from };
      tl.to(data, {
        val: to,
        onUpdate: () => {
          const text = func(data.val).toString();
          textObject.setText(text);
        },
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  typeText({ t, duration, interval = 0.1 }: ChangeTextParameters = {}) {
    commandQueue.push(() => {
      const textObject = this.object3D as any;

      if (duration !== undefined) {
        interval = duration / textObject.children.length;
      }

      const tl = gsap.timeline({
        defaults: { duration: interval, ease: "steps(1)" },
      });

      textObject.children.forEach((letter: any) => {
        tl.fromTo(letter, { visible: false }, { visible: true });
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  transformTexTo(textObject: TextObject, params: AnimationParameters = {}) {
    const { duration = 0.5, t } = params;

    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { ease: "power1.out", duration } });

      const srcTexObject = this.object3D as THREE.Group;
      const dstTexObject = textObject.object3D as THREE.Group;

      srcTexObject.updateWorldMatrix(true, true);
      dstTexObject.updateWorldMatrix(true, true);

      const matchedDstSymbols = Array(dstTexObject.children.length).fill(false);
      for (let i = 0; i < srcTexObject.children.length; ++i) {
        const c1 = srcTexObject.children[i];
        // find match

        let found = false;
        for (let j = 0; j < dstTexObject.children.length; ++j) {
          if (!matchedDstSymbols[j]) {
            const c2 = dstTexObject.children[j];
            if (c1.name === c2.name) {
              let posInSrcTexObject = c2.getWorldPosition(new THREE.Vector3());
              posInSrcTexObject = srcTexObject.worldToLocal(posInSrcTexObject);

              let scaleInSrcTexObject = c2.getWorldScale(new THREE.Vector3());
              scaleInSrcTexObject.divide(
                srcTexObject.getWorldScale(new THREE.Vector3())
              );

              createTransformAnimation({
                object3d: c1,
                x: posInSrcTexObject.x,
                y: posInSrcTexObject.y,
                z: posInSrcTexObject.z,
                sx: scaleInSrcTexObject.x,
                sy: scaleInSrcTexObject.y,
                sz: scaleInSrcTexObject.z,
                tl,
              });

              found = true;
              matchedDstSymbols[j] = true;

              break;
            }
          }
        }

        if (!found) {
          tl.add(
            createFadeOutAnimation(c1, { duration, ease: "power4.out" }),
            0
          );
        }
      }

      for (const i in matchedDstSymbols) {
        const c = dstTexObject.children[i];
        if (!matchedDstSymbols[i]) {
          // Fade in unmatched symbols in toTextObject
          tl.add(createFadeInAnimation(c, { duration, ease: "power4.in" }), 0);
        } else {
          // Hide matched symbols in toTextObject
          c.visible = false;
        }
      }

      // Hide all symbols in srcTexObject
      tl.set(srcTexObject.children, { visible: false }, "+=0");

      // Show all symbols in dstTexObject
      tl.set(dstTexObject.children, { visible: true }, "+=0");

      mainTimeline.add(tl, t);
    });
    return this;
  }
}

interface AddTextParameters extends Transform, BasicMaterial {
  font?: "zh" | "en" | "math" | "code" | "gdh";
  fontSize?: number;
  letterSpacing?: number;
  centerTextVertically?: boolean;
  ccw?: boolean;
}

interface AddRectParameters extends Transform, BasicMaterial {
  width?: number;
  height?: number;
}

interface AddCircleParameters extends Transform, BasicMaterial {
  radius?: number;
}

interface AddTriangleParameters extends Transform, BasicMaterial {
  verts?: number[][];
}

interface AddOutlineParameters extends Transform, BasicMaterial {
  lineWidth?: number;
  width?: number;
  height?: number;
}

interface AddCircleOutlineParameters extends Transform, BasicMaterial {
  lineWidth?: number;
  radius?: number;
}

function defaultSeg({ wireframe }: AddObjectParameters) {
  return wireframe ? 16 : 64;
}

export function _addPanoramicSkybox(file: string) {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    // invert the geometry on the x-axis so that all of the faces point inward
    geometry.scale(-1, 1, 1);

    const texture = new THREE.TextureLoader().load(file);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const skySphere = new THREE.Mesh(geometry, material);
    scene.add(skySphere);

    obj.object3D = skySphere;
  });

  return obj;
}

interface AddLineParameters extends Transform, BasicMaterial {
  lineWidth?: number;
}

interface AddArrowParameters extends AddLineParameters {
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

interface AddGridParameters extends Transform, BasicMaterial {
  gridSize?: number;
}

function toThreeVector3(
  v?: { x?: number; y?: number; z?: number } | [number, number, number?]
) {
  if (v === undefined) {
    return new THREE.Vector3(0, 0, 0);
  } else if (Array.isArray(v)) {
    if (v.length == 2) {
      return new THREE.Vector3(v[0], v[1]);
    } else if (v.length == 3) {
      return new THREE.Vector3(v[0], v[1], v[2]);
    }
  } else {
    return new THREE.Vector3(
      v.x === undefined ? 0 : v.x,
      v.y === undefined ? 0 : v.y,
      v.z === undefined ? 0 : v.z
    );
  }
}

interface Transform {
  x?: number | ((t: number) => number);
  y?: number | ((t: number) => number);
  z?: number | ((t: number) => number);
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  position?: [number, number] | [number, number, number];
  scale?: number;
  parent?: SceneObject;
}

interface AddObjectParameters extends Transform, BasicMaterial {
  vertices?: any;
  outline?: any;
  outlineWidth?: any;
  width?: any;
  height?: any;
  t?: number | string;
  parent?: SceneObject;
  lighting?: any;
  ccw?: any;
  font?: any;
  fontSize?: any;
  start?: any;
  end?: any;
  lineWidth?: any;
  gridSize?: any;
  centralAngle?: any;
  letterSpacing?: any;
  duration?: any;
  type?: any;
}

interface BasicMaterial {
  color?: string | number;
  opacity?: number;
  wireframe?: boolean;
  lighting?: boolean;
}

function createMaterial(params: BasicMaterial = {}) {
  if (params.wireframe) {
    return new THREE.MeshBasicMaterial({
      color: toThreeColor(params.color),
      wireframe: true,
    });
  } else if (params.lighting) {
    addDefaultLights();

    return new THREE.MeshStandardMaterial({
      color: toThreeColor(params.color),
      roughness: 0.5,
    });
  } else {
    const opacity = params.opacity === undefined ? 1.0 : params.opacity;

    return new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      color: toThreeColor(params.color),
      transparent: opacity < 1.0 ? true : false,
      opacity,
    });
  }
}

function updateTransform(mesh: THREE.Object3D, transform: Transform) {
  // Scale
  if (transform.scale !== undefined) {
    mesh.scale.multiplyScalar(transform.scale);
  } else {
    if (transform.sx !== undefined) {
      mesh.scale.x = transform.sx;
    }
    if (transform.sy !== undefined) {
      mesh.scale.y = transform.sy;
    }
    if (transform.sz !== undefined) {
      mesh.scale.z = transform.sz;
    }
  }

  // Position
  if (transform.position !== undefined) {
    mesh.position.copy(toThreeVector3(transform.position));
  } else {
    for (const prop of ["x", "y", "z"]) {
      const T = transform as any;
      const V = mesh.position as any;
      if (T[prop] !== undefined) {
        if (typeof T[prop] === "number") {
          V[prop] = T[prop];
        } else {
          animationCallbacks.push((t) => {
            V[prop] = T[prop](t);
          });
        }
      }
    }
  }

  // Rotation
  if (transform.rx !== undefined) mesh.rotation.x = transform.rx;
  if (transform.ry !== undefined) mesh.rotation.y = transform.ry;
  if (transform.rz !== undefined) mesh.rotation.z = transform.rz;
}

export function _setUILayer() {
  commandQueue.push(() => {
    currentLayer = "ui";
  });
}

interface AddGroupParameters extends Transform {}

function getBoundingBox(object3D: THREE.Object3D): THREE.Box3 {
  // Force update the world matrix so that we get the correct scale.
  object3D.updateWorldMatrix(true, true);
  const aabb = new THREE.Box3().expandByObject(object3D);
  return aabb;
}

export function getQueryString(url: string = undefined) {
  // get query string from url (optional) or window
  var queryString = url ? url.split("?")[1] : window.location.search.slice(1);

  // we'll store the parameters here
  var obj: any = {};

  // if query string exists
  if (queryString) {
    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split("#")[0];

    // split our query string into its component parts
    var arr = queryString.split("&");

    for (var i = 0; i < arr.length; i++) {
      // separate the keys and the values
      var a = arr[i].split("=");

      // set parameter name and value (use 'true' if empty)
      var paramName = a[0];
      var paramValue = typeof a[1] === "undefined" ? true : a[1];

      // (optional) keep case consistent
      paramName = paramName.toLowerCase();
      if (typeof paramValue === "string") {
        // paramValue = paramValue.toLowerCase();
        paramValue = decodeURIComponent(paramValue);
      }

      // if the paramName ends with square brackets, e.g. colors[] or colors[2]
      if (paramName.match(/\[(\d+)?\]$/)) {
        // create key if it doesn't exist
        var key = paramName.replace(/\[(\d+)?\]/, "");
        if (!obj[key]) obj[key] = [];

        // if it's an indexed array e.g. colors[2]
        if (paramName.match(/\[\d+\]$/)) {
          // get the index value and add the entry at the appropriate position
          var index = /\[(\d+)\]/.exec(paramName)[1];
          obj[key][index] = paramValue;
        } else {
          // otherwise add the value to the end of the array
          obj[key].push(paramValue);
        }
      } else {
        // we're dealing with a string
        if (!obj[paramName]) {
          // if it doesn't exist, create property
          obj[paramName] = paramValue;
        } else if (obj[paramName] && typeof obj[paramName] === "string") {
          // if property does exist and it's a string, convert it to an array
          obj[paramName] = [obj[paramName]];
          obj[paramName].push(paramValue);
        } else {
          // otherwise add the property
          obj[paramName].push(paramValue);
        }
      }
    }
  }

  return obj;
}

export function setSeed(val: any) {
  rng = seedrandom(val);
}

export function random(min = 0, max = 1) {
  return min + rng() * (max - min);
}

function getGridPosition({ rows = 1, cols = 1, width = 25, height = 14 } = {}) {
  const gapX = width / cols;
  const gapY = height / rows;

  const startX = (width / cols - width) * 0.5;
  const startY = (height / rows - height) * 0.5;

  const results = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      results.push(
        new THREE.Vector3(j * gapX + startX, -(i * gapY + startY), 0)
      );
    }
  }
  return results;
}

export function enableMotionBlur({ samples = 16 } = {}) {
  motionBlurSamples = samples;
}

export function setResolution(w: number, h: number) {
  renderTargetWidth = w;
  renderTargetHeight = h;
}

export function setBackgroundColor(color: number | string) {
  commandQueue.push(() => {
    scene.background = toThreeColor(color);
  });
}

export function fadeOutAll({ t }: AnimationParameters = {}) {
  commandQueue.push(() => {
    const tl = gsap.timeline();
    for (const object3d of scene.children) {
      tl.add(createFadeOutAnimation(object3d), "<");
    }
    mainTimeline.add(tl, t);
  });
}

export function pause(duration: number | string) {
  commandQueue.push(() => {
    mainTimeline.set(
      {},
      {},
      typeof duration === "number" ? "+=" + duration.toString() : duration
    );
  });
}

export function enableBloom() {
  bloomEnabled = true;
}

export function _setCamera(cam: THREE.Camera) {
  camera = cam;
}

export function _enableFXAA() {
  fxaaEnabled = true;
}

async function loadObj(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();

    loader.load(
      url,
      function (object) {
        resolve(object);
      },
      function (xhr) {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      function (error) {
        reject(error);
      }
    );
  });
}

export function _animateTo(
  targets: gsap.TweenTarget,
  vars: gsap.TweenVars,
  t?: gsap.Position
) {
  commandQueue.push(() => {
    mainTimeline.to(targets, vars, t);
  });
}

const root = new GroupObject();
root.object3D = new THREE.Group();
scene.add(root.object3D);

const uiRoot = new GroupObject();
uiRoot.object3D = new THREE.Group();
uiScene.add(uiRoot.object3D);

function getRoot(): GroupObject {
  if (currentLayer === "ui") {
    return uiRoot;
  } else {
    return root;
  }
}

export function addCircle(params: AddCircleParameters = {}): SceneObject {
  return getRoot().addCircle(params);
}

export function addCircleOutline(
  params: AddCircleOutlineParameters = {}
): SceneObject {
  return getRoot().addCircleOutline(params);
}

export function addCone(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addCone(params);
}

export function addCube(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addCube(params);
}

export function addCylinder(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addCylinder(params);
}

export function addGrid(params: AddGridParameters = {}): SceneObject {
  return getRoot().addGrid(params);
}

export function addGroup(params: AddGroupParameters = {}): GroupObject {
  return getRoot().addGroup(params);
}

export function addImage(
  file: string,
  params: AddTextParameters = {}
): SceneObject {
  return getRoot().addImage(file, params);
}

export function addLine(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddLineParameters = {}
): SceneObject {
  return getRoot().addLine(p1, p2, params);
}

export function addPolyline(
  points: [number, number, number][],
  params: AddObjectParameters = {}
): SceneObject {
  return getRoot().addPolyline(points, params);
}

export function addPyramid(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addPyramid(params);
}

export function addRect(params: AddRectParameters = {}): SceneObject {
  return getRoot().addRect(params);
}

export function addRectOutline(params: AddOutlineParameters = {}): SceneObject {
  return getRoot().addRectOutline(params);
}

export function addSphere(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addSphere(params);
}

export function addText(
  text: string,
  params: AddTextParameters = {}
): TextObject {
  return getRoot().addText(text, params);
}

export function addTex(
  tex: string,
  params: AddTextParameters = {}
): TextObject {
  return getRoot().addTex(tex, params);
}

export function addTorus(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addTorus(params);
}

export function addTriangle(params: AddTriangleParameters = {}): SceneObject {
  return getRoot().addTriangle(params);
}

export function addTriangleOutline(
  params: AddOutlineParameters = {}
): SceneObject {
  return getRoot().addTriangleOutline(params);
}

export function _addMesh(
  mesh: THREE.Mesh,
  params: AddObjectParameters = {}
): SceneObject {
  return getRoot()._addMesh(mesh, params);
}

export function _add3DModel(
  url: string,
  params: AddObjectParameters = {}
): SceneObject {
  return getRoot()._add3DModel(url, params);
}

export function addArrow(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddArrowParameters = {}
): SceneObject {
  return getRoot().addArrow(p1, p2, params);
}

export function addArc(
  startAngle: number,
  endAngle: number,
  radius = 1,
  params: AddLineParameters = {}
): SceneObject {
  return getRoot().addArc(startAngle, endAngle, radius, params);
}

export function moveTo(params: MoveObjectParameters = {}) {
  return getRoot().moveTo(params);
}

export function usePerspectiveCamera() {
  camera = createPerspectiveCamera();
}

export function useOrthographicCamera() {
  camera = createOrthographicCamera();
}

document.body.onload = function () {
  run();
};

////////////////////////////////////////////////////////////////////////////////
// Raycast z plane at mouse click, then copy the intersection to clipboard.
////////////////////////////////////////////////////////////////////////////////
const raycaster = new THREE.Raycaster();
const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function onMouseMove(event: MouseEvent) {
  if (renderer === undefined) return;

  let bounds = renderer.domElement.getBoundingClientRect();

  const mouse = new THREE.Vector2(
    ((event.clientX - bounds.left) / (bounds.right - bounds.left)) * 2 - 1,
    -((event.clientY - bounds.top) / (bounds.bottom - bounds.top)) * 2 + 1
  );

  raycaster.setFromCamera(mouse, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeZ, target);

  // Copy to clipboard
  navigator.clipboard.writeText(
    `[${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)}]`
  );
}
window.addEventListener("click", onMouseMove, false);
