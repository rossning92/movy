import * as mo from 'movy';

const near = 3;
const width = 0.41421356237 * 2 * near;
const height = 0.41421356237 * 2 * near;

mo.addMarker('border');
mo.setDefaultDuration(1);
mo.setDefaultEase('power2.inOut');

mo.add3DModel('model/camera.obj', { z: 1, ry: 90, color: 'lightblue', scale: 1.5 });
const a = mo.addAxes3D({ position: [0, 0, -near], zRange: [-6, 6] });

mo.add3DModel('model/teapot.obj', { z: -6, scale: 5.5, color: 'lightgray' });
const frustum = mo.addFrustum({ near, far: 8 });

mo.cameraMoveTo({ x: 10, y: near, z: 10, lookAt: [0, 0, -near], duration: 2 });

const highlightGroup = mo.addGroup();
highlightGroup
  .addRectOutline({
    z: -near,
    width,
    height,
    lineWidth: 0.05,
    color: 'yellow',
  })
  .drawLine({ t: '>-0.5' });

highlightGroup
  .addTex('l', {
    x: -width * 0.7,
    scale: 0.5,
    color: 'yellow',
    z: -near + 0.1,
    billboarding: true,
  })
  .fadeIn({
    t: '<0.5',
  });
highlightGroup
  .addTex('r', {
    x: width * 0.7,
    scale: 0.5,
    color: 'yellow',
    z: -near + 0.1,
    billboarding: true,
  })
  .fadeIn({
    t: '<0.1',
  });
highlightGroup
  .addTex('b', {
    y: -height * 0.7,
    scale: 0.5,
    color: 'yellow',
    z: -near + 0.1,
    billboarding: true,
  })
  .fadeIn({
    t: '<0.1',
  });
highlightGroup
  .addTex('t', {
    y: height * 0.7,
    scale: 0.5,
    color: 'yellow',
    z: -near + 0.1,
    billboarding: true,
  })
  .fadeIn({
    t: '<0.1',
  });

mo.addMarker('fov');
highlightGroup.fadeOut({ duration: 0.5 });
mo.cameraMoveTo({
  x: 10,
  y: 0,
  z: -near,
  lookAt: [0, 0, -near],
  duration: 1.5,
  t: '<',
});
const grid = mo.addGrid({ rz: 90, gridSize: 50, color: '#303030', scale: 0.5 }).fadeIn({
  t: '<',
});
a.axisZ.grow2({ duration: 1, t: '<1' });

mo.setDefaultDuration(0.5);
const arc = mo
  .addArc(-45 * 0.5, 45 * 0.5, 0.6, {
    x: 10,
    ry: 90,
    lineWidth: 0.025,
    color: 'red',
  })
  .drawLine();
const fovText = mo
  .addText('fov=45', {
    billboarding: true,
    x: 10,
    z: -1.75,
    color: 'red',
    scale: 0.4,
    font: 'math',
  })
  .fadeIn({ t: '<0.25' });

mo.addMarker('fov2');
mo.setDefaultDuration(2);
frustum.changeFov(90);
fovText.changeText((i) => `fov=${Math.round(i)}`, {
  from: 45,
  to: 90,
  t: '<',
});
arc.scaleY(2.3, { t: '<' });

frustum.changeFov(45);
fovText.changeText((i) => `fov=${Math.round(i)}`, {
  from: 90,
  to: 45,
  t: '<',
});
arc.scaleY(1, { t: '<' });

mo.addMarker('calc');
mo.setDefaultDuration(0.5);
arc.fadeOut();
fovText.fadeOut({ t: '<' });

const measureN = mo
  .addTex('\\longleftarrow \\>\\>\\>\\> n \\>\\>\\>\\> \\longrightarrow', {
    billboarding: true,
    z: -near * 0.5,
    y: -0.5,
    scale: 0.3,
    color: 'yellow',
  })
  .grow();
const thinLine = mo.addLine([0, 0.75, 0], [0, -0.75, 0], { color: 'yellow' }).drawLine({
  t: '<0.25',
});

const top = Math.tan((45 * 0.5 * Math.PI) / 180) * near;
const tri = mo
  .addPolygonOutline(
    [
      [0, 0, 0],
      [0, 0, -near],
      [0, top, -near],
    ],
    { lineWidth: 0.05, x: 10, color: 'yellow' }
  )
  .drawLine({ duration: 1, t: '<0.25' });

const arc2 = mo
  .addArc(0, 45 * 0.5, 1, {
    billboarding: true,
    lineWidth: 0.05,
    color: 'yellow',
  })
  .drawLine();
const fovTex = mo
  .addTex('\\frac{fov}{2}', {
    billboarding: true,
    z: -near * 0.5,
    y: 0.25,
    scale: 0.25,
    color: 'yellow',
  })
  .fadeIn({ t: '<0.25' });

mo.addArrow([0, top + 0.6, -near], [0, top, -near], {
  lineWidth: 0.03,
  color: 'yellow',
}).drawLine();

mo.addTex('t=\\tan(\\frac{fov}{2})\\cdot n', {
  billboarding: true,
  z: -near,
  y: top + 1,
  scale: 0.25,
  color: 'yellow',
}).fadeIn({ t: '<0.25' });

tri.fadeOut();
arc2.fadeOut({ t: '<' });
measureN.fadeOut({ t: '<' });
fovTex.fadeOut({ t: '<' });
thinLine.fadeOut({ t: '<' });
grid.fadeOut({ t: '<' });

mo.cameraMoveTo({ x: 10, y: near, z: 10, lookAt: [0, 0, -near], duration: 2 });

mo.addTex('b=-t', {
  billboarding: true,
  z: -near,
  y: -top - 0.5,
  scale: 0.25,
  color: 'yellow',
}).fadeIn({ t: '<0.25' });
mo.addTex('r=-t \\cdot aspect', {
  billboarding: true,
  z: -near,
  x: top + 1.5,
  y: 0.3,
  scale: 0.25,
  color: 'yellow',
}).fadeIn({ t: '<0.25' });
mo.addTex('l=-r', {
  billboarding: true,
  z: -near,
  x: -top,
  y: 0.1,
  scale: 0.25,
  color: 'yellow',
}).fadeIn({ t: '<0.25' });
