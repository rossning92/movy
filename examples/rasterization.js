import * as mo from "movy";

const GRID_SIZE = 48;

const group = mo.addGroup({ scale: 9 / GRID_SIZE });

const grid = mo.addGrid({
  gridSize: GRID_SIZE,
  parent: group,
  z: 0.01,
});
grid.wipeIn();

let t = 0.5;
const texels = generateTriangleTexture();
for (let i = GRID_SIZE - 1; i >= 0; i--) {
  for (let j = 0; j < GRID_SIZE; j++) {
    if (texels[(i * GRID_SIZE + j) * 4 + 3] > 150) {
      const pixel = mo.addRect({
        position: [j - GRID_SIZE * 0.5 + 0.5, i - GRID_SIZE * 0.5 + 0.5, 0],
        color: ((i * GRID_SIZE + j) / (GRID_SIZE * GRID_SIZE)) * 256 + 0x02a9f7,
        parent: group,
      });
      pixel.fadeIn({ t });
      t += 0.01;
    }
  }
}

mo.run();

function generateTriangleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");

  // Draw filled triangle on canvas
  ctx.beginPath();
  ctx.moveTo(Math.floor(0.2 * GRID_SIZE), Math.floor(0.4 * GRID_SIZE));
  ctx.lineTo(Math.floor(0.8 * GRID_SIZE), Math.floor(0.95 * GRID_SIZE));
  ctx.lineTo(Math.floor(0.7 * GRID_SIZE), Math.floor(0.05 * GRID_SIZE));
  ctx.fill();

  let data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return data;
}
