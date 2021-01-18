import * as mo from "movy";

const NAME = "symmetric-crypto.js";
const DURATION = 10;

mo.setResolution(700, 60);

const g = mo.addGroup({});
mo.addRectOutline({
  width: 114,
  height: 8.6,
  z: 0.1,
  lineWidth: 0.9,
  parent: g,
});
mo.addRect({ sx: 114, sy: 8.6, color: "#44abda", parent: g }).wipeIn({
  dir: "right",
  duration: DURATION,
  ease: "linear",
});

mo.addText(NAME, { scale: 4, y: 0.8 });

mo.run();
