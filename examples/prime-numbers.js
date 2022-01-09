import * as mo from "movy";

const gridSize = [21, 12];

const group = mo.addGroup({
  scale: 0.75,
});

let num = 1;
for (let i = 1; i < gridSize[1]; i++) {
  for (let j = 1; j < gridSize[0]; j++) {
    const prime = isPrime(num);
    const pos = [-gridSize[0] * 0.5 + j, gridSize[1] * 0.5 - i];

    group.addText(num.toString(), {
      position: pos.concat([0.02]),
      scale: 0.35,
      font: "math",
      color: prime ? "black" : "white",
    });

    group.addRectOutline({ position: pos, lineWidth: 0.05 });

    if (prime) {
      group
        .addRect({
          position: [pos[0], pos[1], -0.1],
          color: "#EDCF23",
        })
        .grow2({
          t: "<0.1",
        });
    }

    num++;
  }
}

function isPrime(num) {
  for (let i = 2, s = Math.sqrt(num); i <= s; i++)
    if (num % i === 0) return false;
  return num > 1;
}
