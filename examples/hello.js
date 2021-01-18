import * as mo from "movy";

const t = mo.addText("编程三分钟", {
  fontSize: 1.5,
  font: "gdh",
});

t.reveal({ duration: 2, direction: "right" });

mo.addGlitch({ t: 1 });
mo.addGlitch({ t: 1.5 });

mo.enableBloom();

mo.run();
