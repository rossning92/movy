import * as mo from "movy";

const rainbowPalette = [
  "#9C4F96",
  "#FF6355",
  "#FBA949",
  "#FAE442",
  "#8BD448",
  "#2AA8F2",
];
const N = 6;
const d = 4;

const positions = [];
const users = [];
const keys = [];
const lines = [];

for (let n = 2; n <= N; n++) {
  positions.length = 0;

  // fade out keys
  for (const key of keys) {
    key.fadeOut({ t: "<" });
  }
  keys.length = 0;

  // fade out lines
  for (const line of lines) {
    line.fadeOut({ t: "<" });
  }
  lines.length = 0;

  const beginAngle = Math.PI / n - Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + beginAngle;

    positions.push({
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d,
      z: -0.01,
    });
  }

  positions.forEach((pos, i) => {
    if (i >= users.length) {
      const user = mo.addImage("images/user.png", {
        x: pos.x,
        y: pos.y,
        scale: 1.2,

        t: "<",
      });
      user.grow2({ t: "<" });
      users.push(user);
    } else {
      users[i].moveTo({ x: pos.x, y: pos.y, t: "<" });
    }
  });

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const line = mo.addLine({
        from: positions[i],
        to: positions[j],
        lineWidth: 0.04,
        color: "#9f9f9f",
      });
      line.fadeIn({ t: "<" });
      lines.push(line);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (const pos of positions) {
      const key = mo.addImage("images/key.svg", {
        x: pos.x + 1 + i * 0.35,
        y: pos.y + 0.5,
        scale: 0.6,
        color: rainbowPalette[i],
        ccw: false,
      });
      key.fadeIn({ t: "<0.05" });
      keys.push(key);
    }
  }

  mo.pause(1);
}

mo.run();
