/**
 * @file The main file that implements all movy.js APIs.
 * @author Ross Ning
 */

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { GlitchPass } from "./utils/GlitchPass";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import * as dat from "dat.gui";
import * as THREE from "three";
import gsap from "gsap";
import Stats from "three/examples/jsm/libs/stats.module.js";
import TextMesh from "./objects/TextMesh";

declare class CCapture {
  constructor(params: any);
}

gsap.ticker.remove(gsap.updateRoot);

let glitchPassEnabled = false;
let screenWidth = 1920;
let screenHeight = 1080;
let antiAliasMethod = "msaa";
let motionBlurSamples = 1;
let bloomEnabled = false;
let globalTimeline = gsap.timeline({ onComplete: stopCapture });
const mainTimeline = gsap.timeline();
let stats: Stats = undefined;
let capturer: CCapture = undefined;
let renderer: THREE.WebGLRenderer = undefined;
let composer: EffectComposer = undefined;
let scene: THREE.Scene = undefined;
let camera: THREE.Camera = undefined;
let lightGroup: THREE.Group = undefined;
let cameraControls: OrbitControls = undefined;
let glitchPass: any;
let gridHelper: THREE.GridHelper;
let backgroundAlpha = 1.0;

let lastTimestamp: number = undefined;
let timeElapsed = 0;

globalTimeline.add(mainTimeline, "0");

let options = {
  format: "webm",
  framerate: 25,
  render: function () {
    startCapture();
  },
  timeline: 0,
};

const gui = new dat.GUI();
gui.add(options, "format", ["webm", "png"]);
gui.add(options, "framerate", [10, 25, 30, 60, 120]);
gui.add(options, "render");

const seedrandom = require("seedrandom");
let rng = seedrandom("hello.");

const commandQueue: Function[] = [];

function startCapture({ resetTiming = true, name = document.title } = {}) {
  if (gridHelper !== undefined) {
    gridHelper.visible = false;
  }

  if (resetTiming) {
    // Reset gsap
    gsap.ticker.remove(gsap.updateRoot);

    lastTimestamp = undefined;
  }

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

function stopCapture() {
  if (capturer !== undefined) {
    (capturer as any).stop();
    (capturer as any).save();
    capturer = undefined;
  }
}

function setupOrthoCamera() {
  if (camera === undefined) {
    const aspect = screenWidth / screenHeight;
    const frustumSize = 16;
    camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      -1000,
      1000
    );
  }
}

function setupPespectiveCamera() {
  if (camera === undefined) {
    // This will ensure the size of 10 in the vertical direction.
    camera = new THREE.PerspectiveCamera(
      60,
      screenWidth / screenHeight,
      0.1,
      5000
    );
    camera.position.set(0, 0, 8.66);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  }
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: antiAliasMethod === "msaa",
  });
  renderer.localClippingEnabled = true;

  renderer.setSize(screenWidth, screenHeight);
  document.body.appendChild(renderer.domElement);

  {
    stats = Stats();
    // stats.showPanel(1); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
  }

  renderer.setClearColor(0x000000, backgroundAlpha);
  scene.background = new THREE.Color(0);

  setupPespectiveCamera();

  cameraControls = new OrbitControls(camera, renderer.domElement);

  scene.add(new THREE.AmbientLight(0x000000));

  let renderScene = new RenderPass(scene, camera);

  composer = new EffectComposer(renderer);
  composer.setSize(screenWidth, screenHeight);
  composer.addPass(renderScene);

  if (bloomEnabled) {
    // Bloom pass
    let bloomPass = new UnrealBloomPass(
      new THREE.Vector2(screenWidth, screenHeight),
      0.5, // Strength
      0.4, // radius
      0.85 // threshold
    );
    composer.addPass(bloomPass);
  }

  if (antiAliasMethod === "fxaa") {
    const fxaaPass = new ShaderPass(FXAAShader);

    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.uniforms["resolution"].value.x = 1 / (screenWidth * pixelRatio);
    fxaaPass.uniforms["resolution"].value.y = 1 / (screenHeight * pixelRatio);

    composer.addPass(fxaaPass);
  }

  if (glitchPassEnabled) {
    glitchPass = new GlitchPass();
    composer.addPass(glitchPass);
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

  // cameraControls.update();

  composer.render();

  stats.update();

  if (capturer) (capturer as any).capture(renderer.domElement);
}

