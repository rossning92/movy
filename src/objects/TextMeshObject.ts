import {
  Color,
  DoubleSide,
  FontLoader,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  ShapeBufferGeometry,
  Font,
  Material,
} from "three";

const fontLoader = new FontLoader();

const fontMap: Record<string, Font> = {};

async function preloadFont(fontName: string): Promise<Font> {
  if (!(fontName in fontMap)) {
    let font: Font;
    if (fontName == "zh") {
      font = await fontLoader.loadAsync(
        "fonts/SourceHanSansSC-Regular.subset.json"
      );
    } else if (fontName == "en") {
      font = await fontLoader.loadAsync("fonts/Roboto-Regular.json");
    } else if (fontName == "condensed") {
      font = await fontLoader.loadAsync("fonts/RobotoCondensed-Regular.json");
    } else if (fontName == "math") {
      font = await fontLoader.loadAsync("fonts/LatinModernMath-Regular.json");
    } else if (fontName == "code") {
      font = await fontLoader.loadAsync("fonts/SourceCodePro-Regular.json");
    } else if (fontName == "gdh") {
      font = await fontLoader.loadAsync("fonts/zcool-gdh-Regular.subset.json");
    } else if (fontName == "arcade") {
      font = await fontLoader.loadAsync("fonts/PressStart2P-Regular.json");
    } else {
      throw `Invalid font name: ${fontName}`;
    }

    fontMap[fontName] = font;
  }
  return fontMap[fontName];
}

export default class TextMeshObject extends Object3D {
  fontSize: number;
  color: Color;
  letterSpacing: number;
  fontName: string;
  centerTextVertically: boolean;
  fonts: Font[];
  material: Material;

  constructor({
    fontSize = 1.0,
    letterSpacing = 0,
    color = new Color(0xffffff),
    font = "en,zh",
    centerTextVertically = false,
    material,
  }: {
    fontSize?: number;
    letterSpacing?: number;
    color?: Color;
    font?: string;
    centerTextVertically?: boolean;
    material?: Material;
  } = {}) {
    super();

    this.fontSize = fontSize;
    this.color = color;
    this.letterSpacing = letterSpacing;
    this.fontName = font;
    this.centerTextVertically = centerTextVertically;
    this.material = material;
  }

  async init() {
    this.fonts = await Promise.all(
      this.fontName.split(",").map((fontName) => preloadFont(fontName))
    );
  }

  setText(text: string) {
    this.children.length = 0;

    let totalWidth = 0;
    const letterPosX: number[] = [];
    let minY = Number.MAX_VALUE;
    let maxY = Number.MIN_VALUE;
    const geometies: ShapeBufferGeometry[] = [];
    for (const [i, char] of [...text].entries()) {
      if (char === " ") {
        totalWidth += this.fontSize * 0.5;
      } else {
        let font: Font;
        let glyph: any;
        for (let j = 0; j < this.fonts.length; j++) {
          font = this.fonts[j];
          glyph = (font.data as any).glyphs[char];
          if (glyph) {
            break;
          } else if (j == this.fonts.length - 1) {
            glyph = (font.data as any).glyphs["?"];
          }
        }

        const fontData = font.data as any;
        const resolution = fontData.resolution;
        const ha = (glyph.ha / resolution) * this.fontSize;

        const geometry = new ShapeBufferGeometry(
          font.generateShapes(char, this.fontSize)
        );
        geometry.computeBoundingBox();
        let mat: Material;
        if (this.material === undefined) {
          mat = new MeshBasicMaterial({
            color: this.color,
            side: DoubleSide,
          });
        } else {
          mat = this.material.clone();
        }

        geometies.push(geometry);

        const mesh = new Mesh(geometry, mat);

        const letterWidth = ha;
        const xMid = 0.5 * letterWidth;
        geometry.translate(
          -0.5 * (geometry.boundingBox.min.x + geometry.boundingBox.max.x),
          0,
          0
        );

        letterPosX.push(totalWidth + xMid);
        totalWidth +=
          letterWidth +
          (i < text.length - 1 ? this.letterSpacing * this.fontSize : 0);
        minY = Math.min(minY, geometry.boundingBox.min.y);
        maxY = Math.max(maxY, geometry.boundingBox.max.y);

        this.add(mesh);
      }
    }

    const deltaY = (maxY + minY) * 0.5;
    for (const geometry of geometies) {
      geometry.translate(
        0,
        this.centerTextVertically ? -deltaY : -0.5 * this.fontSize,
        0
      );
    }

    this.children.forEach((letter, i) => {
      letter.position.set(-0.5 * totalWidth + letterPosX[i], 0, 0);
    });
  }
}
