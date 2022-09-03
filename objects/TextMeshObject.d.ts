import { Color, Font, Group, Material } from 'three';
interface TextMeshObjectParams {
    fontSize?: number;
    letterSpacing?: number;
    color?: Color;
    font?: string;
    centerTextVertically?: boolean;
    material?: Material;
    text3D?: boolean;
    stroke?: boolean;
    strokeWidth?: number;
}
export default class TextMeshObject extends Group {
    centerTextVertically: boolean;
    color: Color;
    font: string;
    fonts: Font[];
    fontSize: number;
    letterSpacing: number;
    material: Material;
    shouldUpdate: boolean;
    stroke: boolean;
    strokeWidth: number;
    text: string;
    text3D: boolean;
    constructor({ centerTextVertically, color, font, fontSize, letterSpacing, stroke, strokeWidth, text3D, material, }?: TextMeshObjectParams);
    init(): Promise<void>;
    setText(text: string, forceUpdate?: boolean): void;
    updateText(): void;
}
export {};
