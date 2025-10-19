const CCapture = require('ccapture.js-npmfixed');
import * as Diff from 'diff';
import gsap from 'gsap';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CameraHelper,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EllipseCurve,
  Euler,
  Event,
  Float32BufferAttribute,
  FogExp2,
  FrontSide,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  PlaneBufferGeometry,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  sRGBEncoding,
  Texture,
  TextureLoader,
  TorusGeometry,
  Vector2,
  Vector3,
  VideoTexture,
  WebGLMultisampleRenderTarget,
  WebGLRenderer,
} from 'three';
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
import { radToDeg } from 'three/src/math/MathUtils';
import TextMeshObject from './objects/TextMeshObject';
import './style/player.css';
import { toThreeColor } from './utils/color';
import { GlitchPass } from './utils/GlitchPass';
import { computeAABB } from './utils/math';
import { OutlinePass } from './utils/OutlinePass.js';
import { loadSVG } from './utils/svg';
import { createTexObject } from './utils/tex';
import { createVideoElement } from './utils/video';
import WebmMediaRecorder from './utils/WebmMediaRecorder';

const debug = false;

const DEFAULT_LINE_WIDTH = 0.02;
const DEFAULT_POINT_SIZE = 0.1;
const DEG2RAD = Math.PI / 180;
const defaultAxesLabelScale = 0.25;

gsap.ticker.remove(gsap.updateRoot);

let renderTargetWidth = 1920;
let renderTargetHeight = 1080;
let framerate = 30;
const viewportHeight = 10;
let motionBlurSamples = 1;
const globalTimeline = gsap.timeline({ paused: true, onComplete: stopRender });
const mainTimeline = gsap.timeline();

let capturer: any;
let renderer: WebGLRenderer;

interface MovyApp {
  defaultDuration: number;
  defaultEase: string;

  activeLayer: string;
  composer: EffectComposer;
  lightGroup?: Group;

  scene: Scene;
  root: GroupObject;
  mainCamera: Camera;

  uiScene: Scene;
  uiRoot: GroupObject;
  uiCamera: Camera;

  renderTarget: WebGLMultisampleRenderTarget;
  rng: any;

  enableShadow: boolean;

  bloomPass?: UnrealBloomPass;
  fxaaPass?: ShaderPass;
  glitchPass?: any;
  outlinePass?: any;
}

let app: MovyApp;

let gridHelper: GridHelper;
const backgroundAlpha = 1.0;

let lastTimestamp: number;
let timeElapsed = 0;

let recorder: WebmMediaRecorder;

globalTimeline.add(mainTimeline, '0');

