import * as mo from 'movy';

mo.addTex('a=\\frac{8}{4}')
  .transformTexTo('a=\\frac{2}{1}')
  .transformTexTo('a=2');
