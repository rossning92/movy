import * as THREE from 'three';
export declare function tex2svg(tex: string, { color }?: {
    color?: string;
}): Promise<SVGElement>;
export declare function createTexObject(tex: string, { color }?: {
    color?: string;
}): Promise<THREE.Object3D>;
export declare function createTexSprite(tex: string, { color }?: {
    color?: string;
}): Promise<THREE.Object3D>;
export declare function tex2canvas(tex: string, { color }?: {
    color?: string;
}): Promise<HTMLCanvasElement>;
