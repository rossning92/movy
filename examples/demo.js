import * as mo from "movy";

const SYMBOLS = ".<>?/;\\{}[]()*&^%$#@!";

mo.enableBloom();

const bgRect = mo.addRect({ scale: 100, z: -5, color: "#272727" });

const symbol = mo
  .addText("", { font: "gdh", scale: 2 })
  .changeText(
    (t) => (t >= 1 ? "" : SYMBOLS[Math.floor(t * 100) % (SYMBOLS.length - 1)]),
    {
      duration: 3,
      t: "<",
      ease: "linear",
    }
  );

const icons = addExplodingIcons();
icons.implode2D({ t: ">-0.5" });
symbol.moveTo({ scale: 0.001, t: "<" });

const textParent = mo.addGroup({ scale: 1.5 });
const bracketGroup = textParent.addGroup();
const brackets = bracketGroup.addText("{ }", {
  fontSize: 0.75,
  color: "#ffff00",
  letterSpacing: 0.1,
});
bracketGroup.addText("3", {
  fontSize: 0.75,
  color: "#ffff00",
});
bracketGroup.fadeIn({ t: "<0.4" }).grow3({ t: "<" });
bracketGroup.shake2D({ t: "<", duration: 0.4 });

mo.cameraMoveTo({ z: 6, t: "<", duration: 0.2 });
bgRect
  .changeColor("#eb4d4b", {
    t: "<",
    duration: 0.2,
  })
  .changeColor("#f6e58d", {
    t: ">",
    duration: 0.2,
  })
  .changeColor("#272727", {
    t: ">",
    duration: 0.2,
  });

mo.cameraMoveTo({ z: 8, t: "<", duration: 0.2 });
addFlyingIcons();
textParent
  .addText("编程", {
    font: "gdh",
    x: -10,
  })
  .moveTo({ x: -2, t: "<", ease: "elastic.out(1, 0.2)" });
textParent
  .addText("分钟", {
    font: "gdh",
    x: 10,
  })
  .moveTo({ x: 2, t: "<", ease: "elastic.out(1, 0.2)" });
textParent.shake2D({ t: "<", duration: 0.4 });

mo.addText("奇乐编程学院", {
  font: "gdh",
  fontSize: 0.5,
  letterSpacing: 0.4,
  color: "#efefef",
  position: [0, -3, 0],
}).flyIn({ direction: "down", t: "<0.2" });

mo.addGlitch({ t: "<-0.2" });
mo.addGlitch({ t: "<0.25" });
mo.addGlitch({ t: "<0.75" });
mo.addGlitch({ t: "<1" });

brackets
  .moveTo({ sx: -1, t: 5 })
  .moveTo({ sx: 1, t: ">" })
  .moveTo({ sx: -1, t: ">1" })
  .moveTo({ sx: 1, t: ">" });

bgRect.changeColor("#000000", { t: 1.8, duration: 0.5 });

// ----------------------------------------------------------------------------
// Helper functions

function addIcons({ opacity = 1.0, z = 0 } = {}) {
  const group = mo.addGroup({ z });
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
    group.addImage(image, {
      x: mo.random(-10, 10),
      y: mo.random(-10, 10),
      opacity,
    });
  }
  return group;
}

function addFlyingIcons() {
  return addIcons({ opacity: 0.3, z: -1 })
    .fadeIn({ t: "<" })
    .flying({ t: "<", duration: 15 });
}

function addExplodingIcons() {
  return addIcons({ z: -1 }).explode2D({
    t: "<",
    minScale: 1,
    maxScale: 1.2,
    stagger: 0.05,
    minRadius: 3,
    maxRadius: 6,
    minRotation: -4 * Math.PI,
    maxRotation: 4 * Math.PI,
  });
}
