import * as mo from 'movy';

const fonts = [
  ['en', 'Hello, World!'],
  ['condensed', 'Hello, World!'],
  ['code', 'Hello, World!'],
  ['math', 'Hello, World!'],
  ['arcade', 'Hello, World!'],
  ['zh', '你好，世界！'],
  ['gdh', '你好，世界！'],
];

const textGroup = mo.addGroup({ scale: 1.25 });

let y = 3;
fonts.forEach(([font, text]) => {
  textGroup.addText(text, {
    color: 'yellow',
    font,
    y,
    scale: 0.5,
  });
  y -= 1;
});
