import * as mo from "movy";

mo.enableBloom();

const t1 = mo.addText("编程", { font: "gdh", fontSize: 1.5, x: -3 });
t1.reveal({ direction: "left" });

const t2 = mo.addText("三分钟", { font: "gdh", fontSize: 1.5, x: 2 });
t2.reveal({ direction: "right" });

mo.addGlitch({ t: 1 });
mo.addGlitch({ t: 1.5 });

mo.run();
