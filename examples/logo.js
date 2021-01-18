import * as mo from "movy";

const LOGO_POS = [-3, 1];

mo.enableMotionBlur();
mo.enableBloom();
mo.setBackgroundColor("#272727");

function addIcons({ parent = undefined, opacity = 1.0, z = 0 } = {}) {
  const group = mo.addGroup({ parent, z });
  const images = [
    "lang/c.png",
    "lang/cpp.png",
    "lang/csharp.png",
    "lang/css.png",
    "lang/go.png",
    "lang/haskell.png",
    "lang/html.png",
    "lang/java.png",
    "lang/javascript.png",
    "lang/kotlin.png",
    "lang/lua.png",
    "lang/php.png",
    "lang/python.png",
    "lang/r.png",
    "lang/ruby.png",
    "lang/swift.png",
    "lang/typescript.png",
  ];
  for (const image of images) {
    mo.addImage(image, {
      parent: group,
      opacity,
    });
  }
  return group;
}

const tagGroup = mo.addGroup();

const bracket = mo.addGroup({ scale: 2, parent: tagGroup });
mo.addText("<", { x: -1, y: -0.25, z: 1, sx: 0.6, parent: bracket });
mo.addText(">", { x: 1, y: -0.25, z: 1, sx: 0.6, parent: bracket });
bracket.rotateIn();

// Slash fly-in
const slash = mo.addText("/", {
  position: [-10, 3, 1],
  scale: 2,
  color: "#ffe66d",
  parent: tagGroup,
});
slash.moveTo({ x: 0.1, t: 0.2, ease: "power.in", duration: 0.5 });
mo.cameraMoveTo({ x: 0, y: 2, z: 6, t: "<", lookAt: [0, 0, 0] });

// Explosion
slash.moveTo({ x: 0.1, y: 0.2, ease: "elastic.out(1, 0.2)", t: "+=0.5" });
mo.cameraMoveTo({ x: 0, y: 0, z: 8.66, t: "<", lookAt: [0, 0, 0] });
tagGroup.shake2D({ t: "<0.05" });
const icons = addIcons({ parent: tagGroup });
icons.explode2D({ t: "<", minScale: 1.5, maxScale: 2 });

// Implosion
tagGroup.implode2D({ t: 3.5 });
tagGroup.moveTo({ position: LOGO_POS, t: "<" });

// Show logo
const logoGroup = mo.addGroup({ position: LOGO_POS, scale: 5.1 });
mo.addImage("images/logo-without-triangle.svg", {
  opacity: 0.85,
  parent: logoGroup,
});
const triangle = mo.addTriangleOutline({
  color: "#e63946",
  scale: 0.2875,
  lineWidth: 0.06,
  parent: logoGroup,
  position: [-0.1, 0.175, 0],
});
logoGroup.grow3({ t: 3.75 });

// Flying icons in the background
const flyingIcons = addIcons({ opacity: 0.3, z: -1 });
flyingIcons.fadeIn({ t: "<" });
flyingIcons.flying({ t: "<", duration: 15 });

// Show text
mo.addText("编程", {
  font: "gdh",
  fontSize: 2.32,
  position: [2.7, 1.65, 0],
}).reveal({ t: "<0.5" });

mo.addText("三分钟", {
  font: "gdh",
  fontSize: 1.5,
  position: [2.7, -0.15, 0],
}).reveal({ t: "<0.25", direction: "down" });

mo.addText("奇乐编程学院", {
  font: "gdh",
  fontSize: 0.5,
  letterSpacing: 0.5,
  color: "#efefef",
  position: [0, -3, 0],
}).flyIn({ t: "<" });

mo.addGlitch({ t: "<0.5" });
mo.addGlitch({ t: ">0.5" });

// Rotate red triangle
triangle.moveTo({ rz: (-2 * Math.PI) / 3, t: "5" });
triangle.moveTo({ rz: (-4 * Math.PI) / 3, t: "5.5" });
triangle.moveTo({ rz: (-6 * Math.PI) / 3, t: "7" });
triangle.moveTo({ rz: (-8 * Math.PI) / 3, t: "7.5" });

mo.run();
