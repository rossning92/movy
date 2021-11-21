import {
  Color,
  DoubleSide,
  FontLoader,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  ShapeBufferGeometry,
} from "three";

const fontLoader = new FontLoader();

const REGEX_ZH_CN =
  /[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]/;

const fontMap = {};

async function preloadFont(fontName) {
  if (!(fontName in fontMap)) {
    let font;
    if (fontName == "zh") {
      font = await fontLoader.loadAsync("fonts/source-han-medium.json");
    } else if (fontName == "en") {
      font = await fontLoader.loadAsync("fonts/muli-bold.json");
    } else if (fontName == "condensed") {
      font = await fontLoader.loadAsync("fonts/bebas-neue-bold.json");
    } else if (fontName == "math") {
      font = await fontLoader.loadAsync("fonts/latin-modern-math-regular.json");
    } else if (fontName == "code") {
      font = await fontLoader.loadAsync("fonts/source-code-pro-regular.json");
    } else if (fontName == "gdh") {
      font = await fontLoader.loadAsync("fonts/gdh-regular.json");
    } else {
      throw `Invalid font name: ${fontName}`;
    }

    fontMap[fontName] = font;
  }
  return fontMap[fontName];
}

export default class TextMesh extends Object3D {
  constructor({
    fontSize = 1.0,
    letterSpacing = 0.05,
    color = new Color(0xffffff),
    font = undefined,
    verticalAlign = undefined,
  } = {}) {
    super();

    this.fontSize = fontSize;
    this.color = color;
    this.letterSpacing = letterSpacing;
    this.fontName = font;
    this.verticalAlign = verticalAlign;
  }

  async init() {
    if (this.fontName !== undefined) {
      this.font = await preloadFont(this.fontName);
    } else {
      await Promise.all([preloadFont("zh"), await preloadFont("en")]);
    }
  }

  getFont(letter) {
    if (this.font) {
      return this.font;
    } else {
      const fontName = REGEX_ZH_CN.test(letter) ? "zh" : "en";
      return fontMap[fontName];
    }
  }

  setText(text) {
    this.children.length = 0;

    let totalWidth = 0;
    const letters = [...text];
    const letterSize = [];
    let minY = Number.MAX_VALUE;
    let maxY = Number.MIN_VALUE;

    for (const letter of letters) {
      if (letter === " ") {
        totalWidth += this.fontSize * 0.5;
      } else {
        const font = this.getFont(letter);

        const geom = new ShapeBufferGeometry(
          font.generateShapes(letter, this.fontSize, 1)
        );
        geom.computeBoundingBox();
        const mat = new MeshBasicMaterial({
          color: this.color,
          side: DoubleSide,
        });
        const mesh = new Mesh(geom, mat);

        letterSize.push(totalWidth);
        totalWidth += geom.boundingBox.max.x + this.letterSpacing;
        minY = Math.min(minY, geom.boundingBox.min.y);
        maxY = Math.max(maxY, geom.boundingBox.max.y);

        this.add(mesh);
      }
    }

    this.children.forEach((letter, i) => {
      letter.position.set(
        -0.5 * totalWidth + letterSize[i],
        this.verticalAlign === "center" ? -0.5 * (maxY - minY) : -0.5,
        0
      );
    });
  }
}
