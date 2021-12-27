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

const REGEX_ZH_CN =
  /[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]/;

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
  font: Font;
  material: Material;

  constructor({
    fontSize = 1.0,
    letterSpacing = 0,
    color = new Color(0xffffff),
    font = undefined,
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
    if (this.fontName !== undefined) {
      this.font = await preloadFont(this.fontName);
    } else {
      await Promise.all([preloadFont("zh"), await preloadFont("en")]);
    }
  }

  getFont(letter: string) {
    if (this.font) {
      return this.font;
    } else {
      const fontName = REGEX_ZH_CN.test(letter) ? "zh" : "en";
      return fontMap[fontName];
    }
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
        const font = this.getFont(char);

        const fontData = font.data as any;
        const resolution = fontData.resolution;
        const glyph =
          (font.data as any).glyphs[char] || (font.data as any).glyphs["?"];
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
