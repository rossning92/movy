#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');
const liveServer = require('live-server');

function createExampleFile(baseUrl, file, contentPath) {
  // Automatically create a boilerplate file if not exists.
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      `import * as mo from "movy";

mo.addText("Hello, Movy!", {
  scale: 0.8,
  color: "yellow",
}).grow();
`
    );
  }

  // Create jsconfig.json for vscode IntelliSense.
  const jsconfig = path.resolve(path.dirname(file), 'jsconfig.json');
  if (!fs.existsSync(jsconfig)) {
    const paths = [`${baseUrl}/*`];
    if (contentPath) paths.push(`${contentPath}/*`);
    const include = ['*.js', `${baseUrl}/*`];
    if (contentPath) include.push(`${contentPath}/*`);

    fs.writeFileSync(
      jsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            module: 'es6',
            target: 'es2016',
            jsx: 'preserve',
            baseUrl: '.',
            paths: {
              '*': paths,
            },
          },
          include,
          exclude: ['node_modules', '**/node_modules/*'],
        },
        null,
        2
      )
    );
  }
}

const projectRoot = path.resolve(__dirname, '..');
const argv = require('minimist')(process.argv.slice(2));

const file = argv._.length > 0 ? path.resolve(argv._[0]) : undefined;
const distPath = path.resolve(projectRoot, 'dist');
if (file) createExampleFile(distPath, file, argv.content);

const port = argv.port ? parseInt(argv.port, 10) : undefined;
let open = argv.open !== undefined ? argv.open : true;
if (open) {
  if (file) {
    open = `/?file=${path.basename(file)}`;
  }
}

let mount;
if (file) {
  mount = [['/', path.dirname(path.resolve(file))]];
  if (argv.content) {
    mount.push(['/', path.resolve(argv.content)]);
  }
}
const params = {
  port,
  host: '0.0.0.0',
  root: path.resolve(__dirname, '..', 'dist'),
  open,
  mount,
  ignore: argv.hot === false ? '**' : undefined,
};

liveServer.start(params);