interface MoveCameraParameters extends Transform, AnimationParameters {
  lookAt?: { x?: number; y?: number; z?: number } | number[];
}
export function cameraMoveTo(params: MoveCameraParameters = {}) {
  const { t, lookAt, duration = 0.5, ease = "expo.out" } = params;

  commandQueue.push(() => {
    const tl = gsap.timeline({
      defaults: {
        duration,
        ease,
        onUpdate: () => {
          if (lookAt) {
            camera.lookAt(toThreeVector3(lookAt));
          }
        },
      },
    });

    createTransformAnimation(params, tl, camera);

    mainTimeline.add(tl, t);
  });
}

scene = new THREE.Scene();

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

function createLine3D(
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
  const tl = gsap.timeline({ defaults: { duration, ease } });

  const materials = getAllMaterials(object3d);
  for (const material of materials) {
    material.transparent = true;
    tl.from(
      material,
      {
        opacity: 0,
        duration,
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

function createJumpInAnimation(
  object3d: THREE.Object3D,
  { ease = "elastic.out(1, 0.2)" } = {}
) {
  const duration = 0.5;

  let tl = gsap.timeline();
  tl.from(object3d.position, {
    y: object3d.position.y + 1,
    ease,
    duration,
  });

  tl.add(
    createFadeInAnimation(object3d, {
      duration,
    }),
    "<"
  );

  return tl;
}

function addDefaultLights() {
  if (lightGroup === undefined) {
    lightGroup = new THREE.Group();
    scene.add(lightGroup);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0.3, 1, 0.5);
    lightGroup.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // soft white light
    lightGroup.add(ambientLight);
  }
}

function createExplosionAnimation(
  objectGroup: THREE.Object3D,
  {
    ease = "expo.out",
    duration = 2,
    minRotation = -2 * Math.PI,
    maxRotation = 2 * Math.PI,
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
    const x = r * 2.0 * Math.cos(theta);
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

function getCompoundBoundingBox(object3D: THREE.Object3D) {
  let box: THREE.Box3;
  object3D.traverse(function (obj3D) {
    const geometry: THREE.Geometry = (obj3D as any).geometry;
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
  { color, ccw = true }: { color?: THREE.Color; ccw: boolean }
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
            color: color === undefined ? (path as any).color : color,
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
  antiAliasMethod = "fxaa";

  commandQueue.push(() => {
    const tl = gsap.timeline();
    tl.set(glitchPass, { factor: 1 });
    tl.set(glitchPass, { factor: 0 }, `<${duration}`);
    mainTimeline.add(tl, t);
  });
}

export function run() {
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

function createLine(
  material: THREE.Material,
  {
    from = new THREE.Vector3(0, 0, 0),
    to = new THREE.Vector3(0, 1, 0),
    lineWidth = 0.1,
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

  if (0) {
    const geometry = new THREE.CylinderBufferGeometry(
      lineWidth,
      lineWidth,
      halfLength * 2,
      32
    );
    const cylinder = new THREE.Mesh(geometry, material);
    group.add(cylinder);
  }

  {
    let length = halfLength * 2;
    let offset = halfLength;

    if (arrowEnd) {
      length -= lineWidth * 4;
      offset -= lineWidth * 4 * 0.5;
    }

    const geometry = new THREE.PlaneGeometry(lineWidth, length);

    const plane = new THREE.Mesh(geometry, material);
    plane.translateY(offset);

    group.add(plane);
  }

  for (let i = 0; i < 2; i++) {
    if (i === 0 && !arrowStart) continue;
    if (i === 1 && !arrowEnd) continue;

    const geometry = new THREE.Geometry();
    geometry.vertices = [
      new THREE.Vector3(-lineWidth * 2, -lineWidth * 4, 0),
      new THREE.Vector3(lineWidth * 2, -lineWidth * 4, 0),
      new THREE.Vector3(0, 0, 0),
    ];
    geometry.faces.push(new THREE.Face3(0, 1, 2));

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    if (i === 0) {
      mesh.rotation.z = Math.PI;
    } else {
      mesh.translateY(halfLength * 2);
    }
  }

  group.setRotationFromQuaternion(quaternion);
  group.position.set(from.x, from.y, from.z);
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

function createPolygonVertices({ sides = 3, radius = 0.5 } = {}) {
  const verts = [];
  for (let i = 0; i < sides; i++) {
    verts.push(
      new THREE.Vector3(
        radius * Math.sin((2 * i * Math.PI) / sides),
        radius * Math.cos((2 * i * Math.PI) / sides),
        0
      )
    );
  }
  return verts;
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

interface RotateParameters extends AnimationParameters {}

function createTransformAnimation(
  transform: Transform,
  tl: gsap.core.Timeline,
  object3d: THREE.Object3D
) {
  const { position, x, y, z, rx, ry, rz, sx, sy, sz, scale } = transform;

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
        x: scale,
        y: scale,
        z: scale,
      },
      "<"
    );
  } else {
    if (sx !== undefined) tl.to(object3d.scale, { x: sx }, "<");
    if (sy !== undefined) tl.to(object3d.scale, { y: sy }, "<");
    if (sz !== undefined) tl.to(object3d.scale, { z: sz }, "<");
  }
}

class SceneObject {
  _threeObject3d: THREE.Object3D;

  moveTo(params: MoveObjectParameters = {}) {
    const { t, duration = 0.5, ease = "power2.out" } = params;

    commandQueue.push(() => {
      let tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      createTransformAnimation(params, tl, this._threeObject3d);

      mainTimeline.add(tl, t);
    });
    return this;
  }

  fadeIn({ duration = 0.25, ease = "linear", t }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      const materials = getAllMaterials(this._threeObject3d);
      for (const material of materials) {
        material.transparent = true;
        tl.from(
          material,
          {
            opacity: 0,
            duration,
          },
          "<"
        );
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  fadeOut(params: FadeObjectParameters = {}) {
    this.changeOpacity({ ...params, opacity: 0 });
    return this;
  }

  changeOpacity({
    duration = 0.25,
    ease = "linear",
    opacity = 0.5,
    t,
  }: FadeObjectParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      const materials = getAllMaterials(this._threeObject3d);
      for (const material of materials) {
        material.transparent = true;
        tl.to(
          material,
          {
            opacity,
          },
          "<"
        );
      }

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotate({ t, duration = 5, ease = "none" }: RotateParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration, ease } });

      tl.to(this._threeObject3d.rotation, { y: duration }, "<");

      mainTimeline.add(tl, t);
    });
    return this;
  }

  rotateIn({ t, duration = 0.5 }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({ defaults: { duration } });

      tl.from(
        this._threeObject3d.rotation,
        { z: Math.PI * 4, ease: "power.in", duration },
        "<"
      );
      tl.from(
        this._threeObject3d.scale,
        {
          x: Number.EPSILON,
          y: Number.EPSILON,
          z: Number.EPSILON,
          ease: "power.in",
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
      mainTimeline.from(
        this._threeObject3d.scale,
        { x: 0.01, y: 0.01, z: 0.01, ease: "expo.out" },
        t
      );
    });
    return this;
  }

  grow2({ t }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline();

      tl.fromTo(
        this._threeObject3d,
        { visible: false },
        { visible: true, ease: "none", duration: 0.001 }
      );

      tl.from(
        this._threeObject3d.scale,
        {
          x: 0.01,
          y: 0.01,
          z: 0.01,
          ease: "elastic.out(1, 0.75)",
          onStart: () => {
            this._threeObject3d.visible = true;
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
        this._threeObject3d.scale,
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

      this._threeObject3d.children.forEach((x) => {
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
      const object3d = this._threeObject3d;

      const clippingPlanes: THREE.Plane[] = [];
      const empty = Object.freeze([]);

      const box = getBoundingBox(object3d);

      const materials = getAllMaterials(object3d);

      const tl = gsap.timeline({
        defaults: { duration, ease },
      });

      tl.set(materials, { clippingPlanes });

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

      tl.set(materials, { clippingPlanes: empty });

      mainTimeline.add(tl, t);
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
      const boundingBox = getBoundingBox(this._threeObject3d);

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

      const materials = getAllMaterials(this._threeObject3d);
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
      const object3d = this._threeObject3d;

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
    minRadius = 2,
    maxRadius = 4,
    minScale = 1,
    maxScale = 1,
    stagger = 0.03,
    speed,
  }: ExplodeParameters = {}) {
    commandQueue.push(() => {
      let tl: gsap.core.Timeline;

      if (speed === "fastest") {
        tl = createExplosionAnimation(this._threeObject3d, {
          ease,
          duration: 1.0,
          minRotation,
          maxRotation,
          minRadius,
          maxRadius,
          minScale,
          maxScale,
          stagger: 0,
        });
      } else {
        tl = createExplosionAnimation(this._threeObject3d, {
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
      }

      mainTimeline.add(tl, t);
    });
  }

  implode2D({ t = undefined, duration = 0.5 }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({
        defaults: {
          duration,
          ease: "expo.out",
        },
      });

      tl.to(
        this._threeObject3d.children.map((x) => x.position),
        {
          x: 0,
          y: 0,
        },
        0
      );
      tl.to(
        this._threeObject3d.children.map((x) => x.scale),
        {
          x: 0.001,
          y: 0.001,
        },
        0
      );
      mainTimeline.add(tl, t);
    });
  }

  flyIn({ t, duration = 0.5, ease = "power.in" }: AnimationParameters = {}) {
    commandQueue.push(() => {
      const tl = gsap.timeline({
        defaults: {
          duration,
          ease,
        },
      });

      this._threeObject3d.children.forEach((child) => {
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
  }
}

function toThreeColor(color: string | number): THREE.Color {
  return color === undefined
    ? new THREE.Color(0xffffff)
    : new THREE.Color(color);
}

interface AddTextParameters extends Transform, BasicMaterial {
  font?: string;
  fontSize?: number;
  letterSpacing?: number;
}
export function addText(
  text: string,
  params: AddTextParameters = {}
): GroupObject {
  const { color, letterSpacing, font, fontSize = 1 } = params;

  const obj = new GroupObject();

  commandQueue.push(async () => {
    obj._threeObject3d = new TextMesh({
      text,
      font,
      color: toThreeColor(color),
      fontSize: fontSize,
      letterSpacing,
    });

    updateTransform(obj._threeObject3d, params);
    addObjectToScene(obj, params);
  });

  return obj;
}

interface AddTextParameters extends Transform, BasicMaterial {
  ccw?: boolean;
}
export function addImage(
  file: string,
  params: AddTextParameters = {}
): SceneObject {
  const obj = new SceneObject();

  const { color, ccw = false, opacity } = params;

  commandQueue.push(async () => {
    if (file.endsWith(".svg")) {
      obj._threeObject3d = await loadSVG(file, {
        ccw,
        color: color === undefined ? undefined : toThreeColor(color),
      });
    } else {
      const texture = await loadTexture(file);
      // TODO: do not hardcode anisotropy value, use renderer.getMaxAnisotropy();
      texture.anisotropy = 16;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      });

      const geometry = new THREE.PlaneBufferGeometry(1, 1);
      obj._threeObject3d = new THREE.Mesh(geometry, material);

      const ratio = texture.image.width / texture.image.height;
      if (ratio > 1) {
        obj._threeObject3d.scale.y /= ratio;
      } else {
        obj._threeObject3d.scale.x *= ratio;
      }
    }

    updateTransform(obj._threeObject3d, params);
    addObjectToScene(obj, params);
  });

  return obj;
}

export function addRect(params: AddTextParameters = {}): SceneObject {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    const material = createBasicMaterial(params);

    const geometry = new THREE.PlaneGeometry(1, 1);

    obj._threeObject3d = new THREE.Mesh(geometry, material);

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addCircle(params: AddTextParameters = {}): SceneObject {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    const material = createBasicMaterial(params);

    const geometry = new THREE.CircleGeometry(0.5, 128);

    obj._threeObject3d = new THREE.Mesh(geometry, material);

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addTriangle(params: AddTextParameters = {}): SceneObject {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    const material = createBasicMaterial(params);

    const geometry = new THREE.Geometry();
    const vertices = createPolygonVertices();
    geometry.vertices.push(vertices[0], vertices[1], vertices[2]);
    geometry.faces.push(new THREE.Face3(0, 1, 2));

    obj._threeObject3d = new THREE.Mesh(geometry, material);

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

interface AddOutlineParameters extends Transform, BasicMaterial {
  lineWidth?: number;
  width?: number;
  height?: number;
}
export function addTriangleOutline(params: AddOutlineParameters = {}) {
  const { lineWidth = 0.1, color } = params;

  const obj = new SceneObject();

  commandQueue.push(async () => {
    const material = createBasicMaterial(params);

    const vertices = createPolygonVertices();
    obj._threeObject3d = createLine3D(material, {
      points: vertices.concat(vertices[0]),
      lineWidth,
      color: toThreeColor(color),
    });

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addCircleOutline(params: AddOutlineParameters = {}) {
  const { lineWidth = 0.1, color } = params;

  const obj = new SceneObject();

  commandQueue.push(async () => {
    const material = createBasicMaterial(params);

    const vertices = createPolygonVertices({ sides: 128 });
    obj._threeObject3d = createLine3D(material, {
      points: vertices.concat(vertices[0]),
      lineWidth,
      color: toThreeColor(color),
    });

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addRectOutline(params: AddOutlineParameters = {}) {
  const { width = 1, height = 1, lineWidth = 0.1, color } = params;

  const obj = new SceneObject();

  commandQueue.push(async () => {
    const material = createBasicMaterial(params);

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    obj._threeObject3d = createLine3D(material, {
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

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

function createPhoneMaterial(material: BasicMaterial) {
  return new THREE.MeshPhongMaterial({
    color: toThreeColor(material.color),
    // emissive: 0x072534,
    // side: THREE.DoubleSide,
    flatShading: true,
  });
}

export function addPyramid(params: AddObjectParameters = {}): SceneObject {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    addDefaultLights();

    const material = createPhoneMaterial(params);

    const geometry = new THREE.ConeGeometry(0.5, 1.0, 4, 32);
    obj._threeObject3d = new THREE.Mesh(geometry, material);

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addSphere(params: AddObjectParameters = {}): SceneObject {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    addDefaultLights();

    const material = new THREE.MeshLambertMaterial({
      color: toThreeColor(params.color),
    });

    const geometry = new THREE.SphereGeometry(0.5, 64, 64);
    obj._threeObject3d = new THREE.Mesh(geometry, material);

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addCube(params: AddObjectParameters = {}): SceneObject {
  const obj = new SceneObject();

  commandQueue.push(async () => {
    addDefaultLights();

    const material = createPhoneMaterial(params);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    obj._threeObject3d = new THREE.Mesh(geometry, material);

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

interface AddLineParameters extends Transform, BasicMaterial {
  from?: { x?: number; y?: number; z?: number } | number[];
  to?: { x?: number; y?: number; z?: number } | number[];
  lineWidth?: number;
}
export function addLine(params: AddLineParameters = {}): SceneObject {
  const obj = new SceneObject();

  const { from = [0, 0, 0], to = [1, 0, 0], color, lineWidth = 0.1 } = params;

  commandQueue.push(async () => {
    addDefaultLights();

    const material = createBasicMaterial(params);

    obj._threeObject3d = createLine(material, {
      from: toThreeVector3(from),
      to: toThreeVector3(to),
      arrowStart: false,
      arrowEnd: false,
      lineWidth,
    });

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

export function addArrow(params: AddLineParameters = {}): SceneObject {
  const obj = new SceneObject();

  const { from = [0, 0, 0], to = [1, 0, 0], color, lineWidth = 0.1 } = params;

  commandQueue.push(async () => {
    addDefaultLights();

    const material = createBasicMaterial(params);

    obj._threeObject3d = createLine(material, {
      from: toThreeVector3(from),
      to: toThreeVector3(to),
      arrowStart: false,
      arrowEnd: true,
      lineWidth,
    });

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

interface AddGridParameters extends Transform, BasicMaterial {
  gridSize?: number;
}
export function addGrid(params: AddGridParameters = {}): SceneObject {
  const { gridSize = 10, color = 0xc0c0c0 } = params;

  const obj = new SceneObject();

  commandQueue.push(async () => {
    obj._threeObject3d = new THREE.GridHelper(
      gridSize,
      gridSize,
      0x00ff00,
      new THREE.Color(color)
    );
    obj._threeObject3d.rotation.x = Math.PI / 2;

    updateTransform(obj._threeObject3d, params);
    addObjectToScene(obj, params);
  });

  return obj;
}

function toThreeVector3(v: { x?: number; y?: number; z?: number } | number[]) {
  if (Array.isArray(v)) {
    if (v.length == 1) {
      return new THREE.Vector3(v[0]);
    } else if (v.length == 2) {
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
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  position?: number[];
  scale?: number;
  parent?: SceneObject;
}

interface AddObjectParameters extends Transform, BasicMaterial {
  vertices?: any;
  wireframe?: any;
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
}

function createBasicMaterial(basicMaterial: BasicMaterial) {
  const opacity =
    basicMaterial.opacity === undefined ? 1.0 : basicMaterial.opacity;

  return new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    color: new THREE.Color(
      basicMaterial.color === undefined ? 0xffffff : basicMaterial.color
    ),
    transparent: opacity < 1.0 ? true : false,
    opacity,
  });
}

function updateTransform(mesh: THREE.Object3D, transform: Transform) {
  // Scale
  if (transform.scale !== undefined) {
    mesh.scale.setScalar(transform.scale);
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
    if (transform.x !== undefined) mesh.position.x = transform.x;
    if (transform.y !== undefined) mesh.position.y = transform.y;
    if (transform.z !== undefined) mesh.position.z = transform.z;
  }

  // Rotation
  if (transform.rx !== undefined) mesh.rotation.x = transform.rx;
  if (transform.ry !== undefined) mesh.rotation.y = transform.ry;
  if (transform.rz !== undefined) mesh.rotation.z = transform.rz;
}

function addObjectToScene(obj: SceneObject, transform: Transform) {
  if (transform.parent !== undefined) {
    transform.parent._threeObject3d.add(obj._threeObject3d);
  } else {
    scene.add(obj._threeObject3d);
  }
}

interface AddGroupParameters extends Transform {}
export function addGroup(params: AddGroupParameters = {}) {
  const obj = new GroupObject();

  commandQueue.push(() => {
    obj._threeObject3d = new THREE.Group();

    updateTransform(obj._threeObject3d, params);

    addObjectToScene(obj, params);
  });

  return obj;
}

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

export function random() {
  return rng();
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
  antiAliasMethod = "fxaa";
}

export function setResolution(w: number, h: number) {
  screenWidth = w;
  screenHeight = h;
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

export function pause(duration: number) {
  commandQueue.push(() => {
    mainTimeline.set({}, {}, "+=" + duration.toString());
  });
}

export function addEmptyAnimation(t: number | string) {
  commandQueue.push(() => {
    mainTimeline.set({}, {}, t);
  });
}

export function enableBloom() {
  bloomEnabled = true;
  antiAliasMethod = "fxaa";
}
