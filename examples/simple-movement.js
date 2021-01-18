import * as mo from "movy";

mo.addText("Hello")
  .moveTo({ x: 2 })
  .moveTo({ y: 2 })
  .moveTo({ x: 0 })
  .moveTo({ y: 0 });

mo.run();
