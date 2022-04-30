import * as THREE from 'three';
interface SVGParameters {
    color?: string | number;
    ccw?: boolean;
    opacity?: number;
}
export declare function loadSVG(url: string, params?: SVGParameters): Promise<THREE.Object3D>;
export declare function parseSVG(text: string, params?: SVGParameters): THREE.Object3D;
export {};
