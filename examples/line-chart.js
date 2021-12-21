import * as mo from "movy";

// Generate fake data
const data = [];
for (let i = 0; i < 50; i++) {
  data.push([1990 + i, (mo.random(-0.2, 0.2) + Math.sin(i / 5)) * 10 + 10]);
}

addLineChart({
  data,
  labelX: "Time",
  labelY: "Stock Price",
  tickIntervalX: 5,
  tickIntervalY: 2,
});

// ---------------------------------------
// Helper function to create a line chart.
// ---------------------------------------
function addLineChart({
  data,
  sizeX = 10,
  sizeY = 6,
  tickIntervalX = 5,
  tickIntervalY = 5,
  labelX = "Label X",
  labelY = "Label Y",
} = {}) {
  const xMin = Math.min(...data.map((v) => v[0]));
  const xMax = Math.max(...data.map((v) => v[0]));
  const yMin = Math.min(...data.map((v) => v[1]));
  const yMax = Math.max(...data.map((v) => v[1]));
  const transform = (point) => {
    return [
      ((point[0] - xMin) / (xMax - xMin)) * sizeX,
      ((point[1] - yMin) / (yMax - yMin)) * sizeY,
    ];
  };

  mo.cameraMoveTo({ x: sizeX / 2, y: sizeY / 2, z: 10, duration: 0 });
  mo.cameraMoveTo({ z: 8, t: "<", duration: 2 });

  // X ticks
  const numTicksX = Math.floor((xMax - xMin) / tickIntervalX);
  for (let i = 1; i <= numTicksX; i++) {
    const x = xMin + i * tickIntervalX;
    const tickX = transform([x, 0])[0];

    mo.addText(`${x}`, { x: tickX, y: -0.2, scale: 0.2 }).fadeIn({ t: "<" });
    mo.addLine({ from: [tickX, 0], to: [tickX, 0.1], lineWidth: 0.05 }).reveal({
      t: "<",
      direction: "down",
    });
  }

  // Y ticks
  const numTicksY = Math.floor((yMax - yMin) / tickIntervalY);
  for (let i = 1; i <= numTicksY; i++) {
    const y = yMin + i * tickIntervalY;
    const tickY = transform([0, y])[1];

    mo.addLine({ from: [0, tickY], to: [0.1, tickY], lineWidth: 0.05 }).fadeIn({
      t: "<",
    });
    mo.addText(`${y.toFixed(2)}`, { x: -0.5, y: tickY, scale: 0.2 }).reveal({
      t: "<",
      direction: "left",
    });
  }

  mo.addArrow({ from: [0, 0, 0], to: [sizeX * 1.1, 0, 0] }).grow2({ t: "<" });
  mo.addArrow({ from: [0, 0, 0], to: [0, sizeY * 1.1, 0] }).grow2({
    t: "<0.1",
  });
  mo.addText(labelX, { scale: 0.3, x: sizeX / 2, y: -0.75 }).reveal({
    direction: "down",
    t: "<0.1",
  });
  mo.addText(labelY, {
    scale: 0.3,
    y: sizeY / 2,
    x: -1.5,
    rz: Math.PI / 2,
  }).reveal({
    direction: "left",
    t: "<0.1",
  });

  for (let i = 0; i < data.length - 1; i++) {
    mo.addLine(transform(data[i]), transform(data[i + 1]), {
      lineWidth: 0.05,
      color: "green",
    }).fadeIn({
      t: "<0.05",
    });
  }
}
