import * as mo from "movy";

const gridSize = [21, 12];

mo.enableMotionBlur();

let n = 1;
for (let i = 1; i < gridSize[1]; i++) {
  for (let j = 1; j < gridSize[0]; j++) {
    const prime = isPrime(n);
    const position = [j, -i];

    mo.addText(n.toString(), {
      position: position.concat([0.02]),
      scale: 0.3,
      color: prime ? "black" : "white",
    });

    mo.addRectOutline({ position, lineWidth: 0.03 });

    if (prime) {
      mo.addRect({ position: position.concat([0.01]), color: "#fad390" }).grow2(
        {
          t: "<0.1",
        }
      );
    }

    n++;
  }
}

mo.cameraMoveTo({ position: [3, -3, 5], rx: 0.2, duration: 0, t: 0 });
mo.cameraMoveTo({
  position: [gridSize[0] * 0.5, -gridSize[1] * 0.5, 10],
  rx: 0,
  t: "<",
  duration: 10,
});

mo.run();

function isPrime(num) {
  for (let i = 2, s = Math.sqrt(num); i <= s; i++)
    if (num % i === 0) return false;
  return num > 1;
}
