import {
  Object3D,
  MeshBasicMaterial,
  Mesh,
  FontLoader,
  ShapeBufferGeometry,
  Group,
  Color,
  DoubleSide,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

const fontLoader = new FontLoader();

const CHINESE_REGEX = /[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]/;

const fontMap = {};

function loadFont(fontName = undefined, letter = undefined) {
  if (fontName === undefined && letter !== undefined) {
    fontName = CHINESE_REGEX.test(letter) ? "zh" : "en";
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
    opacity = 1,
    font = undefined,
    material = undefined,
  } = {}) {
    super();

    this.basePosition = 0;
    this.fontSize = fontSize;
    this.color = color;
    this.letterSpacing = letterSpacing;

    this.fontName = font;

    if (material) {
      this.material = material;
    } else {
      this.material = undefined;
    }

    this.text = text;

    // Text outlines
    // make line shape ( N.B. edge view remains visible )
    if (0) {
      // Hole shapes contains all the holes in text glyphs
      let holeShapes = [];

      for (let i = 0; i < shapes.length; i++) {
        let shape = shapes[i];
        if (shape.holes && shape.holes.length > 0) {
          for (let j = 0; j < shape.holes.length; j++) {
            let hole = shape.holes[j];
            holeShapes.push(hole);
          }
        }
      }

      let lineColor = new Color(color);
      let matDark = new MeshBasicMaterial({
        color: color,
        side: DoubleSide,
      });

      shapes.push.apply(shapes, holeShapes);

      let style = SVGLoader.getStrokeStyle(0.05, lineColor.getStyle());
      let strokeText = new Group();

      for (let i = 0; i < shapes.length; i++) {
        let shape = shapes[i];
        let points = shape.getPoints();

        let geometry = SVGLoader.pointsToStroke(points, style);

        geometry.translate(xMid, 0, 0);

        let strokeMesh = new Mesh(geometry, matDark);
        strokeText.add(strokeMesh);
      }
      this.add(strokeText);
    }
  }

  set text(text) {
    this.children.length = 0;

    if (1) {
      let totalWidth = 0;
      const letters = [...text];
      const letterSize = [];
      let minY = 999,
        maxY = -999;
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

          // mesh.position.x = basePosition;
          letterSize.push(totalWidth);
          totalWidth += geom.boundingBox.max.x + this.letterSpacing;

          minY = Math.min(minY, geom.boundingBox.min.y);
          maxY = Math.max(maxY, geom.boundingBox.max.y);
          // minX

          this.add(mesh);
        }
      });

      this.children.forEach((letter, i) => {
        letter.position.set(
          -0.5 * totalWidth + letterSize[i],
          -0.5 * (maxY - minY),
          0
        );
      });
    } else {
      // Generate text shapes
      const shapes = this.font.generateShapes(text, this.fontSize);

      // Compute xMid
      const geometry = new ShapeBufferGeometry(shapes);
      geometry.computeBoundingBox();
      const xMid =
        -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
      const yMid =
        -0.5 * (geometry.boundingBox.max.y - geometry.boundingBox.min.y);

      // Text shapes
      shapes.forEach((shape, i) => {
        let geometry;

        if (1) {
          geometry = new ShapeBufferGeometry(shape);
        } else {
          // Geometry reshape
          const extrudeSettings = {
            steps: 2,
            depth: 0.1,

            bevelEnabled: false,
            bevelThickness: 1,
            bevelSize: 1,
            bevelOffset: 0,
            bevelSegments: 1,
          };

          geometry = new ExtrudeGeometry(shape, extrudeSettings);
        }

        // Shift letter to position whole text into center
        geometry.translate(xMid, yMid, 0);

        // Separate material for animation
        const material = new MeshBasicMaterial({
          color: this.color,
          transparent: true,
        });

        const mesh = new Mesh(geometry, material);

        // mesh.position.x = this.basePosition;
        // this.basePosition += geometry.boundingBox.max.x + letterSpacing;
        this.add(mesh);
      });
    }
  }
}
