import * as mo from "movy";

mo.addText('ease: "expo.out"', { x: -6, y: -2, fontSize: 0.3 });
mo.addImage("images/black-moon.png", { x: -3, y: -2, scale: 2 }).moveTo({
  x: 5,
  rz: -Math.PI * 4,
  duration: 2,
  ease: "expo.out",
  t: 0,
});

mo.addText('ease: "linear"', { x: -6, y: 2, fontSize: 0.3 });
mo.addImage("images/black-moon.png", { x: -3, y: 2, scale: 2 }).moveTo({
  x: 5,
  rz: -Math.PI * 4,
  duration: 1,
  ease: "linear",
  t: 0,
});

mo.pause(0.5);
