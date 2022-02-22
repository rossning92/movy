import * as mo from 'movy';

const matrix1 = mo.addTex(
  `
    \\begin{bmatrix}
    a & b & c \\\\
    d & e & f \\\\
    g & h & i
    \\end{bmatrix}
    `,
  { scale: 0.5 },
);

const matrix2 = mo.addTex(
  `
  \\begin{bmatrix}
  \\frac{2n}{r-l} & 0 & 0 & 0 \\\\
  0 & \\frac{2n}{t-b} & 0 & 0 \\\\
  0 & 0 & \\frac{2n}{f-n} & 0 \\\\
  0 & 0 & 0 & 1
  \\end{bmatrix}
  `,
  { scale: 0.5 },
);

matrix1.transformTexTo(matrix2, { t: 1 });
