const CCapture = require('ccapture.js-npmfixed');
import * as Diff from 'diff';
import gsap from 'gsap';
import * as THREE from 'three';
import { PerspectiveCamera } from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { WireframeGeometry2 } from 'three/examples/jsm/lines/WireframeGeometry2.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import TextMeshObject from './objects/TextMeshObject';
import './style/player.css';
import { toThreeColor } from './utils/color';
import { GlitchPass } from './utils/GlitchPass';
import { computeAABB } from './utils/math';
import { OutlinePass } from './utils/OutlinePass.js';
import { loadSVG } from './utils/svg';
import { createTexObject } from './utils/tex';
import WebmMediaRecorder from './utils/WebmMediaRecorder';

const debug = false;

const DEFAULT_LINE_WIDTH = 0.02;
const DEFAULT_POINT_SIZE = 0.1;
const DEG2RAD = Math.PI / 180;
const defaultAxesLabelScale = 0.25;

gsap.ticker.remove(gsap.updateRoot);

let renderTargetWidth = 1920;
let renderTargetHeight = 1080;
const viewportHeight = 10;
let motionBlurSamples = 1;
const globalTimeline = gsap.timeline({ paused: true, onComplete: stopRender });
const mainTimeline = gsap.timeline();

let capturer: any;
let renderer: THREE.WebGLRenderer;

interface Engine {
  activeLayer?: string;
  bloomPass?: UnrealBloomPass;
  composer?: EffectComposer;
  fxaaPass?: ShaderPass;
  glitchPass?: any;
  lightGroup?: THREE.Group;
  mainCamera?: THREE.Camera;
  renderTarget?: THREE.WebGLMultisampleRenderTarget;
  rng?: any;
  root?: GroupObject;
  scene?: THREE.Scene;
  uiCamera?: THREE.Camera;
  uiRoot?: GroupObject;
  uiScene?: THREE.Scene;
  defaultDuration?: number;
  defaultEase?: string;
  outlinePass?: any;
}

let engine: Engine = {};

let gridHelper: THREE.GridHelper;
const backgroundAlpha = 1.0;

let lastTimestamp: number;
let timeElapsed = 0;

let recorder: WebmMediaRecorder;

globalTimeline.add(mainTimeline, '0');

const options = {
  format: 'webm',
  framerate: 30,
  timeline: 0,
};

const seedrandom = require('seedrandom');

let exportFileName: string = undefined;

function exportVideo({
  resetTiming = true,
  name = document.title,
}: {
  resetTiming?: boolean;
  name?: string;
} = {}) {
  exportFileName = name;

  if (gridHelper !== undefined) {
    gridHelper.visible = false;
  }

  if (resetTiming) {
    // Reset gsap
    gsap.ticker.remove(gsap.updateRoot);
    lastTimestamp = undefined;
  }

  if (options.format == 'webm-fast') {
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
      workersPath: 'dist/src/',
      timeLimit: 0,
      frameLimit: 0,
      autoSaveTime: 0,
      name,
    });
    (capturer as any).start();
  }
}

function downloadObjectAsJson(exportObj: any, exportName: string) {
  var dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', exportName + '.json');
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function getMarkers() {
  return Object.keys(mainTimeline.labels).map((name) => ({
    name,
    time: mainTimeline.labels[name],
  }));
}

function exportVideoMetadata() {
  const data = {
    markers: getMarkers(),
  };
  downloadObjectAsJson(data, exportFileName);
}

function stopRender() {
  if (options.format == 'webm-fast') {
    if (recorder) {
      recorder.stop();
      exportVideoMetadata();
    }
  } else if (capturer) {
    (capturer as any).stop();
    (capturer as any).save();
    capturer = undefined;
    exportVideoMetadata();

    // XXX: workaround for requestAnimationFrame() is not running.
    requestAnimationFrame(animate);
  }

  window.top.postMessage({ type: 'videoExported' }, '*');
}

function createOrthographicCamera() {
  const aspect = renderTargetWidth / renderTargetHeight;
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
  const camera = new THREE.PerspectiveCamera(60, renderTargetWidth / renderTargetHeight, 0.1, 5000);
  camera.position.set(0, 0, 8.66);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  return camera;
}

function initEngine(container?: HTMLElement) {
  mainTimeline.clear();

  // Create renderer
  if (renderer === undefined) {
    console.log('new webgl renderer');
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.localClippingEnabled = true;
    renderer.setSize(renderTargetWidth, renderTargetHeight);
    renderer.setClearColor(0x000000, backgroundAlpha);

    if (container !== undefined) {
      container.appendChild(renderer.domElement);
    } else {
      document.body.appendChild(renderer.domElement);
    }
  }

  const scene = new THREE.Scene();
  const root = new GroupObject(null);
  root.object3D = new THREE.Group();
  scene.add(root.object3D);

  const uiScene = new THREE.Scene();
  const uiRoot = new GroupObject(null);
  uiRoot.object3D = new THREE.Group();
  uiScene.add(uiRoot.object3D);

  scene.background = new THREE.Color(0);

  const mainCamera = createOrthographicCamera();
  const uiCamera = createOrthographicCamera();

  // Create multi-sample render target in order to reduce aliasing (better
  // quality than FXAA).
  const renderTarget = new THREE.WebGLMultisampleRenderTarget(
    renderTargetWidth,
    renderTargetHeight
  );
  renderTarget.samples = 8; // TODO: don't hardcode

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setSize(renderTargetWidth, renderTargetHeight);

  // Always use a render pass for gamma correction. This avoid adding an extra
  // copy pass to resolve MSAA samples.
  composer.insertPass(new ShaderPass(GammaCorrectionShader), 1);

  engine = {
    activeLayer: 'main',
    composer,
    glitchPass: undefined,
    mainCamera,
    renderTarget,
    rng: seedrandom('hello.'),
    root,
    scene,
    uiCamera,
    uiRoot,
    uiScene,
    defaultDuration: 0.5,
    defaultEase: 'power2.out',
  };

  if (0) {
    engine.outlinePass = new OutlinePass(
      new THREE.Vector2(renderTargetWidth, renderTargetHeight),
      scene,
      mainCamera
    );
    engine.outlinePass.edgeStrength = 10;
    engine.outlinePass.edgeGlow = 0;
    engine.outlinePass.edgeThickness = 1;
    engine.outlinePass.pulsePeriod = 0;
    engine.outlinePass.visibleEdgeColor.set('#ffffff');
    engine.outlinePass.hiddenEdgeColor.set('#ffffff');
    composer.addPass(engine.outlinePass);
  }

  promise = new Promise((resolve, reject) => {
    resolve();
  });
}

function animate() {
  // time /* `time` parameter is buggy in `ccapture`. Do not use! */
  const nowInSecs = Date.now() / 1000;

  requestAnimationFrame(animate);

  let delta: number;
  {
    // Compute `timeElapsed`. This works for both animation preview and capture.
    if (lastTimestamp === undefined) {
      console.log('time reset');
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

  if (engine.scene) {
    engine.scene.traverse((child: any) => {
      if (child instanceof TextMeshObject) {
        child.updateText();
      }

      // check if onUpdate is defined
      if (child.onUpdate) {
        child.onUpdate();
      }

      if (child.billboarding) {
        const quat = child.quaternion;
        quat.copy(engine.mainCamera.quaternion);
        child.traverseAncestors((o: any) => {
          quat.multiply(o.quaternion.clone().invert());
        });
      }
    });

    renderer.setRenderTarget(engine.renderTarget);

    // Render scene
    renderer.render(engine.scene, engine.mainCamera);

    // Render UI on top of the scene
    renderer.autoClearColor = false;
    renderer.render(engine.uiScene, engine.uiCamera);
    renderer.autoClearColor = true;

    renderer.setRenderTarget(null);

    // Post processing
    engine.composer.readBuffer = engine.renderTarget;
    engine.composer.render();
  }

  if (capturer) (capturer as any).capture(renderer.domElement);
}

interface MoveCameraParameters extends Transform, AnimationParameters {
  lookAt?: { x?: number; y?: number; z?: number } | [number, number, number?];
  fov?: number;
  zoom?: number;
}

export function cameraMoveTo(params: MoveCameraParameters = {}) {
  promise = promise.then(() => {
    const {
      t,
      lookAt,
      duration = engine.defaultDuration,
      ease = engine.defaultEase,
      fov,
      zoom,
    } = params;

    const tl = gsap.timeline({
      defaults: {
        duration,
        ease,
      },
      onUpdate: () => {
        // Keep looking at the target while camera is moving.
        if (lookAt) {
          engine.mainCamera.lookAt(toThreeVector3(lookAt));
        }
      },
    });

    if (engine.mainCamera instanceof THREE.PerspectiveCamera) {
      const perspectiveCamera = engine.mainCamera as THREE.PerspectiveCamera;

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
          '<'
        );
      }
    }

    tl.add(
      createTransformAnimation({
        ...params,
        object3d: engine.mainCamera,
        duration,
        ease,
      }),
      '<'
    );

    if (zoom !== undefined) {
      tl.to(
        engine.mainCamera,
        {
          zoom,
          onUpdate: () => {
            (engine.mainCamera as any).updateProjectionMatrix();
          },
        },
        '<'
      );
    }

    mainTimeline.add(tl, t);
  });
}

export function generateRandomString(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function createLine3D(
  points: THREE.Vector3[],
  {
    color,
    lineWidth = 0.1,
  }: {
    color?: string | number;
    lineWidth: number;
  }
) {
  if (points.length === 0) {
    points.push(new THREE.Vector3(-1.73, -1, 0));
    points.push(new THREE.Vector3(1.73, -1, 0));
    points.push(new THREE.Vector3(0, 2, 0));
    points.push(points[0]);
  }

  const lineColor = new THREE.Color(0xffffff);
  const style = SVGLoader.getStrokeStyle(lineWidth, lineColor.getStyle(), 'miter', 'butt', 4);
  // style.strokeLineJoin = "round";
  const geometry = SVGLoader.pointsToStroke(points, style, 12, 0.001);

  const material = createMaterial({ color, doubleSided: true });
  const mesh = new THREE.Mesh(geometry, material);
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
  { duration, ease }: AnimationParameters = {}
) {
  const tl = gsap.timeline();

  // Set initial visibility to false.
  object3d.visible = false;

  tl.set(object3d, { visible: true }, '<');

  const materials = getAllMaterials(object3d);
  for (const material of materials) {
    tl.set(material, { transparent: true }, '<');
    tl.from(
      material,
      {
        opacity: 0,
        duration,
        ease,
      },
      '<'
    );
  }

  return tl;
}

function createOpacityAnimation(
  obj: THREE.Object3D,
  {
    duration = engine.defaultDuration,
    ease = engine.defaultEase,
    opacity = 0,
  }: { duration?: number; ease?: string; opacity?: number } = {}
): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { duration, ease } });

  const materials = getAllMaterials(obj);
  for (const material of materials) {
    tl.set(material, { transparent: true }, '<');
    tl.to(
      material,
      {
        opacity,
      },
      '<'
    );
  }

  if (opacity == 0) {
    tl.set(obj, { visible: false }, '>');
  }

  return tl;
}

