import * as mo from 'movy';

mo.usePerspectiveCamera();

mo.addText3D('Hello, Movy!', {
  color: 'yellow',
  font: 'math',
}).flyIn();
