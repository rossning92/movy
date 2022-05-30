import * as mo from 'movy';

mo.addText('Torus', { y: 3.5, scale: 0.5 });

mo.addTorus({ color: 'red', scale: 4 }).spinning({ duration: 5 });
