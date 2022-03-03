import * as THREE from "three";
import "./style/player.css";
interface MoveCameraParameters extends Transform, AnimationParameters {
    lookAt?: {
        x?: number;
        y?: number;
        z?: number;
    } | [number, number, number?];
    fov?: number;
    zoom?: number;
}
export declare function cameraMoveTo(params?: MoveCameraParameters): void;
export declare function generateRandomString(length: number): string;
export declare function randomInt(min: number, max: number): number;
export declare function addGlitch({ duration, t }?: AnimationParameters): void;
/**
 * @deprecated No need to manually call run().
 */
export declare function run(): void;
export declare function getPolygonVertices({ sides, radius }?: {
    sides?: number;
    radius?: number;
}): [number, number][];
export declare function getTriangleVertices({ radius, }?: {
    radius?: number;
}): [number, number][];
interface AnimationParameters {
    t?: number | string;
    duration?: number;
    ease?: string;
}
interface MoveObjectParameters extends Transform, AnimationParameters {
}
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
declare class SceneObject {
    object3D: THREE.Object3D;
    children: SceneObject[];
    protected addObjectToScene(obj: SceneObject, transform: Transform): void;
    private add3DGeometry;
    _addMesh(mesh: THREE.Mesh, params?: AddObjectParameters): SceneObject;
    clone(): SceneObject;
    addGroup(params?: AddGroupParameters): GroupObject;
    add3DModel(url: string, params?: AddObjectParameters): SceneObject;
    addCircle(params?: AddCircleParameters): SceneObject;
    addArrow(p1: [number, number, number?], p2: [number, number, number?], params?: AddArrowParameters): SceneObject;
    addDoubleArrow(p1: [number, number, number?], p2: [number, number, number?], params?: AddLineParameters): SceneObject;
    addAxes2D(params?: AddAxes2DParameters): SceneObject;
    addAxes3D(params?: AddAxes3DParameters): SceneObject;
    addArc(startAngle: number, endAngle: number, radius?: number, params?: AddLineParameters): SceneObject;
    addGrid(params?: AddGridParameters): SceneObject;
    addImage(file: string, params?: AddTextParameters): SceneObject;
    addLine(p1: [number, number, number?], p2: [number, number, number?], params?: AddLineParameters): SceneObject;
    verts: THREE.Vector3[];
    addPolyline(points: [number, number, number?][], params?: AddLineParameters): SceneObject;
    addPyramid(params?: AddObjectParameters): SceneObject;
    addCube(params?: AddObjectParameters): SceneObject;
    addSphere(params?: AddObjectParameters): SceneObject;
    addCone(params?: AddObjectParameters): SceneObject;
    addCylinder(params?: AddObjectParameters): SceneObject;
    addTorus(params?: AddObjectParameters): SceneObject;
    addCircleOutline(params?: AddCircleOutlineParameters): SceneObject;
    addRectOutline(params?: AddOutlineParameters): SceneObject;
    addRect(params?: AddRectParameters): SceneObject;
    addPolygon(vertices: [number, number][], params?: AddPolygonParameters): SceneObject;
    addTriangle(params?: AddPolygonParameters): SceneObject;
    addTriangleOutline(params?: AddOutlineParameters): SceneObject;
    addText(text: string, params?: AddTextParameters): TextObject;
    addText3D(text: string, params?: AddText3DParameters): TextObject;
    addTextOutline(text: string, params?: AddTextOutlineParameters): TextObject;
    addTex(tex: string, params?: AddTextParameters): TexObject;
    moveTo(params?: MoveObjectParameters): this;
    setPos(pos: [number, number, number?], params?: AnimationParameters): this;
    scale(scale: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `scale()` instead.
     */
    scaleTo(scale: number, params?: AnimationParameters): this;
    scaleX(sx: number, params?: AnimationParameters): this;
    scaleY(sy: number, params?: AnimationParameters): this;
    scaleZ(sz: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `scaleX()` instead.
     */
    scaleXTo(sx: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `scaleY()` instead.
     */
    scaleYTo(sy: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `scaleZ()` instead.
     */
    scaleZTo(sz: number, params?: AnimationParameters): this;
    fadeIn({ duration, ease, t }?: AnimationParameters): this;
    fadeOut(params?: FadeObjectParameters): this;
    changeOpacity(opacity: number, { duration, ease, t }?: FadeObjectParameters): this;
    changeColor(color: string | number, { duration, ease, t }?: AnimationParameters): this;
    rotate(r: [number?, number?, number?], { t, duration, ease }?: AnimationParameters): this;
    rotateX(degrees: number, params?: AnimationParameters): this;
    rotateY(degrees: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `rotate()` instead.
     */
    rotateTo(rx?: number, ry?: number, rz?: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `rotateX()` instead.
     */
    rotateXTo(degrees: number, params?: AnimationParameters): this;
    /**
     * @deprecated Use `rotateY()` instead.
     */
    rotateYTo(degrees: number, params?: AnimationParameters): this;
    spinning({ t, duration, repeat, ease, x, y, }?: RotateParameters): this;
    rotateIn({ t, duration, ease, }?: AnimationParameters): this;
    grow({ t, ease, duration }?: AnimationParameters): this;
    grow2({ t }?: AnimationParameters): this;
    grow3({ t }?: AnimationParameters): this;
    flying({ t, duration }?: AnimationParameters): this;
    reveal({ direction, t, duration, ease, }?: RevealParameters): this;
    vertexToAnimate: Map<number, THREE.Vector3>;
    /**
     * @deprecated Use `setVert()` instead.
     */
    updateVert(i: number, position: [number, number, number?], params?: AnimationParameters): this;
    moveVert(i: number, position: [number, number, number?], params?: AnimationParameters): this;
    setVert(i: number, position: [number, number, number?], t?: number | string): this;
    wipeIn({ direction, t, duration, ease, }?: WipeInParameters): this;
    shake2D({ interval, duration, strength, t, }?: Shake2DParameters): this;
    show({ duration, t }?: Shake2DParameters): this;
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
declare class GroupObject extends SceneObject {
    explode2D({ t, ease, duration, minRotation, maxRotation, minRadius, maxRadius, minScale, maxScale, stagger, speed, }?: ExplodeParameters): this;
    implode2D({ t, duration }?: AnimationParameters): this;
    flyIn({ t, duration, ease }?: AnimationParameters): this;
}
interface ChangeTextParameters extends AnimationParameters {
    from?: number;
    to?: number;
}
interface TypeTextParameters extends AnimationParameters {
    interval?: number;
}
declare class TextObject extends GroupObject {
    /**
     * @deprecated Use `setText()` instead.
     */
    changeText(func: (val: number) => any, { from, to, duration, ease, t, }?: ChangeTextParameters): this;
    typeText({ t, duration, interval }?: TypeTextParameters): this;
    /**
     * @deprecated Use `setText()` instead.
     */
    updateText(text: string, params?: AnimationParameters): this;
    setText(text: string, t?: number | string): void;
}
interface TransformTexParameters extends AnimationParameters {
    type?: "transform" | "fade";
    reverse?: boolean;
}
declare class TexObject extends GroupObject {
    _initParams: AddTextParameters;
    transformTexTo(to: string | TexObject | TexObject[], params?: TransformTexParameters): this;
    transformTexFrom(from: TexObject | TexObject[], params?: AnimationParameters): this;
    clone(): TexObject & SceneObject;
    /**
     * @deprecated Use `setTex()` instead.
     */
    updateTex(tex: string, params?: AnimationParameters): this;
    setTex(tex: string, t?: number | string): void;
}
interface AddTextParameters extends Transform, BasicMaterial {
    font?: "en" | "condensed" | "code" | "math" | "arcade" | "zh" | "gdh";
    fontSize?: number;
    letterSpacing?: number;
    centerTextVertically?: boolean;
    ccw?: boolean;
}
interface AddText3DParameters extends AddTextParameters {
}
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
interface AddPolygonParameters extends Transform, BasicMaterial {
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
    xRange?: [number, number, number?];
    yRange?: [number, number, number?];
    zRange?: [number, number, number?];
    showLabels?: boolean;
}
interface AddGridParameters extends Transform, BasicMaterial {
    gridSize?: number;
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
    anchor?: "left" | "right" | "top" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
    billboarding?: boolean;
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
interface AddGroupParameters extends Transform {
}
export declare function getQueryString(url?: string): any;
export declare function setSeed(val: any): void;
export declare function random(min?: number, max?: number): number;
export declare function enableMotionBlur({ samples }?: {
    samples?: number;
}): void;
export declare function setResolution(w: number, h: number): void;
export declare function setBackgroundColor(color: number | string): void;
export declare function fadeOutAll(params?: AnimationParameters): void;
export declare function hideAll(params?: AnimationParameters): void;
export declare function pause(duration: number | string): void;
export declare function enableBloom(): void;
export declare function addCircle(params?: AddCircleParameters): SceneObject;
export declare function addCircleOutline(params?: AddCircleOutlineParameters): SceneObject;
export declare function addCone(params?: AddObjectParameters): SceneObject;
export declare function addCube(params?: AddObjectParameters): SceneObject;
export declare function addCylinder(params?: AddObjectParameters): SceneObject;
export declare function addGrid(params?: AddGridParameters): SceneObject;
export declare function addGroup(params?: AddGroupParameters): GroupObject;
export declare function addImage(file: string, params?: AddTextParameters): SceneObject;
export declare function addLine(p1: [number, number, number?], p2: [number, number, number?], params?: AddLineParameters): SceneObject;
export declare function addPolyline(points: [number, number, number][], params?: AddObjectParameters): SceneObject;
export declare function addPyramid(params?: AddObjectParameters): SceneObject;
export declare function addRect(params?: AddRectParameters): SceneObject;
export declare function addRectOutline(params?: AddOutlineParameters): SceneObject;
export declare function addSphere(params?: AddObjectParameters): SceneObject;
export declare function addText(text: string, params?: AddTextParameters): TextObject;
export declare function addText3D(text: string, params?: AddText3DParameters): TextObject;
export declare function addTextOutline(text: string, params?: AddTextOutlineParameters): TextObject;
export declare function addTex(tex: string, params?: AddTextParameters): TexObject;
export declare function addTorus(params?: AddObjectParameters): SceneObject;
export declare function addTriangle(params?: AddPolygonParameters): SceneObject;
export declare function addPolygon(vertices: [number, number][], params?: AddPolygonParameters): SceneObject;
export declare function addTriangleOutline(params?: AddOutlineParameters): SceneObject;
export declare function add3DModel(url: string, params?: AddObjectParameters): SceneObject;
export declare function addArrow(p1: [number, number, number?], p2: [number, number, number?], params?: AddArrowParameters): SceneObject;
export declare function addDoubleArrow(p1: [number, number, number?], p2: [number, number, number?], params?: AddLineParameters): SceneObject;
export declare function addAxes2D(params?: AddAxes2DParameters): SceneObject;
export declare function addAxes3D(params?: AddAxes3DParameters): SceneObject;
export declare function addArc(startAngle: number, endAngle: number, radius?: number, params?: AddLineParameters): SceneObject;
export declare function moveTo(params?: MoveObjectParameters): GroupObject;
export declare function usePerspectiveCamera(): void;
export declare function useOrthographicCamera(): void;
export declare function addFog(): void;
export {};
