import * as mo from 'movy';

mo.addMarker();
const near = 1.5;
const P = [5, 3];
const Pp = [near, (P[1] * near) / P[0]];
const textScale = 0.3;
const textMargin = textScale * 1.2;

// define points
const points = new Map();
points.set('A', [0, 0]);
points.set("P'", Pp);
points.set('B', [near, 0]);
points.set('P', [P[0], P[1]]);
points.set('C', [P[0], 0]);

const g = mo.addGroup({
  scale: 1.25,
  y: -1.5,
  rx: 20,
  ry: 45,
  // scale: 2,
  // position: [-p[0] * 0.5 * 2, -p[1] * 0.5 * 2],
});
g.add3DModel('model/camera.obj', {
  scale: 1.2,
  x: -0.8,
  color: 'lightblue',
}).grow2({ t: '<0.2' });

g.add3DModel('model/tree.obj', {
  color: '#42692f',
  position: [P[0], P[1] * 0.5, 0],
  scale: P[1],
}).rotateIn({ axis: 'y', t: '<0.2', duration: 1.5 });
const projectionPlane = g
  .addRect({
    sx: 2.5,
    sy: 2.5,
    sz: 0.1,
    ry: 90,
    position: [near, 2.5 * 0.1, 0],
    opacity: 0.1,
  })
  .fadeIn({ ease: 'linear', t: '<1' });
g.addAxes3D({ ry: -90, zRange: [-6, 4] }).fadeIn({
  t: '<',
  ease: 'linear',
  t: '<0.2',
});

// Project P to P'
addLetter('P');
g.addLine(P, [0, 0, 0], { lineWidth: 0.04 }).drawLine();
addLetter("P'");

g.add3DModel('model/tree.obj', {
  color: '#42692f',
  position: [Pp[0], Pp[1] * 0.5, 0],
  sx: 0.5,
  sy: Pp[1],
  sz: Pp[1],
}).grow({ t: '<0.2', ease: 'power4.out' });

// Zoom in
mo.pause(0);
mo.addMarker();
g.moveTo({
  x: -2,
  y: -2,
  duration: 3,
  rx: 0,
  ry: 0,
  rz: 0,
  scale: 1.5,
  ease: 'power1.inOut',
});

// Show similar triangles
mo.addMarker();
const triOutline = g
  .addPolygonOutline([points.get('A'), points.get('B'), points.get("P'")], {
    z: 5,
    lineWidth: 0.1,
  })
  .drawLine()
  .moveVert(1, points.get('C'), { t: '<1', duration: 1 })
  .moveVert(2, points.get('P'), { t: '<', duration: 1 });

// Show A/B/C
mo.addMarker();
triOutline.fadeOut();
['A', 'B', 'C'].forEach((letter) => {
  addLetter(letter, '<', 5);
});
// BP' / CP
const formula = mo.addGroup({ scale: 0.4, x: -5, y: 2 });
const t = formula.addTex("\\frac{\\yellow{BP'}}{\\yellow{CP}}").fadeIn();
const BPp = g
  .addLine(points.get('B'), points.get("P'"), {
    lineWidth: 0.05,
    color: 'yellow',
    z: 1,
  })
  .drawLine({
    t: '<',
  });
const CP = g
  .addLine(points.get('C'), points.get('P'), {
    lineWidth: 0.05,
    color: 'yellow',
    z: 1,
  })
  .drawLine({
    t: '<',
  });

// = AB' / AC
t.transformTexTo("\\frac{\\yellow{BP'}}{\\yellow{CP}}=\\frac{\\red{AB}}{\\red{AC}}", { t: '<1' });
const AB = g
  .addLine(points.get('A'), points.get('B'), {
    lineWidth: 0.05,
    color: 'red',
    y: 0.05,
    z: 1,
  })
  .drawLine({
    t: '<',
    duration: 1,
  });
const AC = g
  .addLine(points.get('A'), points.get('C'), {
    lineWidth: 0.05,
    color: 'red',
    y: -0.05,
    z: 1,
  })
  .drawLine({
    t: '<',
    duration: 1,
  });

mo.addMarker();
// Fadeout highlights
BPp.fadeOut();
CP.fadeOut({ t: '<' });
AB.fadeOut({ t: '<' });
AC.fadeOut({ t: '<' });

// BP' => y'
t.transformTexTo("\\frac{\\yellow{y'}}{\\yellow{CP}}=\\frac{\\red{AB}}{\\red{AC}}", {
  t: '<1',
});
g.addTex("←y'→", {
  position: [near + 0.1, Pp[1] * 0.5, 1],
  scale: 0.17,
  rz: 90,
  color: 'yellow',
}).grow({ t: '<' });

mo.addMarker();
// CP => y'
t.transformTexTo("\\frac{\\yellow{y'}}{\\yellow{y}}=\\frac{\\red{AB}}{\\red{AC}}", { t: '<1' });
g.addTex(String.raw`\longleftarrow \>\>\>\> y \>\>\>\>  \longrightarrow`, {
  position: [P[0] + 0.1, P[1] * 0.5, 1],
  scale: textScale,
  rz: 90,
  color: 'yellow',
}).grow({ t: '<' });

mo.addMarker();
// AB => n
t.transformTexTo("\\frac{\\yellow{y'}}{\\yellow{y}}=\\frac{\\red{n}}{\\red{AC}}", {
  t: '<1',
  type: 'crossfade',
});
g.addTex('←n→', {
  position: [near / 2, -0.35],
  color: 'red',
  scale: 0.25,
}).grow({ t: '<' });

mo.addMarker();
// AC => -z
t.transformTexTo("\\frac{\\yellow{y'}}{\\yellow{y}}=-\\frac{\\red{n}}{\\red{z}}", { t: '<1' });
g.addTex('\\longleftarrow\\qquad -z \\qquad\\longrightarrow', {
  position: [P[0] * 0.5, -0.65, 1],
  color: 'red',
  scale: 0.34,
}).grow({ t: '<' });

mo.addMarker();
// move x to right side
t.transformTexTo("\\yellow{y'}=-\\frac{\\red{n}\\cdot \\yellow{y}}{\\red{z}}", {
  t: '<1',
});

mo.addMarker();
mo.addRectOutline({
  x: -5,
  y: 2,
  width: 4,
  height: 2,
  lineWidth: 0.05,
  color: 'red',
}).drawLine({ duration: 1, ease: 'power2.inOut' });

// ------------------------------------------------------------
function addLetter(letter, t, z = 0) {
  let [x, y] = points.get(letter);
  if (y === 0) {
    y -= textMargin;
  } else {
    y += textMargin;
  }
  return g
    .addTex(letter, {
      position: [x, y, z],
      scale: textScale,
      billboarding: true,
    })
    .grow({
      t,
    });
}
