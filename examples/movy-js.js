import * as mo from "movy";

const TEXT1_POS = [-1, 0];
const TEXT2_POS = [3, 0.15];
const DOT_POS = [2, -0.6];

mo.enableBloom();
mo.enableMotionBlur();

const g = mo.addGroup();
const r1 = mo.addCircle({
  scale: 0.1,
  position: [-10, -5],
  parent: g,
  color: "yellow",
});
const r2 = mo.addCircle({
  scale: 0.1,
  position: [10, 5],
  parent: g,
});

r1.moveTo({
  position: [0, 0],
  t: 0.5,
  scale: 1.5,
  ease: "elastic.out(1, 0.75)",
});
r2.moveTo({
  position: [0.1, 0.1, -0.1],
  t: 0.5,
  scale: 1.5,
  ease: "elastic.out(1, 0.75)",
});

g.shake2D({ t: 0.6 });

addParticle({ parent: g, t: 0.5 });

r1.changeOpacity({ opacity: 0.3, t: 2 });
r2.fadeOut({ t: 2 });

r1.moveTo({
  position: TEXT1_POS.concat([-0.1]),
  ease: "expo.in",
  t: 2,
  duration: 0.4,
  scale: 4,
});
mo.addText("movy", { fontSize: 1.5, position: TEXT1_POS }).grow2({ t: "<0.4" });

r1.moveTo({
  position: TEXT2_POS.concat([-0.1]),
  ease: "expo.in",
  t: 2.4,
  duration: 0.4,
});
mo.addText("js", { fontSize: 1.5, position: TEXT2_POS, color: "yellow" }).grow2({
  t: "<0.4",
});

r1.moveTo({ position: DOT_POS, scale: 0.3 });
r1.changeOpacity({ t: "<", opacity: 1 });

mo.addGlitch({ t: 3.2 });
mo.addGlitch({ t: 3.7 });

mo.pause(1);

mo.run();

function addParticle({ position, t }) {
  const particleGroup = mo.addGroup({ scale: 0.5, position });
  for (let i = 0; i < 3; i++) {
    mo.addRectOutline({ parent: particleGroup, opacity: 0.7, scale: 0.8 });
    mo.addTriangleOutline({ parent: particleGroup, opacity: 0.7, scale: 0.8 });
    mo.addCircleOutline({ parent: particleGroup, opacity: 0.7, scale: 0.8 });
  }
  particleGroup.explode2D({ t });
  particleGroup.fadeOut({ t: "1.5", duration: 1 });
}
