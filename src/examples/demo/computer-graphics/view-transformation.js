import * as mo from "movy";

mo.setDefaultDuration(1);
mo.setDefaultEase("power2.inOut");

const n = 2;
const f = 10;
const P = [
  [n, 0, 0, 0],
  [0, n, 0, 0],
  [0, 0, -(f + n) / (f - n), -(2 * f * n) / (f - n)],
  [0, 0, -1, 0],
];

const teapotGroup = mo.addGroup();
teapotGroup.setClipRect({ width: 9.5, height: 9.5 });
teapotGroup.addAxes3D();

const teapot = teapotGroup
  .add3DModel("teapot.obj", {
    wireframe: true,
    pointSize: 0.01,
    autoResize: false,
    sx: 2,
    sy: 2,
    sz: -1,
  })
  .getVerts((verts) => {
    // Update verts
    verts.forEach((v) => {
      v[1] -= 1.25;
      v[2] -= 4;
    });

    const verts2 = [];
    verts.forEach((v) => {
      const pt1 = [[v[0]], [v[1]], [v[2]], [1]];
      const pt2 = matMult(P, pt1);
      const x1 = pt2[0] / pt2[3];
      const y1 = pt2[1] / pt2[3];
      const z1 = pt2[2] / pt2[3];
      verts2.push([x1, y1, z1]);
    });

    teapot.addGrid({ scale: 0.5, gridSize: 40, color: "#606060" });

    mo.addMarker("show");
    teapot.moveVerts(verts2, { duration: 0 });
    mo.pause(0.5);
    // teapot.wipeIn();

    teapotGroup
      .addRectOutline({
        width: 2 * 2,
        height: 2 * 2,
        z: 10,
        color: "yellow",
        lineWidth: 0.03,
      })
      .drawLine({ duration: 1 });
    teapotGroup
      .addTex("-1", { x: -2, z: 10, scale: 0.3, color: "yellow" })
      .fadeIn({ t: "<0.5" });
    teapotGroup
      .addTex("1", { x: 2, z: 10, scale: 0.3, color: "yellow" })
      .fadeIn({ t: "<0.1" });
    teapotGroup
      .addTex("-1", { y: -2, z: 10, scale: 0.3, color: "yellow" })
      .fadeIn({ t: "<0.1" });
    teapotGroup
      .addTex("1", { y: 2, z: 10, scale: 0.3, color: "yellow" })
      .fadeIn({ t: "<0.1" });

    mo.addMarker("screen");
    teapotGroup.moveTo({ x: -4 });
    const screenGroup = mo.addGroup({ x: 4 });
    screenGroup.addImage("images/monitor.png", { scale: 5, z: -10 }).grow({
      duration: 1,
      t: "<",
      ease: "power2.inOut",
    });
    const tmp = mo
      .addGroup({
        z: 10,
        x: -4,
      })
      .show()
      .moveTo({ x: 4, y: 0.42, sx: 1.5, sy: 0.95 });

    const yellowBorder = tmp.addRectOutline({
      color: "yellow",
      width: 4,
      height: 4,
      lineWidth: 0.03,
    });

    const screenInner = screenGroup.addGroup({
      y: 0.42,
      sx: 1.5,
      sy: 0.95,
    });
    screenInner.setClipRect({ width: 4, height: 4 });
    const teapot2 = screenInner.add3DModel("teapot.obj", {
      wireframe: true,
      pointSize: 0.01,
      autoResize: false,
      sx: 2,
      sy: 2,
      sz: -1,
    });
    teapot2.moveVerts(verts2, { duration: 0 });
    yellowBorder.fadeOut({ duration: 0.5, ease: "power2.out" });
    teapot2.fadeIn({ duration: 1, ease: "power2.in", t: "<" });

    mo.addMarker("scale");
    mo.setDefaultDuration(2);
    teapot.scaleX(1);
    teapot.scaleY(1.5, { t: "<" });
    teapot2.scaleX(1, { t: "<" });
    teapot2.scaleY(1.5, { t: "<" });
    teapot.scaleX(2);
    teapot.scaleY(2, { t: "<" });
    teapot2.scaleX(2, { t: "<" });
    teapot2.scaleY(2, { t: "<" });

    mo.addMarker("zoom");
    teapot
      .addRect({
        color: "#303030",
        width: 4,
        height: 4 / 1.5,
        lineWidth: 0.1,
        z: 10,
      })
      .fadeIn();

    mo.setDefaultDuration(3);
    teapot.scaleX(1);
    teapot.scaleY(1.5, { t: "<" });
    teapot2.scaleX(1, { t: "<" });
    teapot2.scaleY(1.5, { t: "<" });

    mo.addMarker("tblr");
    mo.setDefaultDuration(0.5);
    teapot.scaleX(2);
    teapot.scaleY(2, { t: "<" });
    teapot2.scaleX(2, { t: "<" });
    teapot2.scaleY(2, { t: "<" });

    teapotGroup
      .addRectOutline({
        width: 4 * 2,
        height: 2.667 * 2,
        z: 10,
        color: "red",
        lineWidth: 0.03,
      })
      .drawLine({ duration: 1 });
    teapotGroup
      .addTex("l", { x: -4, z: 10, scale: 0.4, color: "red" })
      .fadeIn({ t: "<0.5" });
    teapotGroup
      .addTex("r", { x: 4, z: 10, scale: 0.4, color: "red" })
      .fadeIn({ t: "<0.1" });
    teapotGroup
      .addTex("b", { y: -2.667, z: 10, scale: 0.4, color: "red" })
      .fadeIn({ t: "<0.1" });
    teapotGroup
      .addTex("t", { y: 2.667, z: 10, scale: 0.4, color: "red" })
      .fadeIn({ t: "<0.1" });

    mo.addMarker("mat");
    screenGroup.fadeOut();
    const mat = mo
      .addTex(
        String.raw`
        \begin{bmatrix}
        \frac{2}{r-l} &  & \frac{r+l}{r-l} &  \\
         & \frac{2}{t-b} & \frac{t+b}{t-b} & \\
         &  & 1 &  \\
         &  &  & 1
        \end{bmatrix}`,
        { scale: 0.35, x: 4.5 }
      )
      .fadeIn({ t: "<0.2", duration: 1 });
    mo.setDefaultDuration(2);
    teapot.scaleX(1);
    teapot.scaleY(1.5, { t: "<" });
    teapot2.scaleX(1, { t: "<" });
    teapot2.scaleY(1.5, { t: "<" });

    mo.addMarker("mat2");
    mat.transformTexTo(
      String.raw`
        \begin{bmatrix}
        \frac{2n}{r-l} &  & \frac{r+l}{r-l} & \\
         & \frac{2n}{t-b} & \frac{t+b}{t-b} & \\
         &  & -\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\
         &  & -1 &
        \end{bmatrix}`,
      { duration: 2 }
    );
  });

function matMult(a, b) {
  const c = [];
  for (let i = 0; i < a.length; i++) {
    c[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < a[0].length; k++) {
        sum += a[i][k] * b[k][j];
      }
      c[i][j] = sum;
    }
  }
  return c;
}
