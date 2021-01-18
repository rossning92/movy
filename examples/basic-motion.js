import * as mo from "movy";

mo.enableMotionBlur();

mo.addText("缓出 (expo.out)", { x: -6, y: -2, fontSize: 0.3 });
mo.addImage("images/black-moon.png", { x: -3, y: -2, scale: 2 }).moveTo({
  x: 5,
  rz: -Math.PI * 4,
  duration: 2,
  ease: "expo.out",
  t: 0,
});

mo.addText("线性运动", { x: -6, y: 2, fontSize: 0.3 });
mo.addImage("images/black-moon.png", { x: -3, y: 2, scale: 2 }).moveTo({
  x: 5,
  rz: -Math.PI * 4,
  duration: 1,
  ease: "linear",
  t: 0,
});

mo.pause(1);

mo.run();
