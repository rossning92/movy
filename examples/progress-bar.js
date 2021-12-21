import * as mo from "movy";

const text = "loading...";
const duration = 4;

const progressBar = mo.addGroup();
progressBar.addRectOutline({
  width: 10,
  z: 0.1,
  lineWidth: 0.08,
});
progressBar.addRect({ sx: 10, color: "#44abda" }).wipeIn({
  dir: "right",
  duration,
});
progressBar.addText(text, { scale: 0.5 });
