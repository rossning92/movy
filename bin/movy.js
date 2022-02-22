#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');
const liveServer = require('live-server');

function createExampleFile(baseUrl, file) {
  // Automatically create a boilerplate file if not exists.
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      `import * as mo from "movy";
  
mo.addText("Hello, Movy!", {
  scale: 0.8,
  color: "yellow",
}).grow();
`,
    );
  }

  // Create jsconfig.json for vscode IntelliSense.
  const jsconfig = path.resolve(path.dirname(file), 'jsconfig.json');
  if (!fs.existsSync(jsconfig)) {
    fs.writeFileSync(
      jsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            module: 'commonjs',
            target: 'es2016',
            jsx: 'preserve',
            baseUrl,
          },
          exclude: ['node_modules', '**/node_modules/*'],
        },
        null,
        2,
      ),
    );
  }
}

const projectRoot = path.resolve(__dirname, '..');
const argv = require('minimist')(process.argv.slice(2));

const file = argv._.length > 0 ? path.resolve(argv._[0]) : undefined;
if (file) createExampleFile(path.resolve(projectRoot, 'dist'), file);

const port = argv.port ? parseInt(argv.port, 10) : undefined;
let open = argv.open !== undefined ? argv.open : true;
if (open) {
  if (file) {
    open = `/?file=${path.basename(file)}`;
  }
}
const params = {
  port,
  host: '0.0.0.0',
  root: path.resolve(__dirname, '..', 'dist'),
  open,
  mount: file ? [['/', path.dirname(path.resolve(file))]] : undefined,
};
liveServer.start(params);
