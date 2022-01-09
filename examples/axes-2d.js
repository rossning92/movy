import * as mo from "movy";

mo.addAxes2D({ xRange: [-1, 4], yRange: [-1, 4] });
mo.addTex("P(2,2)", { scale: 0.3, position: [2.5, 2.5] });
mo.addArrow([0, 0], [2, 2]);
mo.addCircle({ position: [2, 2], scale: 0.2, color: "red", opacity: 0.8 });

mo.cameraMoveTo({ x: 1.5, y: 1.5, t: 0, zoom: 1.5, duration: 0 });
