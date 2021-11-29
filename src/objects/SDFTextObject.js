import { Color } from "three";
import { Text } from "troika-three-text";

export default class SDFTextObject extends Text {
  constructor({
    fontSize = 1.0,
    letterSpacing = 0,
    color = new Color(0xffffff),
    font = "en",
    verticalAlign = undefined,
  } = {}) {
    super();

    if (font == "zh") {
      this.font = "fonts/SourceHanSansSC-Regular.subset.otf";
    } else if (font == "en") {
      this.font = "fonts/Roboto-Regular.otf";
    } else if (font == "condensed") {
      this.font = "fonts/RobotoCondensed-Regular.otf";
    } else if (font == "math") {
      this.font = "fonts/LatinModernMath-Regular.otf";
    } else if (font == "code") {
      this.font = "fonts/SourceCodePro-Regular.otf";
    } else if (font == "gdh") {
      this.font = "fonts/zcool-gdh-Regular.subset.ttf";
    } else {
      throw `Invalid font name: ${font}`;
    }

    this.letterSpacing = letterSpacing;
    this.textAlign = "left";
    this.anchorX = "center";
    this.anchorY = "middle";
    this.fontSize = fontSize * 1.37; // to make sure the the text size is comparable to old TextMesh object
    this.color = color;
  }

  async init() {}

  async setText(text) {
    this.text = text;
    return new Promise((resolve) => this.sync(() => resolve()));
  }
}
