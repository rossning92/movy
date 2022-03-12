import { Color, Group, Font, Material } from 'three';
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
    params: TextMeshObjectParams;
    shouldUpdate: boolean;
    fonts: Font[];
    text: string;
    constructor(params?: TextMeshObjectParams);
    init(): Promise<void>;
    setText(text: string, forceUpdate?: boolean): void;
    update(): void;
}
export {};