function addDefaultLights() {
  if (engine.lightGroup === undefined) {
    const lightGroup = new THREE.Group();

    // Create directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(0.3, 1, 0.5);
    lightGroup.add(directionalLight);

    // Create ambient light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3f3f3f, 0.3);
    lightGroup.add(hemiLight);

    engine.lightGroup = lightGroup;
    engine.scene.add(lightGroup);
  }
}

function createExplosionAnimation(
  objectGroup: THREE.Object3D,
  {
    ease = 'expo.out',
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
      ease,
    },
  });

  let delay = 0;
  objectGroup.children.forEach((child, i) => {
    const r = minRadius + (maxRadius - minRadius) * engine.rng();
    const theta = engine.rng() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    child.position.z += 0.01 * i; // z-fighting

    tl.fromTo(child.position, { x: 0, y: 0 }, { x, y }, delay);

    const rotation = minRotation + engine.rng() * (maxRotation - minRotation);
    tl.fromTo(child.rotation, { z: 0 }, { z: rotation }, delay);

    const targetScale = child.scale.setScalar(minScale + (maxScale - minScale) * engine.rng());
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

export function addGlitch({ duration = 0.2, t }: AnimationParameters = {}) {
  promise = promise.then(() => {
    if (engine.glitchPass === undefined) {
      engine.glitchPass = new GlitchPass();
    }

    if (engine.composer.passes.indexOf(engine.glitchPass) === -1) {
      engine.composer.insertPass(engine.glitchPass, 0);
      console.log('add glitch pass');
    }

    const tl = gsap.timeline();
    tl.set(engine.glitchPass, { factor: 1 });
    tl.set(engine.glitchPass, { factor: 0 }, `<${duration}`);
    mainTimeline.add(tl, t);
  });
}

/**
 * @deprecated No need to manually call run().
 */
export function run() {}

// Start animation
requestAnimationFrame(animate);

const startAnimation = () => {
  console.log('start animation');
  // Always Add 0.5s to the end of animation to avoid zero-length video.
  if (mainTimeline.duration() < Number.EPSILON) {
    mainTimeline.set({}, {}, '+=0.5');
  }

  console.log(`Animation started: duration: ${globalTimeline.duration()}`);

  if (0) {
    // Grid helper
    const size = 20;
    const divisions = 20;
    const colorCenterLine = '#008800';
    const colorGrid = '#888888';

    gridHelper = new THREE.GridHelper(
      size,
      divisions,
      new THREE.Color(colorCenterLine),
      new THREE.Color(colorGrid)
    );
    gridHelper.rotation.x = Math.PI / 2;
    engine.scene.add(gridHelper);
  }

  globalTimeline.play(0, false);

  globalTimeline.eventCallback('onUpdate', () => {
    window.top.postMessage(
      {
        type: 'positionChanged',
        position: globalTimeline.time(),
        duration: globalTimeline.duration(),
      },
      '*'
    );
  });
  window.top.postMessage(
    {
      type: 'scriptLoaded',
      timeline: getTimeline(),
      aspect: renderTargetWidth / renderTargetHeight,
    },
    '*'
  );
};

function createArrow2DGeometry(arrowLength: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    // prettier-ignore
    new THREE.BufferAttribute(new Float32Array([
      -0.5 * arrowLength, -0.5 * arrowLength, 0,
      0.5 * arrowLength, -0.5 * arrowLength, 0,
      0, 0.5 * arrowLength, 0,
    ]), 3)
  );
  geometry.computeVertexNormals();
  return geometry;
}

interface CreateArrowLineParameters extends BasicMaterial {
  arrowEnd?: boolean;
  arrowStart?: boolean;
  threeDimensional?: boolean;
}

function createArrowLine(
  from: THREE.Vector3,
  to: THREE.Vector3,
  params: CreateArrowLineParameters = {}
) {
  const {
    lineWidth = DEFAULT_LINE_WIDTH,
    arrowEnd = true,
    arrowStart = false,
    threeDimensional = false,
  } = params;

  const material = createMaterial({ ...params, doubleSided: true });

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

    const geometry = !threeDimensional
      ? new THREE.PlaneGeometry(lineWidth, length)
      : new THREE.CylinderGeometry(lineWidth / 2, lineWidth / 2, length, 16);

    const line = new THREE.Mesh(geometry, material);
    line.position.copy(direction.clone().multiplyScalar(offset));
    line.setRotationFromQuaternion(quaternion);

    group.add(line);
  }

  // Create arrows
  for (let i = 0; i < 2; i++) {
    if (i === 0 && !arrowStart) continue;
    if (i === 1 && !arrowEnd) continue;

    const geometry = !threeDimensional
      ? createArrow2DGeometry(arrowLength)
      : new THREE.ConeGeometry(arrowLength * 0.5, arrowLength, 32);
    geometry.translate(0, -arrowLength / 2, 0);

    const arrow = new THREE.Mesh(geometry, material);
    arrow.setRotationFromQuaternion(quaternion);
    arrow.position.copy(i === 0 ? from : to);
    arrow.position.sub(center);
    group.add(arrow);

    if (i === 0) arrow.rotateZ(Math.PI);
  }

  group.position.copy(center);
  return group;
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        resolve(texture);
      },
      undefined,
      (err) => {
        reject(err);
      }
    );
  });
}

export function getPolygonVertices({ sides = 3, radius = 0.5 } = {}) {
  const verts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    verts.push([
      radius * Math.sin((2 * i * Math.PI) / sides),
      radius * Math.cos((2 * i * Math.PI) / sides),
    ]);
  }
  return verts;
}

export function getTriangleVertices({ radius = 0.5 }: { radius?: number } = {}) {
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
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface RevealParameters extends AnimationParameters {
  direction?: 'up' | 'down' | 'left' | 'right';
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
  object3d,
  ease,
  duration,
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
  object3d: THREE.Object3D;
  duration?: number;
  ease?: string;
}) {
  const tl = gsap.timeline({
    defaults: {
      duration,
      ease,
    },
  });

  if (position) {
    const p = toThreeVector3(position);
    tl.to(object3d.position, { x: p.x, y: p.y, z: p.z }, '<');
  } else {
    if (x !== undefined) tl.to(object3d.position, { x }, '<');
    if (y !== undefined) tl.to(object3d.position, { y }, '<');
    if (z !== undefined) tl.to(object3d.position, { z }, '<');
  }

  if (rx !== undefined) tl.to(object3d.rotation, { x: fixRotation(rx) }, '<');
  if (ry !== undefined) tl.to(object3d.rotation, { y: fixRotation(ry) }, '<');
  if (rz !== undefined) tl.to(object3d.rotation, { z: fixRotation(rz) }, '<');

  if (scale !== undefined) {
    tl.to(
      object3d.scale,
      {
        x: scale,
        y: scale,
        z: scale,
      },
      '<'
    );
  } else {
    if (sx !== undefined) tl.to(object3d.scale, { x: sx }, '<');
    if (sy !== undefined) tl.to(object3d.scale, { y: sy }, '<');
    if (sz !== undefined) tl.to(object3d.scale, { z: sz }, '<');
  }

  return tl;
}

function convertScreenToWorld(object3d: THREE.Object3D, v: number) {
  const worldScale = new THREE.Vector3();
  object3d.getWorldScale(worldScale);
  return ((v * worldScale.length()) / 10) * 0.5 * renderTargetHeight;
}

class Line_ extends Line2 {
  lineWidth: number;

  constructor(
    verts: THREE.Vector3[],
    {
      lineWidth,
      color,
      dashed,
    }: { lineWidth?: number; color?: string | number; opacity?: number; dashed?: boolean } = {}
  ) {
    const geometry = new LineGeometry();
    updateLinePoints(verts, geometry, 1);

    const material = createLineMaterial(color, lineWidth, dashed);

    super(geometry, material);

    this.lineWidth = lineWidth || DEFAULT_LINE_WIDTH;
    this.onBeforeRender = () => {
      this.material.linewidth = convertScreenToWorld(this, this.lineWidth);
    };
    this.computeLineDistances();
  }
}

interface RotateInParameters extends AnimationParameters {
  axis?: 'x' | 'y' | 'z';
  rotation?: number;
}

function createLineMaterial(color?: string | number, lineWidth?: number, dashed?: boolean) {
  lineWidth ||= DEFAULT_LINE_WIDTH;
  const material = new LineMaterial({
    color: toThreeColor(color).getHex(),
    linewidth: lineWidth,
    worldUnits: false,
    alphaToCoverage: false, // TODO: this will cause artifact during fadeIn and fadeOut
    dashed,
    dashSize: lineWidth * 2,
    gapSize: lineWidth * 2,
    resolution: new THREE.Vector2(renderTargetWidth, renderTargetHeight),
  });
  return material;
}

function updateLinePoints(verts: THREE.Vector3[], geometry: LineGeometry, progress = 1) {
  const points = [];
  const division = (verts.length - 1) * 1;
  for (let i = 0; i < verts.length; i++) {
    if (i <= progress * division) {
      points.push(verts[i]);
    } else {
      const k = Math.floor(progress * division);
      const point = new THREE.Vector3();
      point.lerpVectors(verts[k], verts[k + 1], progress * division - k);
      points.push(point);
    }
  }

  const vertexBuffer: number[] = [];
  for (const v of points) {
    vertexBuffer.push(v.x, v.y, v.z);
  }
  // TODO: perf optimization: multiple vertice update.
  geometry.setPositions(vertexBuffer);
}

function addTransformControl(object: THREE.Object3D<THREE.Event>) {
  const control = new TransformControls(engine.mainCamera, renderer.domElement);
  control.attach(object);
  engine.scene.add(control);
  control.addEventListener('mouseUp', () => {
    const p = object.position;
    const clipboard = `x: ${p.x.toFixed(4)}, y: ${p.y.toFixed(4)}, z: ${p.z.toFixed(4)}`;
    window.navigator.clipboard.writeText(clipboard);
  });
}

