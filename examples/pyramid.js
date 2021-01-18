import * as mo from "movy";

mo.addText("四面体", { y: 1, scale: 0.2 });
mo.addPyramid({ color: "#1abc9c" }).rotate({
  duration: 10,
});

mo.cameraMoveTo({
  position: [0, 0, 2],
  lookAt: [0, 0, 0],
  duration: 5,
  t: 0,
});
mo.cameraMoveTo({
  position: [0, 1, 3],
  lookAt: [0, 0, 0],
  duration: 5,
  t: ">",
});

mo.run();
