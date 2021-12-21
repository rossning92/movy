import * as mo from "movy";

mo.addAxes2D();
mo.addTex("P(2,2)", { scale: 0.3, position: [2.5, 2.5] });
mo.addArrow([0, 0], [2, 2]);
mo.addCircle({ position: [2, 2], scale: 0.2, color: "red" });