function addObjectToScene(object3D: THREE.Object3D, parentObject3D: THREE.Object3D) {
  console.assert(object3D);
  console.assert(parentObject3D);

  parentObject3D.add(object3D);

  if (debug) {
    addTransformControl(object3D);
  }
}

class SceneObject {
  object3D: THREE.Object3D;
  parent: SceneObject;
  children: SceneObject[] = [];

  constructor(parent: SceneObject) {
    this.parent = parent;
    if (this.parent) {
      this.parent.children.push(this);
    }
  }

  private add3DGeometry(params: AddObjectParameters = {}, geometry: THREE.BufferGeometry) {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = true;

      obj.object3D = new THREE.Group();

      if (params.showPoints) {
        obj.object3D.add(createPoints(geometry, params));
      } else {
        if (params.wireframe && params.lineWidth) {
          geometry = new WireframeGeometry2(geometry);
        }
        const material = createMaterial(params);
        const mesh = new THREE.Mesh(geometry, material);
        if (params.wireframe && params.lineWidth) {
          mesh.onBeforeRender = () => {
            (mesh.material as LineMaterial).linewidth = convertScreenToWorld(
              mesh,
              params.lineWidth
            );
          };
        }
        obj.object3D.add(mesh);
      }

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  _addMesh(mesh: THREE.Mesh, params: AddObjectParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      addDefaultLights();

      obj.object3D = mesh;

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  clone() {
    const obj = new SceneObject(this.parent);
    promise = promise.then(async () => {
      obj.object3D = this.object3D.clone();
      obj.object3D.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((material) => material.clone())
            : mesh.material.clone();
        }
      });
      this.object3D.parent.add(obj.object3D);
    });
    return obj;
  }

  addGroup(params: AddGroupParameters = {}) {
    const obj = new GroupObject(params.parent || this);

    promise = promise.then(() => {
      obj.object3D = new THREE.Group();

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  add3DModel(url: string, params: AddObjectParameters = {}): GeometryObject {
    const obj = new GeometryObject(params.parent || this);

    promise = promise.then(async () => {
      addDefaultLights();

      let object: THREE.Object3D;
      if (url.endsWith('.obj')) {
        object = await loadObj(url);
      } else if (url.endsWith('.gltf')) {
        object = await loadGLTF(url);
      }

      const { autoResize = true } = params;
      if (autoResize) {
        const aabb = computeAABB(object);

        const size = new THREE.Vector3();
        aabb.getSize(size);
        const length = Math.max(size.x, size.y, size.z);
        object.scale.divideScalar(length);

        const center = new THREE.Vector3();
        aabb.getCenter(center);
        center.divideScalar(length);
        object.position.sub(center);
      }

      const group = new THREE.Group();
      group.add(object);

      object.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          obj.geometry = child.geometry;
          if (params.showPoints) {
            child.parent.add(createPoints(child.geometry, params));
            child.removeFromParent();
          } else {
            if (params.wireframe) {
              child.material.wireframe = true;
            }
            if (params.color) {
              child.material.color = toThreeColor(params.color);
            }
            if (params.opacity !== undefined) {
              child.material.opacity = params.opacity;
            }
            if (params.doubleSided !== undefined) {
              child.material.side = params.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
            }
          }
        }
      });

      obj.object3D = group;
      updateTransform(group, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addCircle(params: AddCircleParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial({ ...params, doubleSided: true });

      const geometry = new THREE.CircleGeometry(params.radius || 0.5, 128);

      obj.object3D = new THREE.Group();
      obj.object3D.add(new THREE.Mesh(geometry, material));

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
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

    const obj = new SceneObject(params.parent || this);

    const { lineWidth = DEFAULT_LINE_WIDTH, arrowStart = false, arrowEnd = true } = params;

    promise = promise.then(async () => {
      addDefaultLights();

      if (params.lighting === undefined) params.lighting = false;

      obj.object3D = createArrowLine(toThreeVector3(p1), toThreeVector3(p2), {
        arrowStart,
        arrowEnd,
        lineWidth,
        color: params.color,
        threeDimensional: true,
      });

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addDoubleArrow(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddLineParameters = {}
  ): SceneObject {
    return this.addArrow(p1, p2, {
      ...params,
      arrowStart: true,
      arrowEnd: true,
    });
  }

  addAxes2D(params: AddAxes2DParameters = {}): SceneObject {
    const {
      xRange = [-4, 4],
      yRange = [-4, 4],
      tickIntervalX = 1,
      tickIntervalY = 1,
      showTicks = true,
      showTickLabels = true,
    } = params;

    const stickLabelSpacing = 0.2;
    const stickLength = 0.2;

    const obj = this.addGroup(params);

    if (showTicks) {
      // X ticks
      const numTicksX = Math.floor((xRange[1] - xRange[0]) / tickIntervalX);
      for (let i = 0; i <= numTicksX; i++) {
        const x = xRange[0] + i * tickIntervalX;
        if (x !== 0) {
          obj.addLine([x, -stickLength * 0.5], [x, stickLength * 0.5], {
            lineWidth: DEFAULT_LINE_WIDTH,
          });
          if (showTickLabels) {
            obj.addText(`${x}`, {
              x,
              y: -stickLabelSpacing,
              anchor: 'top',
              scale: defaultAxesLabelScale,
              font: 'math',
            });
          }
        }
      }

      // Y ticks
      const numTicksY = Math.floor((yRange[1] - yRange[0]) / tickIntervalY);
      for (let i = 0; i <= numTicksY; i++) {
        const y = yRange[0] + i * tickIntervalY;
        if (y !== 0) {
          obj.addLine([-stickLength * 0.5, y], [stickLength * 0.5, y], {
            lineWidth: DEFAULT_LINE_WIDTH,
          });
          if (showTickLabels) {
            obj.addText(`${y}`, {
              x: -stickLabelSpacing,
              y,
              anchor: 'right',
              scale: defaultAxesLabelScale,
              font: 'math',
            });
          }
        }
      }
    }

    obj.addArrow([xRange[0] - tickIntervalX * 0.5, 0, 0], [xRange[1] + tickIntervalX * 0.5, 0, 0], {
      lineWidth: DEFAULT_LINE_WIDTH,
    });
    obj.addArrow([0, yRange[0] - tickIntervalY * 0.5, 0], [0, yRange[1] + tickIntervalY * 0.5, 0], {
      lineWidth: DEFAULT_LINE_WIDTH,
    });

    return obj;
  }

  addAxes3D(params: AddAxes3DParameters = {}): SceneObject {
    const {
      showLabels = true,
      xRange = [-4, 4],
      yRange = [-4, 4],
      zRange = [-4, 4],
      showAxisX = true,
      showAxisY = true,
      showAxisZ = true,
    } = params;

    const obj = this.addGroup(params);

    if (showLabels) {
      const labelColors = ['red', 'green', 'blue'];
      const labelNames = ['x', 'y', 'z'];
      const showLabel = [showAxisX, showAxisY, showAxisZ];
      for (let i = 0; i < 3; i++) {
        if (showLabel[i]) {
          obj.addTex(labelNames[i], {
            color: labelColors[i],
            x: i === 0 ? xRange[1] + 0.4 : 0,
            y: i === 1 ? yRange[1] + 0.4 : 0,
            z: i === 2 ? zRange[1] + 0.4 : 0,
            font: 'math',
            centerTextVertically: true,
            scale: 0.4,
            billboarding: true,
          });
        }
      }
    }

    promise = promise.then(async () => {
      const arrowParams = {
        arrowStart: false,
        arrowEnd: true,
        threeDimensional: true,
        lighting: true,
        lineWidth: 0.05,
      };

      if (showAxisX) {
        obj.object3D.add(
          createArrowLine(new THREE.Vector3(xRange[0], 0, 0), new THREE.Vector3(xRange[1], 0, 0), {
            ...arrowParams,
            color: 'red',
          })
        );
      }
      if (showAxisY) {
        obj.object3D.add(
          createArrowLine(new THREE.Vector3(0, yRange[0], 0), new THREE.Vector3(0, yRange[1], 0), {
            ...arrowParams,
            color: 'green',
          })
        );
      }
      if (showAxisZ) {
        obj.object3D.add(
          createArrowLine(new THREE.Vector3(0, 0, zRange[0]), new THREE.Vector3(0, 0, zRange[1]), {
            ...arrowParams,
            color: 'blue',
          })
        );
      }

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addArc(
    startAngle: number,
    endAngle: number,
    radius = 1,
    params: AddLineParameters = {}
  ): LineObject {
    const obj = new LineObject(params.parent || this);

    promise = promise.then(async () => {
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

      const points2d = curve.getSpacedPoints(64);
      for (const pt of points2d) {
        obj.verts.push(new THREE.Vector3(pt.x, pt.y, 0));
      }
      obj.verts.reverse();
      const line = new Line_(obj.verts, params);

      obj.object3D = line;
      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addGrid(params: AddGridParameters = {}): SceneObject {
    const { gridSize = 10, color } = params;

    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      obj.object3D = new THREE.GridHelper(
        gridSize,
        gridSize,
        color !== undefined ? toThreeColor(color) : 0x00ff00,
        color !== undefined ? toThreeColor(color) : 0xc0c0c0
      );
      obj.object3D.rotation.x = Math.PI / 2;

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addImage(file: string, params: AddTextParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    const { color, ccw } = params;

    promise = promise.then(async () => {
      if (file.endsWith('.svg')) {
        obj.object3D = await loadSVG(file, {
          ccw,
          color,
          opacity: params.opacity || 1.0,
        });
      } else {
        const texture = await loadTexture(file);
        texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: params.opacity || 1.0,
          color: toThreeColor(color),
        });

        const aspect = texture.image.width / texture.image.height;
        const geometry = new THREE.PlaneBufferGeometry(
          aspect > 1 ? aspect : 1,
          aspect > 1 ? 1 : 1 / aspect
        );
        const mesh = new THREE.Mesh(geometry, material);
        obj.object3D = mesh;
      }

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addLine(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddLineParameters = {}
  ): LineObject {
    // For back compat
    if (!Array.isArray(p1)) {
      params = p1;

      const { from } = params as any;
      const { to } = params as any;

      p1 = Array.isArray(from) ? (from as [number, number, number?]) : [from.x, from.y, from.z];
      p2 = Array.isArray(to) ? (to as [number, number, number?]) : [to.x, to.y, to.z];
    }

    return this.addPolyline([p1, p2], params);
  }

  addPoint(position: [number, number, number], params: AddObjectParameters = {}): GeometryObject {
    return addPoints([position], params);
  }

  addPoints(
    positions: [number, number, number][],
    params: AddObjectParameters = {}
  ): GeometryObject {
    const obj = new GeometryObject(params.parent || this);

    promise = promise.then(async () => {
      const vertices = [].concat.apply([], positions);
      obj.geometry = new THREE.BufferGeometry();
      obj.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

      obj.object3D = createPoints(obj.geometry, params);

      updateTransform(obj.object3D, {
        ...params,
      });

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addPolyline(points: [number, number, number?][], params: AddLineParameters = {}): LineObject {
    const obj = new LineObject(params.parent || this);

    promise = promise.then(async () => {
      for (const pt of points) {
        const x = pt[0];
        const y = pt[1];
        const z = pt.length <= 2 ? 0 : pt[2];
        obj.verts.push(new THREE.Vector3(x, y, z));
      }

      const line = new Line_(obj.verts, params);
      obj.object3D = line;

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addPyramid(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.ConeGeometry(0.5, 1.0, 4, 1);
    return this.add3DGeometry({ ...params, flatShading: true }, geometry);
  }

  addCube(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    return this.add3DGeometry(params, geometry);
  }

  addSphere(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.SphereGeometry(0.5, defaultSeg(params), defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addCone(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.ConeGeometry(0.5, 1.0, defaultSeg(params), defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addCylinder(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addTorus(params: AddObjectParameters = {}): SceneObject {
    const geometry = new THREE.TorusGeometry(0.375, 0.125, defaultSeg(params), defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addCircleOutline(params: AddCircleOutlineParameters = {}) {
    const { lineWidth = DEFAULT_LINE_WIDTH, color } = params;

    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const verts = getPolygonVertices({
        sides: 128,
        radius: params.radius || 0.5,
      });
      const v3d = verts.map((v) => new THREE.Vector3(v[0], v[1], 0));
      obj.object3D = createLine3D(v3d.concat(v3d[0]), {
        lineWidth,
        color,
      });

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addRectOutline(params: AddOutlineParameters = {}) {
    const { width = 1, height = 1 } = params;

    const obj = new LineObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;

      const halfWidth = width * 0.5;
      const halfHeight = height * 0.5;
      obj.verts.push(
        new THREE.Vector3(-halfWidth, -halfHeight, 0),
        new THREE.Vector3(-halfWidth, halfHeight, 0),
        new THREE.Vector3(halfWidth, halfHeight, 0),
        new THREE.Vector3(halfWidth, -halfHeight, 0),
        new THREE.Vector3(-halfWidth, -halfHeight, 0)
      );

      const line = new Line_(obj.verts, params);
      obj.object3D = line;

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addRect(params: AddRectParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial({ ...params, doubleSided: true });

      const { width = 1, height = 1 } = params;
      const geometry = new THREE.PlaneGeometry(width, height);

      obj.object3D = new THREE.Group();
      obj.object3D.add(new THREE.Mesh(geometry, material));

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  setClipRect(params: AddRectParameters = {}): SceneObject {
    promise = promise.then(async () => {
      const { width = 1, height = 1 } = params;

      const clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), 1),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 1),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), 1),
      ];

      (this.object3D as any).onUpdate = () => {
        getAllMaterials(this.object3D).forEach((material) => {
          material.clippingPlanes = clippingPlanes;
        });

        const worldPosition = new THREE.Vector3();
        this.object3D.getWorldPosition(worldPosition);
        const worldScale = new THREE.Vector3();
        this.object3D.getWorldScale(worldScale);

        clippingPlanes[0].constant = -worldPosition.x + 0.5 * worldScale.x * width;
        clippingPlanes[1].constant = worldPosition.x + 0.5 * worldScale.x * width;
        clippingPlanes[2].constant = -worldPosition.y + 0.5 * worldScale.y * height;
        clippingPlanes[3].constant = worldPosition.y + 0.5 * worldScale.y * height;
      };
    });
    return this;
  }

  addPolygon(vertices: [number, number][], params: AddPolygonParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial({ ...params, doubleSided: true });

      // Vertex positions
      const positions: number[] = [];
      for (const v of vertices) {
        positions.push(v[0], v[1], 0);
      }

      // Indices
      const indices: number[] = [];
      for (let i = 0; i < vertices.length - 2; i++) {
        indices.push(0, i + 1, i + 2);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();

      obj.object3D = new THREE.Group();
      obj.object3D.add(new THREE.Mesh(geometry, material));

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addPolygonOutline(vertices: [number, number, number?][], params: AddPolygonParameters = {}) {
    return this.addPolyline(vertices.concat([vertices[0]]), params);
  }

  addTriangle(params: AddPolygonParameters = {}): SceneObject {
    return this.addPolygon(getTriangleVertices(), params);
  }

  addTriangleOutline(params: AddOutlineParameters = {}) {
    const { lineWidth = DEFAULT_LINE_WIDTH, color } = params;

    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;

      const verts = getPolygonVertices();
      const v3d = verts.map((v) => new THREE.Vector3(v[0], v[1], 0));
      obj.object3D = createLine3D(v3d.concat(v3d[0]), {
        lineWidth,
        color,
      });

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addText(text: string, params: AddTextParameters = {}): TextObject {
    const obj = new TextObject(params.parent || this);

    promise = promise.then(async () => {
      const material = createMaterial({ ...params, doubleSided: true });

      const textObject = new TextMeshObject({
        ...params,
        color: toThreeColor(params.color),
        material,
      });
      await textObject.init();
      textObject.setText(text, true);

      obj.object3D = textObject;
      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addText3D(text: string, params: AddText3DParameters = {}): TextObject {
    const obj = new TextObject(params.parent || this);

    promise = promise.then(async () => {
      const material = createMaterial({
        ...params,
        lighting: params.lighting !== undefined ? params.lighting : true,
        doubleSided: true,
      });

      const textObject = new TextMeshObject({
        ...params,
        color: toThreeColor(params.color),
        material,
        text3D: true,
      });
      await textObject.init();
      textObject.setText(text, true);

      obj.object3D = textObject;
      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addTextOutline(text: string, params: AddTextOutlineParameters = {}): TextObject {
    const obj = new TextObject(params.parent || this);

    promise = promise.then(async () => {
      const material = createMaterial({ ...params, doubleSided: true });

      const textObject = new TextMeshObject({
        ...params,
        color: toThreeColor(params.color),
        stroke: true,
        strokeWidth: params.lineWidth || DEFAULT_LINE_WIDTH,
        material,
      });
      await textObject.init();
      textObject.setText(text, true);

      obj.object3D = textObject;
      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addTex(tex: string, params: AddTextParameters = {}): TexObject {
    const obj = new TexObject(params.parent || this);
    obj._initParams = params;

    promise = promise.then(async () => {
      const texObject = await createTexObject(tex, {
        color: `#${toThreeColor(params.color).getHexString()}`,
      });
      updateTransform(texObject, params);
      obj.object3D = texObject;
      if (engine.outlinePass) {
        engine.outlinePass.selectedObjects.push(texObject);
      }

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addFrustum(params: AddFrustumParameters = {}) {
    const obj = new FrustumObject(params.parent || this);

    promise = promise.then(async () => {
      const { fov = 45, near = 1, far = 5, aspect = 1 } = params;

      const group = new THREE.Group();
      obj.perspectiveCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      obj.perspectiveCameraHelper = new THREE.CameraHelper(obj.perspectiveCamera);
      group.add(obj.perspectiveCamera);
      group.add(obj.perspectiveCameraHelper);
      obj.object3D = group;

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  moveTo(params: MoveObjectParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });
      tl.add(
        createTransformAnimation({
          ...params,
          object3d: this.object3D,
          duration,
          ease,
        }),
        '<'
      );
      mainTimeline.add(tl, t);
    });
    return this;
  }

  setPos(pos: [number, number, number?], params: AnimationParameters = {}) {
    promise = promise.then(() => {
      mainTimeline.set(
        this.object3D.position,
        {
          x: pos[0],
          y: pos[1],
          z: pos[2] || 0,
        },
        params.t
      );
    });
    return this;
  }

  scale(scale: number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      tl.to(
        this.object3D.scale,
        {
          x: scale,
          y: scale,
          z: scale,
        },
        '<'
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  /**
   * @deprecated Use `scale()` instead.
   */
  scaleTo(scale: number, params: AnimationParameters = {}) {
    return this.scale(scale, params);
  }

  scaleX(sx: number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      tl.to(this.object3D.scale, { x: sx }, '<');
      mainTimeline.add(tl, t);
    });
    return this;
  }

  scaleY(sy: number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      tl.to(this.object3D.scale, { y: sy }, '<');
      mainTimeline.add(tl, t);
    });
    return this;
  }

  scaleZ(sz: number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      tl.to(this.object3D.scale, { z: sz }, '<');
      mainTimeline.add(tl, t);
    });
    return this;
  }

  /**
   * @deprecated Use `scaleX()` instead.
   */
  scaleXTo(sx: number, params: AnimationParameters = {}) {
    return this.scaleX(sx, params);
  }

  /**
   * @deprecated Use `scaleY()` instead.
   */
  scaleYTo(sy: number, params: AnimationParameters = {}) {
    return this.scaleY(sy, params);
  }

  /**
   * @deprecated Use `scaleZ()` instead.
   */
  scaleZTo(sz: number, params: AnimationParameters = {}) {
    return this.scaleZ(sz, params);
  }

  fadeIn(params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = engine.defaultDuration, ease = engine.defaultEase, t } = params;
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

  changeOpacity(opacity: number, params: FadeObjectParameters = {}) {
    promise = promise.then(() => {
      const { duration = engine.defaultDuration, ease = engine.defaultEase, t } = params;
      const tl = createOpacityAnimation(this.object3D, { duration, ease, opacity });
      mainTimeline.add(tl, t);
    });
    return this;
  }

  changeColor(
    color: string | number,
    { duration = 0.25, ease = 'power1.inOut', t }: AnimationParameters = {}
  ) {
    promise = promise.then(() => {
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
            '<'
          );
        }
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotate(r: [number?, number?, number?], params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;
      const tl = gsap.timeline({ defaults: { duration, ease } });

      if (r[0] !== undefined) {
        tl.to(this.object3D.rotation, { x: r[0] * DEG2RAD }, '<');
      }
      if (r[1] !== undefined) {
        tl.to(this.object3D.rotation, { y: r[1] * DEG2RAD }, '<');
      }
      if (r[2] !== undefined) {
        tl.to(this.object3D.rotation, { z: r[2] * DEG2RAD }, '<');
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotateX(degrees: number, params: AnimationParameters = {}) {
    this.rotate([degrees, undefined, undefined], params);
    return this;
  }

  rotateY(degrees: number, params: AnimationParameters = {}) {
    this.rotate([undefined, degrees, undefined], params);
    return this;
  }

  rotateZ(degrees: number, params: AnimationParameters = {}) {
    this.rotate([undefined, undefined, degrees], params);
    return this;
  }

  /**
   * @deprecated Use `rotate()` instead.
   */
  rotateTo(rx?: number, ry?: number, rz?: number, params: AnimationParameters = {}) {
    return this.rotate([rx, ry, rz], params);
  }

  /**
   * @deprecated Use `rotateX()` instead.
   */
  rotateXTo(degrees: number, params: AnimationParameters = {}) {
    return this.rotateX(degrees, params);
  }

  /**
   * @deprecated Use `rotateY()` instead.
   */
  rotateYTo(degrees: number, params: AnimationParameters = {}) {
    return this.rotateY(degrees, params);
  }

  spinning({
    t,
    duration = 5,
    repeat,
    ease = 'none',
    x = Math.PI * 2,
    y = -Math.PI * 2,
  }: RotateParameters = {}) {
    promise = promise.then(() => {
      const tl = gsap.timeline({
        defaults: { duration, ease, repeat },
      });

      tl.to(this.object3D.rotation, { x, y }, '<');

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotateIn(params: RotateInParameters = {}) {
    promise = promise.then(() => {
      const {
        t,
        duration = engine.defaultDuration,
        ease = engine.defaultEase,
        axis = 'z',
        rotation = 360,
      } = params;
      const tl = gsap.timeline({ defaults: { duration, ease } });

      if (axis === 'x') {
        tl.from(this.object3D.rotation, { x: rotation * DEG2RAD, duration }, '<');
      } else if (axis === 'y') {
        tl.from(this.object3D.rotation, { y: rotation * DEG2RAD, duration }, '<');
      } else if (axis === 'z') {
        tl.from(this.object3D.rotation, { z: rotation * DEG2RAD, duration }, '<');
      }

      tl.from(
        this.object3D.scale,
        {
          x: Number.EPSILON,
          y: Number.EPSILON,
          z: Number.EPSILON,
          duration,
        },
        '<'
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  grow(params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, ease = engine.defaultEase, duration = engine.defaultDuration } = params;
      this.object3D.visible = false;

      const tl = gsap.timeline();
      tl.set(this.object3D, { visible: true });
      tl.from(
        this.object3D.scale,
        {
          x: 0,
          y: 0,
          z: 0,
          ease,
          duration,
        },
        '<'
      );
      mainTimeline.add(tl, t);
    });
    return this;
  }

  grow2({ t }: AnimationParameters = {}) {
    promise = promise.then(() => {
      const tl = gsap.timeline();

      tl.fromTo(
        this.object3D,
        { visible: false },
        { visible: true, ease: 'none', duration: 0.001 }
      );

      tl.from(
        this.object3D.scale,
        {
          x: 0,
          y: 0,
          z: 0,
          ease: 'elastic.out(1, 0.75)',
          onStart: () => {
            this.object3D.visible = true;
          },
        },
        '<'
      );

      mainTimeline.add(tl, t);
    });
    return this;
  }

  grow3({ t }: AnimationParameters = {}) {
    promise = promise.then(() => {
      mainTimeline.from(
        this.object3D.scale,
        {
          x: 0,
          y: 0,
          z: 0,
          ease: 'elastic.out(1, 0.2)',
          duration: 1.0,
        },
        t
      );
    });
    return this;
  }

  shrink(params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, ease = engine.defaultEase, duration = engine.defaultDuration } = params;

      const tl = gsap.timeline();
      tl.to(
        this.object3D.scale,
        {
          x: 0,
          y: 0,
          z: 0,
          ease,
          duration,
        },
        '<'
      );
      tl.set(this.object3D, { visible: false });
      mainTimeline.add(tl, t);
    });
    return this;
  }

  flying({ t, duration = 5 }: AnimationParameters = {}) {
    const WIDTH = 30;
    const HEIGHT = 15;

    promise = promise.then(() => {
      const tl = gsap.timeline();

      this.object3D.children.forEach((x) => {
        tl.fromTo(
          x.position,
          {
            x: engine.rng() * WIDTH - WIDTH / 2,
            y: engine.rng() * HEIGHT - HEIGHT / 2,
          },
          {
            x: engine.rng() * WIDTH - WIDTH / 2,
            y: engine.rng() * HEIGHT - HEIGHT / 2,
            duration,
            ease: 'none',
          },
          0
        );
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  reveal(params: RevealParameters = {}) {
    promise = promise.then(() => {
      const {
        direction = 'up',
        t,
        duration = engine.defaultDuration,
        ease = engine.defaultEase,
      } = params;
      const object3d = this.object3D;
      const clippingPlanes: THREE.Plane[] = [];
      const bbox = computeAABB(object3d);
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
        '<'
      );

      const pos = object3d.position.clone();
      object3d.localToWorld(pos);
      if (direction === 'right') {
        clippingPlanes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -bbox.min.x));
        pos.x -= bbox.max.x - bbox.min.x;
      } else if (direction === 'left') {
        clippingPlanes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), bbox.max.x));
        pos.x += bbox.max.x - bbox.min.x;
      } else if (direction === 'up') {
        clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -bbox.min.y));
        pos.y -= bbox.max.y - bbox.min.y;
      } else if (direction === 'down') {
        clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), bbox.max.y));
        pos.y += bbox.max.y - bbox.min.y;
      }
      object3d.worldToLocal(pos);

      tl.from(object3d.position, {
        x: pos.x,
        y: pos.y,
      });

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

  revealL(params: RevealParameters = {}) {
    return this.reveal({ ...params, direction: 'left' });
  }

  revealR(params: RevealParameters = {}) {
    return this.reveal({ ...params, direction: 'right' });
  }

  revealU(params: RevealParameters = {}) {
    return this.reveal({ ...params, direction: 'up' });
  }

  revealD(params: RevealParameters = {}) {
    return this.reveal({ ...params, direction: 'down' });
  }

  vertexToAnimate = new Map<number, THREE.Vector3>();

  wipeIn(params: WipeInParameters = {}) {
    promise = promise.then(() => {
      const {
        direction = 'right',
        t,
        duration = engine.defaultDuration,
        ease = engine.defaultEase,
      } = params;
      this.object3D.visible = false;

      const boundingBox = computeAABB(this.object3D);
      const materials = getAllMaterials(this.object3D);

      const tl = gsap.timeline({
        defaults: { duration, ease },
      });

      let clipPlane: THREE.Plane;
      if (direction === 'right') {
        clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0));
      } else if (direction === 'left') {
        clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0));
      } else if (direction === 'up') {
        clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0));
      } else if (direction === 'down') {
        clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
      }

      tl.set(this.object3D, {
        visible: true,
        onComplete: () => {
          for (const material of materials) {
            material.clippingPlanes = [clipPlane];
          }
        },
      });

      if (direction === 'right') {
        tl.fromTo(clipPlane, { constant: boundingBox.min.x }, { constant: boundingBox.max.x });
      } else if (direction === 'left') {
        tl.fromTo(clipPlane, { constant: boundingBox.min.x }, { constant: boundingBox.max.x });
      } else if (direction === 'up') {
        tl.fromTo(clipPlane, { constant: boundingBox.min.y }, { constant: boundingBox.max.y });
      } else if (direction === 'down') {
        tl.fromTo(clipPlane, { constant: boundingBox.min.y }, { constant: boundingBox.max.y });
      }

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

  shake2D({ interval = 0.01, duration = 0.2, strength = 0.2, t }: Shake2DParameters = {}) {
    function R(max: number, min: number) {
      return engine.rng() * (max - min) + min;
    }

    promise = promise.then(() => {
      const object3d = this.object3D;

      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      tl.set(object3d, { x: '+=0' }); // this creates a full _gsTransform on object3d

      // store the transform values that exist before the shake so we can return to them later
      const initProps = {
        x: object3d.position.x,
        y: object3d.position.y,
        rotation: object3d.position.z,
      };

      // shake a bunch of times
      for (let i = 0; i < duration / interval; i++) {
        const offset = R(-strength, strength);
        tl.to(object3d.position, {
          x: initProps.x + offset,
          y: initProps.y - offset,
          // rotation: initProps.rotation + R(-5, 5)
          duration: interval,
        });
      }
      // return to pre-shake values
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
    promise = promise.then(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none', duration } });
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
    ease = 'expo.out',
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
    promise = promise.then(() => {
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

  implode2D(params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration } = params;
      const tl = gsap.timeline({
        defaults: {
          duration,
          ease: 'expo.inOut',
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

  flyIn(params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;
      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      this.object3D.children.forEach((child) => {
        tl.from(child.rotation, { x: -Math.PI / 2 }, `<${duration * 0.1}`);
        tl.from(
          child.position,
          {
            y: -child.scale.length() * 0.5,
            z: -child.scale.length() * 2,
          },
          '<'
        );
        tl.add(createFadeInAnimation(child, { duration, ease }), '<');
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }
}

function addCustomAnimation(tl: gsap.core.Timeline, callback: (t: number) => void) {
  const data = { val: 0 };
  tl.fromTo(
    data,
    { val: 0 },
    {
      val: 1,
      ease: 'linear',
      onUpdate: () => {
        callback(data.val);
      },
    },
    '<'
  );
}

interface ChangeTextParameters extends AnimationParameters {
  from?: number;
  to?: number;
}

interface TypeTextParameters extends AnimationParameters {
  interval?: number;
}

class TextObject extends GroupObject {
  changeText(func: (val: number) => any, params: ChangeTextParameters = {}) {
    promise = promise.then(() => {
      const {
        from = 0,
        to = 1,
        duration = engine.defaultDuration,
        ease = engine.defaultEase,
        t,
      } = params;

      const data = { val: from };
      mainTimeline.to(
        data,
        {
          val: to,
          duration,
          ease,
          onUpdate: () => {
            const text = func(data.val).toString();
            (this.object3D as TextMeshObject).setText(text);
          },
        },
        t
      );
    });
    return this;
  }

  typeText({ t, duration, interval = 0.1 }: TypeTextParameters = {}) {
    promise = promise.then(() => {
      const textObject = this.object3D as any;

      if (duration !== undefined) {
        interval = duration / textObject.children.length;
      }

      const tl = gsap.timeline({
        defaults: { duration: interval, ease: 'steps(1)' },
      });

      textObject.children.forEach((letter: any) => {
        tl.fromTo(letter, { visible: false }, { visible: true });
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  /**
   * @deprecated Use `setText()` instead.
   */
  updateText(text: string, params: AnimationParameters = {}) {
    this.setText(text, params.t);
    return this;
  }

  setText(text: string, t?: number | string) {
    promise = promise.then(async () => {
      mainTimeline.set(
        {},
        {
          onComplete: () => {
            const textMesh = this.object3D as TextMeshObject;
            textMesh.setText(text);
          },
        },
        t
      );
    });
  }
}

class LineObject extends SceneObject {
  verts: THREE.Vector3[] = [];

  /**
   * @deprecated Use `setVert()` instead.
   */
  updateVert(i: number, position: [number, number, number?], params: AnimationParameters = {}) {
    this.setVert(i, position, params.t);
    return this;
  }

  moveVert(i: number, position: [number, number, number?], params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = engine.defaultDuration, ease = engine.defaultEase, t } = params;
      if (this.object3D.type == 'Line2') {
        console.assert(this.verts.length > 0);
        const line = this.object3D as Line2;

        const vert = this.verts[i];
        const onUpdate = () => {
          updateLinePoints(this.verts, line.geometry);
        };

        if (duration) {
          mainTimeline.to(
            vert,
            {
              ease,
              duration,
              x: position[0],
              y: position[1],
              z: position[2] || 0,
              onUpdate,
            },
            t
          );
        } else {
          mainTimeline.set(
            vert,
            { x: position[0], y: position[1], z: position[2] || 0, onUpdate },
            t
          );
        }
      }
    });
    return this;
  }

  setVert(i: number, position: [number, number, number?], t?: number | string) {
    return this.moveVert(i, position, { t, duration: 0 });
  }

  animateLineDrawing(params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = engine.defaultDuration, ease = engine.defaultEase } = params;

      const animParams = {
        progress: 0,
      };

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      this.object3D.visible = false;
      tl.set(this.object3D, { visible: true });
      tl.fromTo(
        animParams,
        { progress: 0 },
        {
          progress: 1,
          onUpdate: () => {
            updateLinePoints(this.verts, (this.object3D as Line2).geometry, animParams.progress);
            (this.object3D as Line2).computeLineDistances();
          },
        }
      );
      mainTimeline.add(tl, t);
    });
    return this;
  }
}

interface TransformTexParameters extends AnimationParameters {
  type?: 'transform' | 'crossfade';
  reverse?: boolean;
}

function createTextTransformAnimation(
  from: THREE.Object3D[],
  to: THREE.Object3D[],
  params: TransformTexParameters = {}
) {
  const { duration = 1, t, ease = engine.defaultEase, type = 'transform' } = params;

  if (type === 'transform') {
    const tl = gsap.timeline({ defaults: { ease, duration } });

    // From tex objects
    const fromTexObjects = [];
    for (const o of from) {
      tl.set(o, { visible: true }, '<');
      tl.set(o.children, { visible: true }, '<');
      o.updateWorldMatrix(true, true);
      console.assert(o instanceof THREE.Group);
      for (const c of o.children) {
        fromTexObjects.push(c);
      }
    }

    // Dest tex objects
    const toTexObjects = [];
    for (const o of to) {
      tl.set(o, { visible: true }, '<');
      for (const c of o.children) {
        c.visible = false;
      }
      o.updateWorldMatrix(true, true);
      console.assert(o instanceof THREE.Group);
      for (const c of o.children) {
        toTexObjects.push(c);
      }
    }

    if (params.reverse) {
      toTexObjects.reverse();
      fromTexObjects.reverse();
    }

    const diff: ['+' | '-' | '=', number, number?][] = [];
    {
      const a = fromTexObjects.map((x) => `${x.name}`);
      const b = toTexObjects.map((x) => `${x.name}`);
      let j = 0;
      let k = 0;
      for (const d of Diff.diffArrays(a, b)) {
        for (let i = 0; i < d.count; i++) {
          if (d.added) {
            diff.push(['+', k]);
            k++;
          } else if (d.removed) {
            diff.push(['-', j]);
            j++;
          } else {
            diff.push(['=', j, k]);
            j++;
            k++;
          }
        }
      }
    }

    for (const [op, i, j] of diff) {
      if (op === '=') {
        const c1 = fromTexObjects[i];
        const c2 = toTexObjects[j];

        const posInSrcTexObject = new THREE.Vector3();
        const scaleInSrcTexObject = new THREE.Vector3();
        tl.set(
          {},
          {
            onComplete: () => {
              c2.getWorldPosition(posInSrcTexObject);
              c1.parent.worldToLocal(posInSrcTexObject);

              c2.getWorldScale(scaleInSrcTexObject);
              scaleInSrcTexObject.divide(c1.parent.getWorldScale(new THREE.Vector3()));
            },
          },
          0
        );

        tl.to(
          c1.position,
          {
            x: () => posInSrcTexObject.x,
            y: () => posInSrcTexObject.y,
            z: () => posInSrcTexObject.z,
          },
          0
        );
        tl.to(
          c1.scale,
          {
            x: () => scaleInSrcTexObject.x,
            y: () => scaleInSrcTexObject.y,
            z: () => scaleInSrcTexObject.z,
          },
          0
        );
      } else if (op === '-') {
        const c1 = fromTexObjects[i];
        tl.add(createOpacityAnimation(c1, { duration, ease: 'power4.out' }), 0);
      } else if (op === '+') {
        const c = toTexObjects[i];
        tl.add(createFadeInAnimation(c, { duration, ease: 'power4.in' }), 0);
      }
    }

    // Hide all symbols in srcTexObject
    tl.set(fromTexObjects, { visible: false }, '+=0');

    // Show all symbols in dstTexObject
    tl.set(toTexObjects, { visible: true }, '+=0');

    return tl;
  } else if (type === 'crossfade') {
    const tl = gsap.timeline({ defaults: { ease, duration } });

    // From tex objects
    for (const o of from) {
      tl.add(createOpacityAnimation(o, { duration, ease: 'expo.out' }), 0);
    }

    // Dest tex objects
    for (const o of to) {
      tl.add(createFadeInAnimation(o, { duration, ease: 'expo.out' }), 0);
    }

    return tl;
  } else {
    throw new Error(`Unknown type: ${type}`);
  }
}

class TexObject extends GroupObject {
  _initParams: AddTextParameters;

  transformTexTo(to: string | TexObject | TexObject[], params: TransformTexParameters = {}) {
    promise = promise.then(async () => {
      if (typeof to === 'string') {
        const dstTexObject = await createTexObject(to, {
          color: `#${toThreeColor(this._initParams.color).getHexString()}`,
        });
        // updateTransform(dstTexObject, this._initParams);
        this.object3D.parent.add(dstTexObject);
        const srcTexObject = this.object3D;

        const { duration = 1, ease = engine.defaultEase } = params;
        const tl = gsap.timeline({ defaults: { ease, duration } });
        tl.set(
          {},
          {
            onComplete: () => {
              dstTexObject.position.copy(srcTexObject.position);
              dstTexObject.scale.copy(srcTexObject.scale);
              dstTexObject.rotation.copy(srcTexObject.rotation);
            },
          },
          0
        );
        tl.add(createTextTransformAnimation([srcTexObject], [dstTexObject], params), 0);
        mainTimeline.add(tl, params.t);

        this.object3D = dstTexObject;
      } else if (to instanceof TexObject) {
        const tl = createTextTransformAnimation([this.object3D], [to.object3D], params);
        mainTimeline.add(tl, params.t);
      } else {
        const tl = createTextTransformAnimation(
          [this.object3D],
          to.map((x) => x.object3D),
          params
        );
        mainTimeline.add(tl, params.t);
      }
    });

    return this;
  }

  transformTexFrom(from: TexObject | TexObject[], params: TransformTexParameters = {}) {
    promise = promise.then(async () => {
      if (from instanceof TexObject) {
        from = [from];
      }

      const tl = createTextTransformAnimation(
        from.map((x) => x.object3D),
        [this.object3D],
        params
      );
      mainTimeline.add(tl, params.t);
    });

    return this;
  }

  clone() {
    const superClone = super.clone();
    const copy = Object.assign(new TexObject((superClone as GroupObject).parent), superClone);
    promise = promise.then(async () => {
      for (const attr in superClone) {
        if (superClone.hasOwnProperty(attr)) {
          (copy as any)[attr] = (superClone as any)[attr];
        }
      }
    });
    return copy;
  }

  /**
   * @deprecated Use `setTex()` instead.
   */
  updateTex(tex: string, params: AnimationParameters = {}) {
    this.setTex(tex, params.t);
    return this;
  }

  setTex(tex: string, t?: number | string) {
    promise = promise.then(async () => {
      const newTexObject = await createTexObject(tex, {
        color: `#${toThreeColor(this._initParams.color).getHexString()}`,
      });
      newTexObject.visible = false;
      this.object3D.add(newTexObject);

      const tl = gsap.timeline();
      tl.set(this.object3D.children, { visible: false }, '<');
      tl.set(newTexObject, { visible: true }, '<');
      mainTimeline.add(tl, t);
    });
  }
}

interface AddTextParameters extends Transform, BasicMaterial {
  font?: 'en' | 'condensed' | 'code' | 'math' | 'arcade' | 'zh' | 'gdh';
  fontSize?: number;
  letterSpacing?: number;
  centerTextVertically?: boolean;
  ccw?: boolean;
}

interface AddText3DParameters extends AddTextParameters {}

interface AddTextOutlineParameters extends AddTextParameters {
  lineWidth?: number;
}

interface AddRectParameters extends Transform, BasicMaterial {
  width?: number;
  height?: number;
}

interface AddCircleParameters extends Transform, BasicMaterial {
  radius?: number;
}

interface AddPolygonParameters extends Transform, BasicMaterial {}

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

function _addPanoramicSkybox(file: string) {
  const obj = new SceneObject(null);

  promise = promise.then(async () => {
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    // invert the geometry on the x-axis so that all of the faces point inward
    geometry.scale(-1, 1, 1);

    const texture = new THREE.TextureLoader().load(file);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const skySphere = new THREE.Mesh(geometry, material);
    engine.scene.add(skySphere);

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

interface AddAxes2DParameters extends Transform, BasicMaterial {
  xRange?: [number, number, number?];
  yRange?: [number, number, number?];
  showTicks?: boolean;
  showTickLabels?: boolean;
  tickIntervalX?: number;
  tickIntervalY?: number;
}

interface AddAxes3DParameters extends Transform, BasicMaterial {
  showAxisX?: boolean;
  showAxisY?: boolean;
  showAxisZ?: boolean;
  xRange?: [number, number, number?];
  yRange?: [number, number, number?];
  zRange?: [number, number, number?];
  showLabels?: boolean;
}

interface AddGridParameters extends Transform, BasicMaterial {
  gridSize?: number;
}

function toThreeVector3(v?: { x?: number; y?: number; z?: number } | [number, number, number?]) {
  if (v === undefined) {
    return new THREE.Vector3(0, 0, 0);
  }
  if (Array.isArray(v)) {
    if (v.length == 2) {
      return new THREE.Vector3(v[0], v[1]);
    }
    if (v.length == 3) {
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
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  position?: [number, number] | [number, number, number];
  scale?: number;
  parent?: SceneObject;
  anchor?:
    | 'left'
    | 'right'
    | 'top'
    | 'bottom'
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight';
  billboarding?: boolean;
  autoResize?: boolean;
}

interface AddObjectParameters extends Transform, BasicMaterial {
  vertices?: any;
  outline?: any;
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
  doubleSided?: boolean;
  flatShading?: boolean;
  lineWidth?: number;
  showPoints?: boolean;
  pointSize?: number;
  dashed?: boolean;
}

function createPoints(geometry: THREE.BufferGeometry, params: BasicMaterial = {}) {
  const points = new THREE.Points(geometry, createMaterial({ ...params, showPoints: true }));
  points.onBeforeRender = () => {
    (points.material as THREE.PointsMaterial).size = convertScreenToWorld(
      points,
      params.pointSize || DEFAULT_POINT_SIZE
    );
  };
  return points;
}

function createMaterial(params: BasicMaterial = {}) {
  const side = params.doubleSided === undefined ? THREE.FrontSide : THREE.DoubleSide;

  if (params.showPoints) {
    return new THREE.PointsMaterial({ color: toThreeColor(params.color) });
  }
  if (params.wireframe) {
    if (params.lineWidth) {
      return createLineMaterial(params.color, params.lineWidth, params.dashed);
    } else {
      return new THREE.MeshBasicMaterial({
        side,
        color: toThreeColor(params.color),
        wireframe: true,
      });
    }
  }
  if (params.lighting) {
    addDefaultLights();

    return new THREE.MeshStandardMaterial({
      side,
      color: toThreeColor(params.color),
      roughness: 0.5,
      transparent: params.opacity !== undefined && params.opacity < 1.0,
      opacity: params.opacity || 1.0,
      flatShading: params.flatShading,
    });
  }
  return new THREE.MeshBasicMaterial({
    side,
    color: toThreeColor(params.color),
    transparent: params.opacity !== undefined && params.opacity < 1.0,
    opacity: params.opacity || 1.0,
  });
}

function fixRotation(rotation: number) {
  // XXX: when rx is greater than 10, use it as a degrees instead of radians.
  return Math.abs(rotation) >= 10 ? rotation * DEG2RAD : rotation;
}

function updateTransform(obj: THREE.Object3D, transform: Transform) {
  // Position
  if (transform.position !== undefined) {
    obj.position.copy(toThreeVector3(transform.position));
  } else {
    for (const prop of ['x', 'y', 'z']) {
      const T = transform as any;
      const V = obj.position as any;
      if (T[prop] !== undefined) {
        V[prop] = T[prop];
      }
    }
  }

  if (transform.anchor !== undefined) {
    console.assert(obj.children.length > 0);

    const aabb = computeAABB(obj);
    const size = aabb.getSize(new THREE.Vector3());
    if (transform.anchor === 'left') {
      for (const child of obj.children) {
        child.translateX(size.x / 2);
      }
    } else if (transform.anchor === 'right') {
      for (const child of obj.children) {
        child.translateX(-size.x / 2);
      }
    } else if (transform.anchor === 'top') {
      for (const child of obj.children) {
        child.translateY(-size.y / 2);
      }
    } else if (transform.anchor === 'bottom') {
      for (const child of obj.children) {
        child.translateY(size.y / 2);
      }
    } else if (transform.anchor === 'topLeft') {
      for (const child of obj.children) {
        child.translateX(size.x / 2);
        child.translateY(-size.y / 2);
      }
    } else if (transform.anchor === 'topRight') {
      for (const child of obj.children) {
        child.translateX(-size.x / 2);
        child.translateY(-size.y / 2);
      }
    } else if (transform.anchor === 'bottomLeft') {
      for (const child of obj.children) {
        child.translateX(size.x / 2);
        child.translateY(size.y / 2);
      }
    } else if (transform.anchor === 'bottomRight') {
      for (const child of obj.children) {
        child.translateX(-size.x / 2);
        child.translateY(size.y / 2);
      }
    }
  }

  // Scale
  if (transform.scale !== undefined) {
    obj.scale.multiplyScalar(transform.scale);
  } else {
    if (transform.sx !== undefined) {
      obj.scale.x = transform.sx;
    }
    if (transform.sy !== undefined) {
      obj.scale.y = transform.sy;
    }
    if (transform.sz !== undefined) {
      obj.scale.z = transform.sz;
    }
  }

  // Rotation
  if (transform.rx !== undefined) {
    obj.rotation.x = fixRotation(transform.rx);
  }
  if (transform.ry !== undefined) {
    obj.rotation.y = fixRotation(transform.ry);
  }
  if (transform.rz !== undefined) {
    obj.rotation.z = fixRotation(transform.rz);
  }

  if (transform.billboarding) {
    // TODO: avoid monkey patching
    (obj as any).billboarding = true;
  }
}

export function setActiveLayer(layer: 'ui' | 'main') {
  engine.activeLayer = layer;
}

interface AddGroupParameters extends Transform {}

export function getQueryString(url: string = undefined) {
  // get query string from url (optional) or window
  let queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // we'll store the parameters here
  const obj: any = {};

  // if query string exists
  if (queryString) {
    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split('#')[0];

    // split our query string into its component parts
    const arr = queryString.split('&');

    for (let i = 0; i < arr.length; i++) {
      // separate the keys and the values
      const a = arr[i].split('=');

      // set parameter name and value (use 'true' if empty)
      let paramName = a[0];
      let paramValue = typeof a[1] === 'undefined' ? true : a[1];

      // (optional) keep case consistent
      paramName = paramName.toLowerCase();
      if (typeof paramValue === 'string') {
        // paramValue = paramValue.toLowerCase();
        paramValue = decodeURIComponent(paramValue);
      }

      // if the paramName ends with square brackets, e.g. colors[] or colors[2]
      if (paramName.match(/\[(\d+)?\]$/)) {
        // create key if it doesn't exist
        const key = paramName.replace(/\[(\d+)?\]/, '');
        if (!obj[key]) obj[key] = [];

        // if it's an indexed array e.g. colors[2]
        if (paramName.match(/\[\d+\]$/)) {
          // get the index value and add the entry at the appropriate position
          const index = /\[(\d+)\]/.exec(paramName)[1];
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
        } else if (obj[paramName] && typeof obj[paramName] === 'string') {
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
  engine.rng = seedrandom(val);
}

export function random(min = 0, max = 1) {
  return min + engine.rng() * (max - min);
}

function getGridPosition({ rows = 1, cols = 1, width = 25, height = 14 } = {}) {
  const gapX = width / cols;
  const gapY = height / rows;

  const startX = (width / cols - width) * 0.5;
  const startY = (height / rows - height) * 0.5;

  const results = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      results.push(new THREE.Vector3(j * gapX + startX, -(i * gapY + startY), 0));
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
  promise = promise.then(() => {
    engine.scene.background = toThreeColor(color);
  });
}

export function fadeOutAll(params: AnimationParameters = {}) {
  const root = getRoot();
  promise = promise.then(() => {
    const tl = gsap.timeline();
    for (const object3d of root.object3D.children) {
      tl.add(createOpacityAnimation(object3d, { duration: params.duration }), '<');
    }
    mainTimeline.add(tl, params.t);
  });
}

export function hideAll(params: AnimationParameters = {}) {
  const root = getRoot();
  promise = promise.then(() => {
    const tl = gsap.timeline();
    for (const object3d of root.object3D.children) {
      tl.set(object3d, { visible: false }, '<');
    }
    mainTimeline.add(tl, params.t);
  });
}

export function pause(duration: number | string) {
  promise = promise.then(() => {
    mainTimeline.set({}, {}, typeof duration === 'number' ? `+=${duration.toString()}` : duration);
  });
}

export function enableBloom() {
  promise = promise.then(() => {
    if (!engine.composer.passes.includes(engine.bloomPass)) {
      engine.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(renderTargetWidth, renderTargetHeight),
        0.5, // Strength
        0.4, // radius
        0.85 // threshold
      );
      engine.composer.addPass(engine.bloomPass);

      // TODO: find a better way to remove the aliasing introduced in BloomPass.
      engine.fxaaPass = new ShaderPass(FXAAShader);
      const ratio = renderer.getPixelRatio();
      engine.fxaaPass.uniforms.resolution.value.x = 1 / (renderTargetWidth * ratio);
      engine.fxaaPass.uniforms.resolution.value.y = 1 / (renderTargetHeight * ratio);
      engine.composer.addPass(engine.fxaaPass);
    }
  });
}

function _setCamera(cam: THREE.Camera) {
  engine.mainCamera = cam;
}

async function loadObj(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();

    loader.load(
      url,
      (object) => {
        resolve(object);
      },
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        reject(error);
      }
    );
  });
}

function _animateTo(targets: gsap.TweenTarget, vars: gsap.TweenVars, t?: gsap.Position) {
  promise = promise.then(() => {
    mainTimeline.to(targets, vars, t);
  });
}

function getRoot(): GroupObject {
  if (engine.activeLayer === 'ui') {
    return engine.uiRoot;
  } else if (engine.activeLayer === 'main') {
    return engine.root;
  } else {
    throw new Error('Invalid active layer');
  }
}

export function addCircle(params: AddCircleParameters = {}): SceneObject {
  return getRoot().addCircle(params);
}

export function addCircleOutline(params: AddCircleOutlineParameters = {}): SceneObject {
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

export function addImage(file: string, params: AddTextParameters = {}): SceneObject {
  return getRoot().addImage(file, params);
}

export function addLine(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddLineParameters = {}
): LineObject {
  return getRoot().addLine(p1, p2, params);
}

export function addPoint(
  position: [number, number, number],
  params: AddObjectParameters = {}
): GeometryObject {
  return getRoot().addPoint(position, params);
}

class GeometryObject extends SceneObject {
  private points: [number, number, number][];
  geometry: THREE.BufferGeometry;

  private init() {
    console.assert(this.geometry);
    if (!this.points) {
      this.points = [];
      const positions = this.geometry.getAttribute('position').array as number[];
      for (let i = 0; i < positions.length; i += 3) {
        this.points.push([positions[i], positions[i + 1], positions[i + 2]]);
      }
    }
  }

  getVerts(callback: (points: [number, number, number][]) => void) {
    promise = promise.then(() => {
      this.init();
      callback(this.points);
    });
    return this;
  }

  moveVerts(positions: [number, number, number][], params: AnimationParameters = {}) {
    promise = promise.then(() => {
      this.init();
      const srcPoints = this.points;
      console.assert(srcPoints.length === positions.length);

      const { duration = engine.defaultDuration, ease = engine.defaultEase, t } = params;
      const data = { progress: 0 };
      mainTimeline.to(
        data,
        {
          progress: 1,
          ease,
          duration,
          onUpdate: () => {
            const vertices: number[] = [];
            for (let i = 0; i < srcPoints.length; i++) {
              vertices.push(
                srcPoints[i][0] + (positions[i][0] - srcPoints[i][0]) * data.progress,
                srcPoints[i][1] + (positions[i][1] - srcPoints[i][1]) * data.progress,
                srcPoints[i][2] + (positions[i][2] - srcPoints[i][2]) * data.progress
              );
            }
            this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          },
        },
        t
      );

      this.points = positions;
    });
    return this;
  }
}

export function addPoints(
  positions: [number, number, number][],
  params: AddObjectParameters = {}
): GeometryObject {
  return getRoot().addPoints(positions, params);
}

export function addPolyline(
  points: [number, number, number][],
  params: AddObjectParameters = {}
): LineObject {
  return getRoot().addPolyline(points, params);
}

export function addPolygonOutline(
  points: [number, number, number?][],
  params: AddObjectParameters = {}
): SceneObject {
  return getRoot().addPolygonOutline(points, params);
}

export function addPyramid(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addPyramid(params);
}

export function addRect(params: AddRectParameters = {}): SceneObject {
  return getRoot().addRect(params);
}

export function setClipRect(params: AddRectParameters = {}): SceneObject {
  return getRoot().setClipRect(params);
}

export function addRectOutline(params: AddOutlineParameters = {}): LineObject {
  return getRoot().addRectOutline(params);
}

export function addSphere(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addSphere(params);
}

export function addText(text: string, params: AddTextParameters = {}): TextObject {
  return getRoot().addText(text, params);
}

export function addText3D(text: string, params: AddText3DParameters = {}): TextObject {
  return getRoot().addText3D(text, params);
}

export function addTextOutline(text: string, params: AddTextOutlineParameters = {}): TextObject {
  return getRoot().addTextOutline(text, params);
}

export function addTex(tex: string, params: AddTextParameters = {}): TexObject {
  return getRoot().addTex(tex, params);
}

export function addTorus(params: AddObjectParameters = {}): SceneObject {
  return getRoot().addTorus(params);
}

export function addTriangle(params: AddPolygonParameters = {}): SceneObject {
  return getRoot().addTriangle(params);
}

export function addPolygon(
  vertices: [number, number][],
  params: AddPolygonParameters = {}
): SceneObject {
  return getRoot().addPolygon(vertices, params);
}

export function addTriangleOutline(params: AddOutlineParameters = {}): SceneObject {
  return getRoot().addTriangleOutline(params);
}

function _addMesh(mesh: THREE.Mesh, params: AddObjectParameters = {}): SceneObject {
  return getRoot()._addMesh(mesh, params);
}

export function add3DModel(url: string, params: AddObjectParameters = {}): GeometryObject {
  return getRoot().add3DModel(url, params);
}

export function addArrow(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddArrowParameters = {}
): SceneObject {
  return getRoot().addArrow(p1, p2, params);
}

export function addDoubleArrow(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddLineParameters = {}
): SceneObject {
  return getRoot().addDoubleArrow(p1, p2, params);
}

export function addAxes2D(params: AddAxes2DParameters = {}): SceneObject {
  return getRoot().addAxes2D(params);
}

export function addAxes3D(params: AddAxes3DParameters = {}): SceneObject {
  return getRoot().addAxes3D(params);
}

export function addArc(
  startAngle: number,
  endAngle: number,
  radius = 1,
  params: AddLineParameters = {}
): LineObject {
  return getRoot().addArc(startAngle, endAngle, radius, params);
}

export function moveTo(params: MoveObjectParameters = {}) {
  return getRoot().moveTo(params);
}

export function usePerspectiveCamera() {
  engine.mainCamera = createPerspectiveCamera();
}

export function useOrthographicCamera() {
  engine.mainCamera = createOrthographicCamera();
}

export function addFog() {
  promise = promise.then(() => {
    engine.scene.fog = new THREE.FogExp2(0x0, 0.03);
  });
}

export function setDefaultDuration(duration: number) {
  promise = promise.then(() => {
    engine.defaultDuration = duration;
  });
}

export function setDefaultEase(ease: string) {
  promise = promise.then(() => {
    engine.defaultEase = ease;
  });
}

interface AddFrustumParameters extends Transform, BasicMaterial {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

class FrustumObject extends SceneObject {
  perspectiveCamera: THREE.PerspectiveCamera;
  perspectiveCameraHelper: THREE.CameraHelper;

  changeFov(fov: number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = engine.defaultDuration, ease = engine.defaultEase, t } = params;
      mainTimeline.to(
        this.perspectiveCamera,
        {
          fov,
          onUpdate: () => {
            this.perspectiveCamera.updateProjectionMatrix();
            this.perspectiveCameraHelper.update();
          },
          duration,
          ease,
        },
        t
      );
    });
  }
}

export function addFrustum(params: AddFrustumParameters = {}): FrustumObject {
  return getRoot().addFrustum(params);
}

export function addMarker(name: string = undefined, t: string | number = undefined) {
  promise = promise.then(() => {
    const numMarkers = Object.keys(mainTimeline.labels).length;
    mainTimeline.addLabel(name ? name : `m${numMarkers + 1}`, t);
  });
}

const gltfLoader = new GLTFLoader();

function loadGLTF(url: string): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      function (gltf) {
        const group = gltf.scene;
        resolve(group);
      },
      function (xhr) {},
      function (error) {
        reject(error);
      }
    );
  });
}

interface DollyZoomParameters extends AnimationParameters {
  fov?: number;
}

class CameraObject {
  dollyZoom(params: DollyZoomParameters = {}) {
    promise = promise.then(() => {
      const { duration = engine.defaultDuration, ease = engine.defaultEase, fov = 60, t } = params;

      const cam = engine.mainCamera as PerspectiveCamera;
      const halfViewportHeight = viewportHeight * 0.5;

      mainTimeline.to(
        cam,
        {
          immediateRender: false,
          fov,
          duration,
          ease,
          onUpdate: () => {
            const dist = (1 / Math.tan(cam.fov * 0.5 * DEG2RAD)) * halfViewportHeight;
            const dir = new THREE.Vector3();
            cam.getWorldDirection(dir);
            dir.multiplyScalar(-dist);
            cam.position.copy(dir);
            cam.updateProjectionMatrix();
          },
        },
        t
      );
    });

    return this;
  }
}

export const camera = new CameraObject();

const api = {
  add3DModel,
  addArc,
  addArrow,
  addAxes2D,
  addAxes3D,
  addCircle,
  addCircleOutline,
  addCone,
  addCube,
  addCylinder,
  addDoubleArrow,
  addFog,
  addGlitch,
  addGrid,
  addGroup,
  addImage,
  addLine,
  addPoint,
  addPoints,
  addPolygon,
  addPolygonOutline,
  addPolyline,
  addPyramid,
  addRect,
  addRectOutline,
  setClipRect,
  addSphere,
  addTex,
  addText,
  addText3D,
  addTextOutline,
  addTorus,
  addTriangle,
  addTriangleOutline,
  addFrustum,
  addMarker,
  camera,
  cameraMoveTo,
  enableBloom,
  enableMotionBlur,
  fadeOutAll,
  generateRandomString,
  getPolygonVertices,
  getQueryString,
  getTriangleVertices,
  hideAll,
  moveTo,
  pause,
  random,
  randomInt,
  run,
  setActiveLayer,
  setBackgroundColor,
  setDefaultDuration,
  setDefaultEase,
  setResolution,
  setSeed,
  useOrthographicCamera,
  usePerspectiveCamera,
};

window.addEventListener('message', (event) => {
  if (typeof event.data !== 'object' || !event.data.type) {
    return;
  }

  if (event.data.type === 'seek') {
    seek(event.data.position);
  } else if (event.data.type === 'exportVideo') {
    exportVideo({ name: event.data.name });
  }
});

function seek(t: number) {
  globalTimeline.seek(t, false);
}

function getTimeline() {
  return {
    animations: mainTimeline.getChildren().map((child) => {
      return { t: child.startTime() };
    }),
    markers: getMarkers(),
    duration: globalTimeline.duration(),
  };
}

let promise: Promise<void> = new Promise((resolve, reject) => {
  resolve();
});

initEngine();

setTimeout(() => {
  promise.then(async () => {
    // HACK: find a better solution.
    for (let i = 0; i < 10; i++) {
      await promise;
    }

    startAnimation();
  });
});

// Raycast z plane at mouse click, then copy the intersection to clipboard.
const raycaster = new THREE.Raycaster();
const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function onMouseMove(event: MouseEvent) {
  if (renderer === undefined) return;

  const bounds = renderer.domElement.getBoundingClientRect();

  const mouse = new THREE.Vector2(
    ((event.clientX - bounds.left) / (bounds.right - bounds.left)) * 2 - 1,
    -((event.clientY - bounds.top) / (bounds.bottom - bounds.top)) * 2 + 1
  );

  raycaster.setFromCamera(mouse, engine.mainCamera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeZ, target);

  // Copy to clipboard
  navigator.clipboard.writeText(
    `[${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)}]`
  );
}
// window.addEventListener("click", onMouseMove, false);
