import { Color } from "three";

export function toThreeColor(color?: string | number): Color {
  return color === undefined
    ? new Color(0xffffff)
    : new Color(color).convertSRGBToLinear();
}
