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

function loadFont(fontName = undefined, letter = undefined) {
  if (fontName === undefined && letter !== undefined) {
    fontName = REGEX_ZH_CN.test(letter) ? "zh" : "en";
  }

  if (fontName in fontMap) {
    return fontMap[fontName];
  } else {
    let font;
    if (fontName == "zh") {
      font = fontLoader.parse(require("../fonts/source-han-medium"));
    } else if (fontName == "en") {
      font = fontLoader.parse(require("../fonts/muli-bold"));
    } else if (fontName == "condensed") {
      font = fontLoader.parse(require("../fonts/bebas-neue-bold"));
    } else if (fontName == "math") {
      font = fontLoader.parse(require("../fonts/latin-modern-math-regular"));
    } else if (fontName == "code") {
      font = fontLoader.parse(require("../fonts/source-code-pro-regular"));
    } else if (fontName == "gdh") {
      font = fontLoader.parse(require("../fonts/gdh-regular"));
    } else {
      throw `Invalid font name: ${fontName}`;
    }

    fontMap[fontName] = font;
    return font;
  }
}

export default class TextMesh extends Object3D {
  constructor({
    text = "",
    fontSize = 1.0,
    letterSpacing = 0.05,
    color = new Color(0xffffff),
    font = undefined,
  } = {}) {
    super();

    this.fontSize = fontSize;
    this.color = color;
    this.letterSpacing = letterSpacing;
    this.fontName = font;
    this.text = text;
  }

  set text(text) {
    this.children.length = 0;

    let totalWidth = 0;
    const letters = [...text];
    const letterSize = [];
    letters.forEach((letter) => {
      if (letter === " ") {
        totalWidth += this.fontSize * 0.5;
      } else {
        const font = loadFont(this.fontName, letter);

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

        this.add(mesh);
      }
    });

    this.children.forEach((letter, i) => {
      letter.position.set(-0.5 * totalWidth + letterSize[i], -0.5, 0);
    });
  }
}