const options = {
  format: 'webm',
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

  promise = promise.then(() => {
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
        recorder = new WebmMediaRecorder({ name, framerate: framerate });
      }
      recorder.start();
    } else {
      capturer = new CCapture({
        verbose: true,
        display: false,
        framerate: framerate,
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
  });
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

export interface Marker {
  name: string;
  time: number;
}

function getMarkers(): Marker[] {
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
  const camera = new OrthographicCamera(
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

function createPerspectiveCamera(): Camera {
  // This will ensure the size of 10 in the vertical direction.
  const camera = new PerspectiveCamera(60, renderTargetWidth / renderTargetHeight, 0.1, 5000);
  camera.position.set(0, 0, 8.66);
  camera.lookAt(new Vector3(0, 0, 0));
  return camera;
}

function createMovyApp(container?: HTMLElement): MovyApp {
  mainTimeline.clear();

  // Create renderer
  const enableShadow = false;
  if (renderer === undefined) {
    console.log('new webgl renderer');
    renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.localClippingEnabled = true;
    renderer.setSize(renderTargetWidth, renderTargetHeight);
    renderer.setClearColor(0x000000, backgroundAlpha);
    renderer.shadowMap.enabled = enableShadow;

    if (container !== undefined) {
      container.appendChild(renderer.domElement);
    } else {
      document.body.appendChild(renderer.domElement);
    }
  }

  const scene = new Scene();
  const root = new GroupObject(null);
  root.object3D = new Group();
  scene.add(root.object3D);

  const uiScene = new Scene();
  const uiRoot = new GroupObject(null);
  uiRoot.object3D = new Group();
  uiScene.add(uiRoot.object3D);

  scene.background = new Color(0);

  const mainCamera = createOrthographicCamera();
  const uiCamera = createOrthographicCamera();

  // Create multi-sample render target in order to reduce aliasing (better
  // quality than FXAA).
  const renderTarget = new WebGLMultisampleRenderTarget(renderTargetWidth, renderTargetHeight);
  renderTarget.samples = 8; // TODO: don't hardcode

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setSize(renderTargetWidth, renderTargetHeight);

  // Always use a render pass for gamma correction. This avoid adding an extra
  // copy pass to resolve MSAA samples.
  composer.insertPass(new ShaderPass(GammaCorrectionShader), 1);

  const app: MovyApp = {
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
    enableShadow,
  };

  if (0) {
    app.outlinePass = new OutlinePass(
      new Vector2(renderTargetWidth, renderTargetHeight),
      scene,
      mainCamera
    );
    app.outlinePass.edgeStrength = 10;
    app.outlinePass.edgeGlow = 0;
    app.outlinePass.edgeThickness = 1;
    app.outlinePass.pulsePeriod = 0;
    app.outlinePass.visibleEdgeColor.set('#ffffff');
    app.outlinePass.hiddenEdgeColor.set('#ffffff');
    composer.addPass(app.outlinePass);
  }

  promise = new Promise((resolve, reject) => {
    resolve();
  });

  return app;
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

  if (app.scene) {
    app.scene.traverse((child: any) => {
      if (child instanceof TextMeshObject) {
        child.updateText();
      }

      // check if onUpdate is defined
      if (child.onUpdate) {
        child.onUpdate();
      }

      if (child.billboarding) {
        const quat = child.quaternion;
        quat.copy(app.mainCamera.quaternion);
        child.traverseAncestors((o: any) => {
          quat.multiply(o.quaternion.clone().invert());
        });
      }
    });

    renderer.setRenderTarget(app.renderTarget);

    // Render scene
    renderer.render(app.scene, app.mainCamera);

    // Render UI on top of the scene
    renderer.autoClearColor = false;
    renderer.render(app.uiScene, app.uiCamera);
    renderer.autoClearColor = true;

    renderer.setRenderTarget(null);

    // Post processing
    app.composer.readBuffer = app.renderTarget;
    app.composer.render();
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
    const { t, lookAt, duration = app.defaultDuration, ease = app.defaultEase, fov, zoom } = params;

    const tl = gsap.timeline({
      defaults: {
        duration,
        ease,
      },
      onUpdate: () => {
        // Keep looking at the target while camera is moving.
        if (lookAt) {
          app.mainCamera.lookAt(toThreeVector3(lookAt));
        }
      },
    });

    if (app.mainCamera instanceof PerspectiveCamera) {
      const perspectiveCamera = app.mainCamera as PerspectiveCamera;

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
        object3d: app.mainCamera,
        duration,
        ease,
      }),
      '<'
    );

    if (zoom !== undefined) {
      tl.to(
        app.mainCamera,
        {
          zoom,
          onUpdate: () => {
            (app.mainCamera as any).updateProjectionMatrix();
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
  points: Vector3[],
  {
    color,
    lineWidth = 0.1,
  }: {
    color?: string | number;
    lineWidth: number;
  }
) {
  if (points.length === 0) {
    points.push(new Vector3(-1.73, -1, 0));
    points.push(new Vector3(1.73, -1, 0));
    points.push(new Vector3(0, 2, 0));
    points.push(points[0]);
  }

  const lineColor = new Color(0xffffff);
  const style = SVGLoader.getStrokeStyle(lineWidth, lineColor.getStyle(), 'miter', 'butt', 4);
  // style.strokeLineJoin = "round";
  const geometry = SVGLoader.pointsToStroke(points, style, 12, 0.001);

  const material = createMaterial({ color, doubleSided: true });
  const mesh = new Mesh(geometry, material);
  return mesh;
}

function getAllMaterials(object3d: Object3D): Material[] {
  const materials = new Set<Material>();

  const getMaterialsRecursive = (object3d: Object3D) => {
    const mesh = object3d as Mesh;
    if (mesh && mesh.material) {
      materials.add(mesh.material as Material);
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

function createFadeInAnimation(object3d: Object3D, { duration, ease }: AnimationParameters = {}) {
  const tl = gsap.timeline();

  // Set initial visibility to false.
  object3d.visible = false;

  tl.set(object3d, { visible: true }, '<');

  const materials = getAllMaterials(object3d);
  for (const material of materials) {
    const initialOpacity = material.opacity;
    tl.set(material, { transparent: true }, '<');
    tl.fromTo(
      material,
      {
        opacity: 0,
      },
      { opacity: initialOpacity, duration, ease },
      '<'
    );
  }

  return tl;
}

function createOpacityAnimation(
  obj: Object3D,
  {
    duration = app.defaultDuration,
    ease = app.defaultEase,
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

function addDefaultLights({ addDirectionalLight = true } = {}) {
  if (app.lightGroup === undefined) {
    app.lightGroup = new Group();
    app.scene.add(app.lightGroup);

    // Create directional light
    if (addDirectionalLight) {
      const directionalLight = new DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0.3, 1, 0.5);
      if (app.enableShadow) {
        directionalLight.castShadow = true;
      }
      app.lightGroup.add(directionalLight);
    }

    // Create ambient light
    const hemiLight = new HemisphereLight(0xffffff, 0x3f3f3f, 0.2);
    app.lightGroup.add(hemiLight);
  }
}

export function addDirectionalLight({
  dir = [0, -1, 0],
  intensity = 1.0,
  color = '#ffffff',
}: { dir?: [number, number, number]; intensity?: number; color?: string | number } = {}) {
  addDefaultLights({ addDirectionalLight: false });

  const light = new DirectionalLight(color, intensity);
  light.position.set(-dir[0], -dir[1], -dir[2]);
  app.lightGroup.add(light);
}

export function addPointLight({
  pos,
  intensity = 1.0,
  color = '#ffffff',
}: { pos?: [number, number, number?]; intensity?: number; color?: string | number } = {}) {
  addDefaultLights({ addDirectionalLight: false });

  const light = new PointLight(color, intensity);
  light.position.set(pos[0], pos[1], pos[2] || 0);
  app.lightGroup.add(light);
}

function createExplosionAnimation(
  objectGroup: Object3D,
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
    const r = minRadius + (maxRadius - minRadius) * app.rng();
    const theta = app.rng() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    child.position.z += 0.01 * i; // z-fighting

    tl.fromTo(child.position, { x: 0, y: 0 }, { x, y }, delay);

    const rotation = minRotation + app.rng() * (maxRotation - minRotation);
    tl.fromTo(child.rotation, { z: 0 }, { z: rotation }, delay);

    const targetScale = child.scale.setScalar(minScale + (maxScale - minScale) * app.rng());
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
    if (app.glitchPass === undefined) {
      app.glitchPass = new GlitchPass();
    }

    if (app.composer.passes.indexOf(app.glitchPass) === -1) {
      app.composer.insertPass(app.glitchPass, 0);
      console.log('add glitch pass');
    }

    const tl = gsap.timeline();
    tl.set(app.glitchPass, { factor: 1 });
    tl.set(app.glitchPass, { factor: 0 }, `<${duration}`);
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

    gridHelper = new GridHelper(size, divisions, new Color(colorCenterLine), new Color(colorGrid));
    gridHelper.rotation.x = Math.PI / 2;
    app.scene.add(gridHelper);
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

function createArrow2DGeometry(arrowSize: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    // prettier-ignore
    new BufferAttribute(new Float32Array([
      -0.5 * arrowSize, -0.5 * arrowSize, 0,
      0.5 * arrowSize, -0.5 * arrowSize, 0,
      0, 0.5 * arrowSize, 0,
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

function createArrowLine(from: Vector3, to: Vector3, params: CreateArrowLineParameters = {}) {
  const {
    lineWidth = DEFAULT_LINE_WIDTH,
    arrowEnd = true,
    arrowStart = false,
    threeDimensional = false,
  } = params;

  const material = createMaterial({ ...params, doubleSided: true });

  const direction = new Vector3();
  direction.subVectors(to, from);
  const halfLength = direction.length() * 0.5;
  direction.subVectors(to, from).normalize();

  const center = new Vector3();
  center.addVectors(from, to).multiplyScalar(0.5);

  const quaternion = new Quaternion(); // create one and reuse it
  quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);

  const group = new Group();

  let length = halfLength * 2;
  const arrowSize = lineWidth * 10;
  let offset = 0;

  {
    // Create line
    if (arrowEnd) {
      length -= arrowSize;
      offset -= 0.5 * arrowSize;
    }
    if (arrowStart) {
      length -= arrowSize;
      offset += 0.5 * arrowSize;
    }

    const geometry = !threeDimensional
      ? new PlaneGeometry(lineWidth, length)
      : new CylinderGeometry(lineWidth / 2, lineWidth / 2, length, 16);

    const line = new Mesh(geometry, material);
    line.position.copy(direction.clone().multiplyScalar(offset));
    line.setRotationFromQuaternion(quaternion);

    group.add(line);
  }

  // Create arrows
  for (let i = 0; i < 2; i++) {
    if (i === 0 && !arrowStart) continue;
    if (i === 1 && !arrowEnd) continue;

    const geometry = !threeDimensional
      ? createArrow2DGeometry(arrowSize)
      : new ConeGeometry(arrowSize * 0.5, arrowSize, 32);
    geometry.translate(0, -arrowSize * 0.5, 0);

    const arrow = new Mesh(geometry, material);
    arrow.setRotationFromQuaternion(quaternion);
    arrow.position.copy(i === 0 ? from : to);
    arrow.position.sub(center);
    group.add(arrow);

    if (i === 0) arrow.rotateZ(Math.PI);
  }

  group.position.copy(center);
  return group;
}

async function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(
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
  shakes?: number;
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
  position?: [number, number, number?];
  scale?: number;
  object3d: Object3D;
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

function convertScreenToWorld(object3d: Object3D, v: number) {
  const worldScale = new Vector3();
  object3d.getWorldScale(worldScale);
  return ((v * worldScale.length()) / 10) * 0.5 * renderTargetHeight;
}

class Line_ extends Line2 {
  lineWidth: number;

  constructor(
    verts: Vector3[],
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
    dashed: dashed || false,
    dashSize: lineWidth * 2,
    gapSize: lineWidth * 2,
    resolution: new Vector2(renderTargetWidth, renderTargetHeight),
  });
  return material;
}

function updateLinePoints(verts: Vector3[], geometry: LineGeometry, progress = 1) {
  const points: Vector3[] = [];

  let division = [];
  for (let i = 0; i < verts.length - 1; i++) {
    const len = new Vector3().subVectors(verts[i], verts[i + 1]).length();
    division.push(len);
  }
  const totalLen = division.reduce((a, b) => a + b);
  division = division.map((x) => x / totalLen);

  let cumsum = 0;
  let k = 0;
  for (let i = 0; i < verts.length; i++) {
    if (cumsum <= progress) {
      points.push(verts[i]);
      k = i;
      cumsum += division[i];
    } else {
      const point = new Vector3();
      point.lerpVectors(verts[k], verts[k + 1], (progress - cumsum + division[k]) / division[k]);
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

function addTransformControl(object: Object3D<Event>) {
  const control = new TransformControls(app.mainCamera, renderer.domElement);
  control.attach(object);
  app.scene.add(control);
  control.addEventListener('mouseUp', () => {
    const p = object.position;
    const clipboard = `x: ${p.x.toFixed(4)}, y: ${p.y.toFixed(4)}, z: ${p.z.toFixed(4)}`;
    window.navigator.clipboard.writeText(clipboard);
  });
}

function addObjectToScene(object3D: Object3D, parentObject3D: Object3D) {
  console.assert(object3D);
  console.assert(parentObject3D);

  parentObject3D.add(object3D);

  if (debug) {
    addTransformControl(object3D);
  }
}

class MyGrid extends LineSegments {
  constructor(sizeX: number, sizeY: number, color: Color) {
    const halfSizeX = sizeX / 2;
    const halfSizeY = sizeY / 2;

    const vertices = [];
    const colors: number[] = [];

    for (let i = 0, j = 0, k = -halfSizeX; i <= sizeX; i++, k += 1) {
      vertices.push(k, 0, -halfSizeY, k, 0, halfSizeY);

      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
    }
    for (let i = 0, j = 0, k = -halfSizeY; i <= sizeY; i++, k += 1) {
      vertices.push(-halfSizeX, 0, k, halfSizeX, 0, k);

      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });

    super(geometry, material);
  }
}

class SceneObject {
  object3D: Object3D;
  parent: SceneObject;
  children: SceneObject[] = [];

  constructor(parent: SceneObject, transform?: Transform) {
    this.parent = parent;
    if (this.parent) {
      this.parent.children.push(this);
    }

    if (transform !== undefined) {
      promise = promise.then(() => {
        this.object3D = new Group();
        updateTransform(this.object3D, transform);
        addObjectToScene(this.object3D, this.parent.object3D);
      });
    }
  }

  private add3DGeometry(params: AddObjectParameters = {}, geometry: BufferGeometry) {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = true;

      obj.object3D = new Group();

      if (params.showPoints) {
        obj.object3D.add(createPoints(geometry, params));
      } else {
        if (params.wireframe && params.lineWidth) {
          geometry = new WireframeGeometry2(geometry);
        }
        const material = createMaterial(params);
        const mesh = new Mesh(geometry, material);
        if (app.enableShadow) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }

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

  _addMesh(mesh: Mesh, params: AddObjectParameters = {}): SceneObject {
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
        const mesh = node as Mesh;
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
    return new GroupObject(params.parent || this, params);
  }

  add3DModel(url: string, params: AddObjectParameters = {}): GeometryObject {
    const obj = new GeometryObject(params.parent || this);

    promise = promise.then(async () => {
      addDefaultLights();

      let object: Object3D;
      if (url.endsWith('.obj')) {
        object = await loadObj(url);
      } else if (url.endsWith('.gltf')) {
        object = await loadGLTF(url);
      }

      const { autoResize = true } = params;
      if (autoResize) {
        const aabb = computeAABB(object);

        const size = new Vector3();
        aabb.getSize(size);
        const length = Math.max(size.x, size.y, size.z);
        object.scale.divideScalar(length);

        const center = new Vector3();
        aabb.getCenter(center);
        center.divideScalar(length);
        object.position.sub(center);
      }

      const group = new Group();
      group.add(object);

      object.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          obj.geometry = child.geometry;
          if (params.showPoints) {
            child.parent.add(createPoints(child.geometry, params));
            child.removeFromParent();
          } else {
            if (params.lighting !== undefined) {
              child.material = createMaterial(params);
            }
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
              child.material.side = params.doubleSided ? DoubleSide : FrontSide;
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

      const geometry = new CircleGeometry(params.radius || 0.5, 128);

      obj.object3D = new Group();
      obj.object3D.add(new Mesh(geometry, material));

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addArrow(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddArrowParameters = {}
  ): LineObject {
    // For back compat
    if (!Array.isArray(p1)) {
      params = p1;
      p1 = (params as any).from;
      p2 = (params as any).to;
    }

    return this.addPolyline([p1, p2], { ...params, arrowEnd: true });
  }

  addArrow3D(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddArrowParameters = {}
  ): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      const { lineWidth = 0.05, color } = params;

      obj.object3D = createArrowLine(toThreeVector3(p1), toThreeVector3(p2), {
        arrowStart: false,
        arrowEnd: true,
        threeDimensional: true,
        lighting: true,
        lineWidth,
        color,
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
          obj.addLine(
            [
              [x, -stickLength * 0.5],
              [x, stickLength * 0.5],
            ],
            {
              lineWidth: DEFAULT_LINE_WIDTH,
            }
          );
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
          obj.addLine(
            [
              [-stickLength * 0.5, y],
              [stickLength * 0.5, y],
            ],
            {
              lineWidth: DEFAULT_LINE_WIDTH,
            }
          );
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

    promise = promise.then(async () => {
      updateTransform(obj.object3D, params);
    });

    return obj;
  }

  addAxes3D(params: AddAxes3DParameters = {}): Axes3DObject {
    const {
      showLabels = true,
      xRange = [-4, 4],
      yRange = [-4, 4],
      zRange = [-4, 4],
      showAxisX = true,
      showAxisY = true,
      showAxisZ = true,
    } = params;

    const labelColors = ['red', 'green', 'blue'];
    const labelNames = ['x', 'y', 'z'];
    const showAxis = [showAxisX, showAxisY, showAxisZ];
    const arrowLines: { p0: [number, number, number]; p1: [number, number, number] }[] = [
      {
        p0: [xRange[0], 0, 0],
        p1: [xRange[1], 0, 0],
      },
      {
        p0: [0, yRange[0], 0],
        p1: [0, yRange[1], 0],
      },
      {
        p0: [0, 0, zRange[0]],
        p1: [0, 0, zRange[1]],
      },
    ];

    const axes3DObject = new Axes3DObject(params.parent || this, params);

    const axisGroups = [];
    for (let i = 0; i < 3; i++) {
      const axis = axes3DObject.addGroup();
      axisGroups.push(axis);

      if (showAxis[i]) {
        axis.addArrow3D(arrowLines[i].p0, arrowLines[i].p1, {
          color: labelColors[i],
        });

        if (showLabels) {
          axis.addTex(labelNames[i], {
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

    axes3DObject.axisX = axisGroups[0];
    axes3DObject.axisY = axisGroups[1];
    axes3DObject.axisZ = axisGroups[2];

    return axes3DObject;
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

      const curve = new EllipseCurve(
        0,
        0,
        radius,
        radius,
        startAngle * DEG2RAD,
        endAngle * DEG2RAD,
        false,
        0
      );

      const points2d = curve.getSpacedPoints(64).reverse();
      for (const pt of points2d) {
        obj.verts.push(new Vector3(pt.x, pt.y, 0));
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
    const { size = params.gridSize || 10, color = '#606060' } = params;

    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      obj.object3D = new MyGrid(params.sizeX || size, params.sizeY || size, toThreeColor(color));
      obj.object3D.rotation.x = Math.PI / 2;

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addImage(file: string, params: AddImageParameters = {}): SceneObject {
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
        if (params.filter == 'nearest') {
          texture.magFilter = NearestFilter;
          texture.minFilter = NearestFilter;
        }

        texture.encoding = sRGBEncoding;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const material = new MeshBasicMaterial({
          map: texture,
          side: DoubleSide,
          transparent: true,
          opacity: params.opacity || 1.0,
          color: toThreeColor(color),
        });

        const aspect = texture.image.width / texture.image.height;
        const geometry = new PlaneBufferGeometry(
          aspect > 1 ? aspect : 1,
          aspect > 1 ? 1 : 1 / aspect
        );
        const mesh = new Mesh(geometry, material);
        obj.object3D = mesh;
      }

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addVideo(file: string, params: AddObjectParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      const video = await createVideoElement(file);
      const texture = new VideoTexture(video);
      texture.encoding = sRGBEncoding;
      const material = createMaterial(params);

      if (!(material instanceof MeshBasicMaterial)) {
        throw 'invalid material type';
      }
      material.map = texture;

      const aspect = video.videoWidth / video.videoHeight;
      console.log(aspect);
      const geometry = new PlaneBufferGeometry(
        aspect > 1 ? aspect : 1,
        aspect > 1 ? 1 : 1 / aspect
      );
      const mesh = new Mesh(geometry, material);
      obj.object3D = mesh;

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addLine(points: [number, number, number?][], params: AddLineParameters): LineObject;

  /**
   * @deprecated
   */
  addLine(
    p1: [number, number, number?],
    p2: [number, number, number?],
    params: AddLineParameters
  ): LineObject;

  addLine(
    arg1: [number, number, number?] | [number, number, number?][],
    arg2: [number, number, number?] | AddLineParameters,
    arg3?: AddLineParameters
  ): LineObject {
    // For back compat
    if (!Array.isArray(arg1)) {
      const params = arg1;
      const { from } = params as any;
      const { to } = params as any;
      const p1: [number, number, number?] = Array.isArray(from)
        ? (from as [number, number, number?])
        : [from.x, from.y, from.z];
      const p2: [number, number, number?] = Array.isArray(to)
        ? (to as [number, number, number?])
        : [to.x, to.y, to.z];
      return this.addPolyline([p1, p2], arg1);
    } else {
      if (Array.isArray(arg2)) {
        return this.addPolyline([arg1 as [number, number, number?], arg2], arg3);
      } else {
        return this.addPolyline(arg1 as [number, number, number?][], arg2);
      }
    }
  }

  addPoint(params: AddObjectParameters = {}): GeometryObject {
    return addPoints([[0, 0, 0]], params);
  }

  addPoints(
    positions: [number, number, number][],
    params: AddObjectParameters = {}
  ): GeometryObject {
    const obj = new GeometryObject(params.parent || this);

    promise = promise.then(async () => {
      const vertices = [].concat.apply([], positions);
      obj.geometry = new BufferGeometry();
      obj.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));

      obj.object3D = createPoints(obj.geometry, params);

      updateTransform(obj.object3D, {
        ...params,
      });

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addPolyline(points: [number, number, number?][], params: AddLineParameters = {}): LineObject {
    const { arrowEnd = false, lineWidth = DEFAULT_LINE_WIDTH, color } = params;

    const arrowSize = params.arrowSize !== undefined ? params.arrowSize : lineWidth * 10;

    const pts = [...points];

    let from = toThreeVector3(pts[pts.length - 2]);
    let to = toThreeVector3(pts[pts.length - 1]);

    const dir = new Vector3();
    dir.subVectors(to, from);
    dir.normalize();

    if (arrowEnd) {
      to.sub(dir.clone().multiplyScalar(0.5 * arrowSize));

      const to2 = to.clone();
      to2.sub(dir.clone().multiplyScalar(0.5 * arrowSize));
      pts[pts.length - 1] = [to2.x, to2.y, to2.z];
    }

    const obj = new LineObject(params.parent || this);

    promise = promise.then(async () => {
      const vec3d = pts.map((pt) => new Vector3(pt[0], pt[1], pt.length <= 2 ? 0 : pt[2]));
      obj.verts = vec3d;
      const line = new Line_(obj.verts, params);
      obj.object3D = line;
      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    // Create arrow
    if (arrowEnd) {
      const quat = new Quaternion();
      quat.setFromUnitVectors(new Vector3(0, 1, 0), dir);
      const eular = new Euler();
      eular.setFromQuaternion(quat, 'XYZ');

      obj.arrowEnd = obj.addCone({
        scale: arrowSize,
        position: [to.x, to.y, to.z],
        rx: radToDeg(eular.x) + 360,
        ry: radToDeg(eular.y) + 360,
        rz: radToDeg(eular.z) + 360,
        lighting: false,
        color,
      });
    }

    return obj;
  }

  addCurve(points: [number, number, number?][], params: AddLineParameters = {}): LineObject {
    const obj = new LineObject(params.parent || this);

      const vec3d = points.map((pt) => new Vector3(pt[0], pt[1], pt.length <= 2 ? 0 : pt[2]));

      if (vec3d.length === 3) {
        const curve = new QuadraticBezierCurve3(vec3d[0], vec3d[1], vec3d[2]);
        obj.verts = curve.getPoints(64);
      } else {
        throw 'the number of points must be 3';
      }

    promise = promise.then(async () => {
      const line = new Line_(obj.verts, params);
      obj.object3D = line;
      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    // Create arrow
    if (params.arrowEnd) {
      const quat = new Quaternion();
      const direction = new Vector3()
        .subVectors(obj.verts[obj.verts.length - 1], obj.verts[obj.verts.length - 2])
        .normalize();
      quat.setFromUnitVectors(new Vector3(0, 1, 0), direction);
      const eular = new Euler();
      eular.setFromQuaternion(quat, 'XYZ');

      const lastVertex = obj.verts[obj.verts.length - 1];
      const arrowSize = params.arrowSize || (params.lineWidth || DEFAULT_LINE_WIDTH) * 10;
      obj.arrowEnd = obj.addCone({
        scale: arrowSize,
        position: [lastVertex.x, lastVertex.y, lastVertex.z],
        rx: radToDeg(eular.x) + 360,
        ry: radToDeg(eular.y) + 360,
        rz: radToDeg(eular.z) + 360,
        lighting: false,
        color: params.color,
      });
    }

    return obj;
  }

  addPyramid(params: AddObjectParameters = {}): SceneObject {
    const geometry = new ConeGeometry(0.5, 1.0, 4, 1);
    return this.add3DGeometry({ ...params, flatShading: true }, geometry);
  }

  addCube(params: AddObjectParameters = {}): SceneObject {
    const geometry = new BoxGeometry(1, 1, 1);
    return this.add3DGeometry(params, geometry);
  }

  addSphere(params: AddObjectParameters = {}): SceneObject {
    const geometry = new SphereGeometry(
      0.5,
      params.divisions || defaultSeg(params),
      params.divisions || defaultSeg(params)
    );
    return this.add3DGeometry(params, geometry);
  }

  addCone(params: AddConeParameters = {}): SceneObject {
    const { radius = 0.5 } = params;
    const geometry = new ConeGeometry(radius, 1.0, defaultSeg(params), defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addCylinder(params: AddObjectParameters = {}): SceneObject {
    const geometry = new CylinderGeometry(0.5, 0.5, 1, defaultSeg(params));
    return this.add3DGeometry(params, geometry);
  }

  addTorus(params: AddObjectParameters = {}): SceneObject {
    const geometry = new TorusGeometry(0.375, 0.125, defaultSeg(params), defaultSeg(params));
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
      const v3d = verts.map((v) => new Vector3(v[0], v[1], 0));
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
        new Vector3(-halfWidth, -halfHeight, 0),
        new Vector3(-halfWidth, halfHeight, 0),
        new Vector3(halfWidth, halfHeight, 0),
        new Vector3(halfWidth, -halfHeight, 0),
        new Vector3(-halfWidth, -halfHeight, 0)
      );

      const line = new Line_(obj.verts, params);
      obj.object3D = line;

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  RoundedRectangle(w: number, h: number, r: number, s: number) {
    // width, height, radius corner, smoothness

    // helper const's
    const wi = w / 2 - r; // inner width
    const hi = h / 2 - r; // inner height
    const w2 = w / 2; // half width
    const h2 = h / 2; // half height
    const ul = r / w; // u left
    const ur = (w - r) / w; // u right
    const vl = r / h; // v low
    const vh = (h - r) / h; // v high

    let positions = [wi, hi, 0, -wi, hi, 0, -wi, -hi, 0, wi, -hi, 0];

    let uvs = [ur, vh, ul, vh, ul, vl, ur, vl];

    let n = [3 * (s + 1) + 3, 3 * (s + 1) + 4, s + 4, s + 5, 2 * (s + 1) + 4, 2, 1, 2 * (s + 1) + 3, 3, 4 * (s + 1) + 3, 4, 0]; // prettier-ignore

    let indices = [n[0], n[1], n[2], n[0], n[2], n[3], n[4], n[5], n[6], n[4], n[6], n[7], n[8], n[9], n[10], n[8], n[10], n[11]]; // prettier-ignore

    let phi, cos, sin, xc, yc, uc, vc, idx;

    for (let i = 0; i < 4; i++) {
      xc = i < 1 || i > 2 ? wi : -wi;
      yc = i < 2 ? hi : -hi;

      uc = i < 1 || i > 2 ? ur : ul;
      vc = i < 2 ? vh : vl;

      for (let j = 0; j <= s; j++) {
        phi = (Math.PI / 2) * (i + j / s);
        cos = Math.cos(phi);
        sin = Math.sin(phi);

        positions.push(xc + r * cos, yc + r * sin, 0);

        uvs.push(uc + ul * cos, vc + vl * sin);

        if (j < s) {
          idx = (s + 1) * i + j + 4;
          indices.push(i, idx, idx + 1);
        }
      }
    }

    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));

    return geometry;
  }

  addRect(params: AddRectParameters = {}): SceneObject {
    const obj = new SceneObject(params.parent || this);

    promise = promise.then(async () => {
      if (params.lighting === undefined) params.lighting = false;
      const material = createMaterial({ ...params, doubleSided: true });

      const { width = 1, height = 1, radius = 0 } = params;

      const geometry =
        radius > 0
          ? this.RoundedRectangle(width, height, radius, 16)
          : new PlaneGeometry(width, height);

      obj.object3D = new Group();
      obj.object3D.add(new Mesh(geometry, material));

      updateTransform(obj.object3D, params);

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  setClipRect(params: AddRectParameters = {}): SceneObject {
    promise = promise.then(async () => {
      const { x = 0, y = 0, width = 1, height = 1 } = params;

      const clippingPlanes = [
        new Plane(new Vector3(1, 0, 0), 1),
        new Plane(new Vector3(-1, 0, 0), 1),
        new Plane(new Vector3(0, 1, 0), 1),
        new Plane(new Vector3(0, -1, 0), 1),
      ];

      (this.object3D as any).onUpdate = () => {
        getAllMaterials(this.object3D).forEach((material) => {
          material.clippingPlanes = clippingPlanes;
        });

        const worldPosition = new Vector3(x, y, 0);
        this.object3D.localToWorld(worldPosition);
        const worldScale = new Vector3();
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

      const geometry = new BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();

      obj.object3D = new Group();
      obj.object3D.add(new Mesh(geometry, material));

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
      const v3d = verts.map((v) => new Vector3(v[0], v[1], 0));
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
      if (app.outlinePass) {
        app.outlinePass.selectedObjects.push(textObject);
      }

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
      if (app.outlinePass) {
        app.outlinePass.selectedObjects.push(texObject);
      }

      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  addFrustum(params: AddFrustumParameters = {}) {
    const obj = new FrustumObject(params.parent || this);

    promise = promise.then(async () => {
      const { fov = 45, near = 1, far = 5, aspect = 1 } = params;

      const group = new Group();
      obj.perspectiveCamera = new PerspectiveCamera(fov, aspect, near, far);
      obj.perspectiveCameraHelper = new CameraHelper(obj.perspectiveCamera);
      // group.add(obj.perspectiveCamera);
      group.add(obj.perspectiveCameraHelper);
      obj.object3D = group;

      updateTransform(obj.object3D, params);
      addObjectToScene(obj.object3D, obj.parent.object3D);
    });

    return obj;
  }

  moveTo(params: MoveObjectParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;

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
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;

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
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;

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
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;

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
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;

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
      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
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
      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
      const tl = createOpacityAnimation(this.object3D, { duration, ease, opacity });
      mainTimeline.add(tl, t);
    });
    return this;
  }

  changeColor(color: string | number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
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

  setColor(color: string | number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
      const tl = gsap.timeline({ defaults: { duration, ease } });

      const materials = getAllMaterials(this.object3D);
      const destColor = toThreeColor(color);
      for (const m of materials) {
        tl.set(
          (m as any).color,
          {
            r: destColor.r,
            g: destColor.g,
            b: destColor.b,
          },
          '<'
        );
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotate(r: [number?, number?, number?], params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;
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
        duration = app.defaultDuration,
        ease = app.defaultEase,
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
      const { t, ease = app.defaultEase, duration = app.defaultDuration } = params;
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

  grow2({ duration = 0.5, t }: AnimationParameters = {}) {
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
          duration,
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
      const { t, ease = app.defaultEase, duration = app.defaultDuration } = params;

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
            x: app.rng() * WIDTH - WIDTH / 2,
            y: app.rng() * HEIGHT - HEIGHT / 2,
          },
          {
            x: app.rng() * WIDTH - WIDTH / 2,
            y: app.rng() * HEIGHT - HEIGHT / 2,
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
        duration = app.defaultDuration,
        ease = app.defaultEase,
      } = params;
      const object3d = this.object3D;
      const clippingPlanes: Plane[] = [];

      const aabb = computeAABB(object3d);
      // Slightly expand the aabb to avoid revealing objects outside the clip region
      aabb.expandByScalar(1e-3);

      const materials = getAllMaterials(object3d);

      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      const pos = object3d.position.clone();
      object3d.localToWorld(pos);
      if (direction === 'right') {
        clippingPlanes.push(new Plane(new Vector3(1, 0, 0), -aabb.min.x));
        pos.x -= aabb.max.x - aabb.min.x;
      } else if (direction === 'left') {
        clippingPlanes.push(new Plane(new Vector3(-1, 0, 0), aabb.max.x));
        pos.x += aabb.max.x - aabb.min.x;
      } else if (direction === 'up') {
        clippingPlanes.push(new Plane(new Vector3(0, 1, 0), -aabb.min.y));
        pos.y -= aabb.max.y - aabb.min.y;
      } else if (direction === 'down') {
        clippingPlanes.push(new Plane(new Vector3(0, -1, 0), aabb.max.y));
        pos.y += aabb.max.y - aabb.min.y;
      }
      object3d.worldToLocal(pos);

      // Attach clipping planes to each material.
      const data = { enableClippingPlanes: 0 };
      tl.to(data, {
        enableClippingPlanes: 1,
        onUpdate: () => {
          if (data.enableClippingPlanes > 0.5) {
            materials.forEach((material) => {
              material.clippingPlanes = clippingPlanes;
            });
          }
        },
        duration: 0,
      });

      tl.fromTo(
        object3d,
        { visible: false },
        {
          visible: true,
          duration: 0,
        }
      );

      tl.from(object3d.position, {
        x: pos.x,
        y: pos.y,
      });

      tl.to(data, {
        enableClippingPlanes: 0,
        onUpdate: () => {
          if (data.enableClippingPlanes) {
            materials.forEach((material) => {
              material.clippingPlanes = null;
            });
          }
        },
        duration: 0,
      });

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

  vertexToAnimate = new Map<number, Vector3>();

  wipeIn(params: WipeInParameters = {}) {
    promise = promise.then(() => {
      const {
        direction = 'right',
        t,
        duration = app.defaultDuration,
        ease = app.defaultEase,
      } = params;
      this.object3D.visible = false;

      const boundingBox = computeAABB(this.object3D);
      const materials = getAllMaterials(this.object3D);

      const tl = gsap.timeline({
        defaults: { duration, ease },
      });

      let clipPlane: Plane;
      if (direction === 'right') {
        clipPlane = new Plane(new Vector3(-1, 0, 0));
      } else if (direction === 'left') {
        clipPlane = new Plane(new Vector3(1, 0, 0));
      } else if (direction === 'up') {
        clipPlane = new Plane(new Vector3(0, -1, 0));
      } else if (direction === 'down') {
        clipPlane = new Plane(new Vector3(0, 1, 0));
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

  shake2D({ shakes = 50, duration = 0.25, strength = 0.2, t }: Shake2DParameters = {}) {
    function R(max: number, min: number) {
      return app.rng() * (max - min) + min;
    }

    promise = promise.then(() => {
      const object3d = this.object3D;

      const tl = gsap.timeline({ defaults: { ease: 'linear' } });
      tl.set(object3d, { x: '+=0' }); // this creates a full _gsTransform on object3d

      // store the transform values that exist before the shake so we can return to them later
      const x = object3d.position.x;
      const y = object3d.position.y;

      // shake a bunch of times
      for (let i = 0; i < shakes - 1; i++) {
        const offset = R(-strength, strength);
        tl.to(object3d.position, {
          x: x + offset,
          y: y - offset,
          duration: duration / shakes,
        });
      }
      // return to pre-shake values
      tl.to(object3d.position, {
        x: x,
        y: y,
        duration: duration / shakes,
      });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  show({ duration = 0.001, t }: AnimationParameters = {}) {
    promise = promise.then(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none', duration } });
      tl.fromTo(this.object3D, { visible: false }, { visible: true });

      mainTimeline.add(tl, t);
    });
    return this;
  }

  hide({ duration = 0.001, t }: AnimationParameters = {}) {
    promise = promise.then(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none', duration } });
      tl.to(this.object3D, { visible: false });

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
      const { t, duration = app.defaultDuration } = params;
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
      const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;
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

interface ChangeTextParameters extends AnimationParameters {
  from?: number;
  to?: number;
}

interface TypeTextParameters extends AnimationParameters {
  interval?: number;
  cursorBlinkSpeed?: number;
  cursorBlinkCount?: number;
}

class TextObject extends GroupObject {
  changeText(func: (val: number) => any, params: ChangeTextParameters = {}) {
    promise = promise.then(() => {
      const {
        from = 0,
        to = 1,
        duration = app.defaultDuration,
        ease = app.defaultEase,
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

  typeText({
    t,
    duration,
    interval = 0.1,
    cursorBlinkSpeed = 1,
    cursorBlinkCount = 3,
  }: TypeTextParameters = {}) {
    promise = promise.then(() => {
      const textObject = this.object3D as TextMeshObject;

      const material = createMaterial({ color: 'white', doubleSided: true });
      const geometry = new PlaneGeometry(0.5, 1);
      const cursor = new Mesh(geometry, material);
      cursor.visible = false;

      if (duration !== undefined) {
        interval = duration / textObject.children.length;
      }

      const tl = gsap.timeline();
      tl.set(cursor, { visible: true });

      textObject.children.forEach((letter) => {
        letter.visible = false;
        tl.set(letter, { visible: true }, `<${interval}`);
        tl.set(cursor.position, {
          x: letter.position.x + 1 + textObject.letterSpacing,
          y: letter.position.y,
          z: letter.position.z,
        });
      });

      const blinkDuration = (1 / cursorBlinkSpeed) * 0.5;
      for (let i = 0; i < cursorBlinkCount - 1; i++) {
        tl.set(cursor, { visible: false }, `<${blinkDuration}`);
        tl.set(cursor, { visible: true }, `<${blinkDuration}`);
      }
      tl.set(cursor, { visible: false }, `<${blinkDuration}`);
      tl.set({}, {}, `<${blinkDuration}`);
      textObject.add(cursor);

      mainTimeline.add(tl, t);
    });
    return this;
  }

  transformText(to: string, params: TransformTexParameters = {}) {
    promise = promise.then(async () => {
      const dstTexObject = this.object3D.clone(true);
      await (dstTexObject as TextMeshObject).init();
      (dstTexObject as TextMeshObject).setText(to, true);

      this.object3D.parent.add(dstTexObject);
      const srcTexObject = this.object3D;

      mainTimeline.add(
        createTextTransformAnimation([srcTexObject], [dstTexObject], params),
        params.t
      );

      this.object3D = dstTexObject;
    });

    return this;
  }

  /**
   * @deprecated Use `setText()` instead.
   */
  updateText(text: string, params: AnimationParameters = {}) {
    this.setText(text, params);
    return this;
  }

  setText(text: string, params: AnimationParameters = {}) {
    promise = promise.then(async () => {
      const { t, duration = 0.001 } = params;
      mainTimeline.set(
        {},
        {
          onComplete: () => {
            const textMesh = this.object3D as TextMeshObject;
            textMesh.setText(text);
          },
          duration,
        },
        t
      );
    });
  }
}

class LineObject extends SceneObject {
  verts: Vector3[] = [];
  arrowEnd: SceneObject;

  /**
   * @deprecated Use `setVert()` instead.
   */
  updateVert(i: number, position: [number, number, number?], params: AnimationParameters = {}) {
    this.setVert(i, position, params.t);
    return this;
  }

  moveVert(i: number, position: [number, number, number?], params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
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

  drawLine(params: AnimationParameters = {}) {
    const { t, duration = app.defaultDuration, ease = app.defaultEase } = params;

    promise = promise.then(() => {
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

    if (this.arrowEnd) {
      this.arrowEnd.show({
        t: '>',
      });
    }

    return this;
  }
}

interface TransformTexParameters extends AnimationParameters {
  type?: 'transform' | 'crossfade';
  reverse?: boolean;
}

function createTextTransformAnimation(
  from: Object3D[],
  to: Object3D[],
  params: TransformTexParameters = {}
) {
  const { duration = 1, ease = app.defaultEase, type = 'transform' } = params;

  if (type === 'transform') {
    const tl = gsap.timeline({ defaults: { ease, duration } });

    // From tex objects
    const fromTexObjects = [];
    for (const o of from) {
      tl.set(o, { visible: true }, '<');
      tl.set(o.children, { visible: true }, '<');
      o.updateWorldMatrix(true, true);
      console.assert(o instanceof Group);
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
      console.assert(o instanceof Group);
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

        const posInSrcTexObject = new Vector3();
        const scaleInSrcTexObject = new Vector3();
        tl.set(
          {},
          {
            onComplete: () => {
              c2.getWorldPosition(posInSrcTexObject);
              c1.parent.worldToLocal(posInSrcTexObject);

              c2.getWorldScale(scaleInSrcTexObject);
              scaleInSrcTexObject.divide(c1.parent.getWorldScale(new Vector3()));
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

        const { duration = 1, ease = app.defaultEase } = params;
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
  radius?: number;
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
    const geometry = new SphereGeometry(500, 60, 40);
    // invert the geometry on the x-axis so that all of the faces point inward
    geometry.scale(-1, 1, 1);

    const texture = new TextureLoader().load(file);
    texture.encoding = sRGBEncoding;
    const material = new MeshBasicMaterial({ map: texture });
    const skySphere = new Mesh(geometry, material);
    app.scene.add(skySphere);

    obj.object3D = skySphere;
  });

  return obj;
}

interface AddLineParameters extends Transform, BasicMaterial {
  lineWidth?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  arrowSize?: number;
}

interface AddArrowParameters extends AddLineParameters {}

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
  /**
   * @deprecated use size instead.
   */
  gridSize?: number;

  size?: number;

  sizeX?: number;
  sizeY?: number;
}

function toThreeVector3(v?: { x?: number; y?: number; z?: number } | [number, number, number?]) {
  if (v === undefined) {
    return new Vector3(0, 0, 0);
  }
  if (Array.isArray(v)) {
    if (v.length == 2) {
      return new Vector3(v[0], v[1]);
    }
    if (v.length == 3) {
      return new Vector3(v[0], v[1], v[2]);
    }
  } else {
    return new Vector3(
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
  position?: [number, number, number?];
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
    | 'bottomRight'
    | [number, number, number?];
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
  centralAngle?: any;
  letterSpacing?: any;
  duration?: any;
  type?: any;
  divisions?: number;
}

interface AddImageParameters extends AddObjectParameters {
  filter?: 'linear' | 'nearest';
}

interface AddConeParameters extends AddObjectParameters {
  radius?: number;
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

function createPoints(geometry: BufferGeometry, params: BasicMaterial = {}) {
  const points = new Points(geometry, createMaterial({ ...params, showPoints: true }));
  points.onBeforeRender = () => {
    (points.material as PointsMaterial).size = convertScreenToWorld(
      points,
      params.pointSize || DEFAULT_POINT_SIZE
    );
  };
  return points;
}

function createMaterial(params: BasicMaterial = {}) {
  const side = params.doubleSided === undefined ? FrontSide : DoubleSide;

  if (params.showPoints) {
    return new PointsMaterial({ color: toThreeColor(params.color) });
  }
  if (params.wireframe) {
    if (params.lineWidth) {
      return createLineMaterial(params.color, params.lineWidth, params.dashed);
    } else {
      return new MeshBasicMaterial({
        side,
        color: toThreeColor(params.color),
        wireframe: true,
      });
    }
  }
  if (params.lighting) {
    addDefaultLights();

    return new MeshStandardMaterial({
      side,
      color: toThreeColor(params.color),
      roughness: 0.5,
      transparent: params.opacity !== undefined && params.opacity < 1.0,
      opacity: params.opacity || 1.0,
      flatShading: params.flatShading,
    });
  }
  return new MeshBasicMaterial({
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

function updateTransform(obj: Object3D, transform: Transform) {
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
    if (obj.children.length > 0) {
      const aabb = computeAABB(obj);
      const size = aabb.getSize(new Vector3());
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
      } else if (Array.isArray(transform.anchor)) {
        for (const child of obj.children) {
          child.position.sub(toThreeVector3(transform.anchor));
        }
      } else {
        console.error(`invalid anchor parameter: ${transform.anchor}`);
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
  app.activeLayer = layer;
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
  app.rng = seedrandom(val);
}

export function random(min = 0, max = 1) {
  return min + app.rng() * (max - min);
}

function getGridPosition({ rows = 1, cols = 1, width = 25, height = 14 } = {}) {
  const gapX = width / cols;
  const gapY = height / rows;

  const startX = (width / cols - width) * 0.5;
  const startY = (height / rows - height) * 0.5;

  const results = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      results.push(new Vector3(j * gapX + startX, -(i * gapY + startY), 0));
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

export function setFPS(fps: number) {
  framerate = fps;
}

export function setBackgroundColor(color: number | string) {
  promise = promise.then(() => {
    app.scene.background = toThreeColor(color);
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
    if (!app.composer.passes.includes(app.bloomPass)) {
      app.bloomPass = new UnrealBloomPass(
        new Vector2(renderTargetWidth, renderTargetHeight),
        0.5, // Strength
        0.4, // radius
        0.85 // threshold
      );
      app.composer.addPass(app.bloomPass);

      // TODO: find a better way to remove the aliasing introduced in BloomPass.
      app.fxaaPass = new ShaderPass(FXAAShader);
      const ratio = renderer.getPixelRatio();
      app.fxaaPass.uniforms.resolution.value.x = 1 / (renderTargetWidth * ratio);
      app.fxaaPass.uniforms.resolution.value.y = 1 / (renderTargetHeight * ratio);
      app.composer.addPass(app.fxaaPass);
    }
  });
}

function _setCamera(cam: Camera) {
  app.mainCamera = cam;
}

async function loadObj(url: string): Promise<Group> {
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
  if (app.activeLayer === 'ui') {
    return app.uiRoot;
  } else if (app.activeLayer === 'main') {
    return app.root;
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

export function addCone(params: AddConeParameters = {}): SceneObject {
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

export function addImage(file: string, params: AddImageParameters = {}): SceneObject {
  return getRoot().addImage(file, params);
}

export function addVideo(file: string, params: AddObjectParameters = {}): SceneObject {
  return getRoot().addVideo(file, params);
}

export function addLine(points: [number, number, number?][], params: AddLineParameters): LineObject;

/**
 * @deprecated
 */
export function addLine(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddLineParameters
): LineObject;

export function addLine(
  arg1: [number, number, number?] | [number, number, number?][],
  arg2: [number, number, number?] | AddLineParameters,
  arg3?: AddLineParameters
): LineObject {
  if (Array.isArray(arg2)) {
    return getRoot().addLine([arg1 as [number, number, number?], arg2], arg3);
  } else {
    return getRoot().addLine(arg1 as [number, number, number?][], arg2);
  }
}

export function addPoint(params: AddObjectParameters = {}): GeometryObject {
  return getRoot().addPoint(params);
}

class GeometryObject extends SceneObject {
  private points: [number, number, number][];
  geometry: BufferGeometry;

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

      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
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
            this.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
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

export function addCurve(
  points: [number, number, number?][],
  params: AddLineParameters = {}
): LineObject {
  return getRoot().addCurve(points, params);
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

export function add3DModel(url: string, params: AddObjectParameters = {}): GeometryObject {
  return getRoot().add3DModel(url, params);
}

export function addArrow(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddArrowParameters = {}
): LineObject {
  return getRoot().addArrow(p1, p2, params);
}

export function addArrow3D(
  p1: [number, number, number?],
  p2: [number, number, number?],
  params: AddArrowParameters = {}
): SceneObject {
  return getRoot().addArrow3D(p1, p2, params);
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

class Axes3DObject extends SceneObject {
  axisX: SceneObject;
  axisY: SceneObject;
  axisZ: SceneObject;

  animateCreation(params: AnimationParameters = {}) {
    const { t, ease = app.defaultEase } = params;
    this.axisX.fadeIn({ t, duration: 1.5, ease });
    this.axisY.fadeIn({ t: `<0.25`, duration: 1.5, ease });
    this.axisZ.fadeIn({ t: `<0.25`, duration: 1.5, ease });
  }
}

export function addAxes3D(params: AddAxes3DParameters = {}): Axes3DObject {
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

export function shake2D(params: Shake2DParameters = {}) {
  return getRoot().shake2D(params);
}

export function usePerspectiveCamera() {
  app.mainCamera = createPerspectiveCamera();
}

export function useOrthographicCamera() {
  app.mainCamera = createOrthographicCamera();
}

export function addFog() {
  promise = promise.then(() => {
    app.scene.fog = new FogExp2(0x0, 0.03);
  });
}

export function setDefaultDuration(duration: number) {
  promise = promise.then(() => {
    app.defaultDuration = duration;
  });
}

export function setDefaultEase(ease: string) {
  promise = promise.then(() => {
    app.defaultEase = ease;
  });
}

interface AddFrustumParameters extends Transform, BasicMaterial {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

class FrustumObject extends SceneObject {
  perspectiveCamera: PerspectiveCamera;
  perspectiveCameraHelper: CameraHelper;

  changeFov(fov: number, params: AnimationParameters = {}) {
    promise = promise.then(() => {
      const { duration = app.defaultDuration, ease = app.defaultEase, t } = params;
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

function getNextAvailableName(usedNames: string[], name: string) {
  const set = new Set<string>(usedNames);
  if (!set.has(name)) {
    return name;
  }
  let i = 2;
  while (set.has(`${name}${i}`)) {
    i++;
  }
  return `${name}${i}`;
}

export function addMarker(name: string = undefined, t: string | number = undefined) {
  promise = promise.then(() => {
    if (!name) {
      name = 'm';
    }
    name = getNextAvailableName(Object.keys(mainTimeline.labels), name);
    mainTimeline.addLabel(name, t);
  });
}

const gltfLoader = new GLTFLoader();

function loadGLTF(url: string): Promise<Object3D> {
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
      const { duration = app.defaultDuration, ease = app.defaultEase, fov = 60, t } = params;

      const cam = app.mainCamera as PerspectiveCamera;
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
            const dir = new Vector3();
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

export interface Timeline {
  animations: {
    t: number;
  }[];
  markers: Marker[];
  duration: number;
}

function getTimeline(): Timeline {
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

app = createMovyApp();

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
const raycaster = new Raycaster();
const planeZ = new Plane(new Vector3(0, 0, 1), 0);

function onMouseMove(event: MouseEvent) {
  if (renderer === undefined) return;

  const bounds = renderer.domElement.getBoundingClientRect();

  const mouse = new Vector2(
    ((event.clientX - bounds.left) / (bounds.right - bounds.left)) * 2 - 1,
    -((event.clientY - bounds.top) / (bounds.bottom - bounds.top)) * 2 + 1
  );

  raycaster.setFromCamera(mouse, app.mainCamera);
  const target = new Vector3();
  raycaster.ray.intersectPlane(planeZ, target);

  // Copy to clipboard
  navigator.clipboard.writeText(
    `[${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)}]`
  );
}
// window.addEventListener("click", onMouseMove, false);
