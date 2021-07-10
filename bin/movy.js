#!/usr/bin/env node

const WebpackDevServer = require("webpack-dev-server");
const webpack = require("webpack");
const process = require("process");
const path = require("path");
const argv = require("minimist")(process.argv.slice(2));
const fs = require("fs");

const file = argv["_"].length > 0 ? path.resolve(argv["_"][0]) : undefined;

if (file) {
  // Automatically create a boilerplate file if not exists.
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      `import * as mo from "movy";
  
mo.addText("Hello, Movy!", {
  scale: 0.8,
  color: "yellow",
}).grow();

mo.run();`
    );
  }

  // Create jsconfig.json for vscode IntelliSense.
  const jsconfig = path.resolve(path.dirname(file), "jsconfig.json");
  if (!fs.existsSync(jsconfig)) {
    fs.writeFileSync(
      jsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            module: "commonjs",
            target: "es2016",
            jsx: "preserve",
            baseUrl: path.resolve(__dirname, "..", "src"),
          },
          exclude: ["node_modules", "**/node_modules/*"],
        },
        null,
        2
      )
    );
  }
}

const port = argv["port"] ? Number.parseInt(argv["port"]) : undefined;
const webpackConfig = require("../webpack.config.js")({
  file,
  open: argv["open"],
});

const compiler = webpack(webpackConfig);

const server = new WebpackDevServer(compiler, webpackConfig.devServer);

server.listen(port);
