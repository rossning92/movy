#!/usr/bin/env node

const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const process = require("process");
const webpack = require("webpack");
const WebpackDevServer = require("webpack-dev-server");

const projectRoot = path.resolve(__dirname, "..");
const argv = require("minimist")(process.argv.slice(2));

const file = argv["_"].length > 0 ? path.resolve(argv["_"][0]) : undefined;
if (file) createExampleFile(file);

const webpackConfig = createWebpackConfig(
  file,
  argv["module-dir"],
  argv["open"]
);
const compiler = webpack(webpackConfig);

const port = argv["port"] ? Number.parseInt(argv["port"]) : undefined;
const server = new WebpackDevServer(
  { ...webpackConfig.devServer, port },
  compiler
);

server.startCallback();

function createExampleFile(file) {
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
            baseUrl: path.resolve(projectRoot, "src"),
          },
          exclude: ["node_modules", "**/node_modules/*"],
        },
        null,
        2
      )
    );
  }
}

function createEntries(file) {
  const plugins = [];

  // Setup HtmlWebpackPlugin for all found entries. Automatically search all
  // files under `./examples` folder and add them as webpack entries.
  const entry = {};

  function addEntry(file, html_file) {
    const name = path.parse(file).name;
    entry[name] = file;

    plugins.push(
      new HtmlWebpackPlugin({
        filename: html_file ? html_file : name + ".html",
        template: path.resolve(projectRoot, "player.html"),
        chunks: [name],
        title: name,
      })
    );
  }

  if (file) {
    addEntry(file, "index.html");
  } else {
    // The folder that contains source code and resource files (images, videos,
    // etc.)
    const entryFolders = [path.resolve(projectRoot, "examples")];
    entryFolders.forEach((dir) => {
      fs.readdirSync(dir).forEach((file) => {
        if (path.extname(file).toLowerCase() !== ".js") {
          return;
        }

        const fullPath = path.join(dir, file);
        addEntry(fullPath);
      });
    });

    plugins.push(
      new HtmlWebpackPlugin({
        filename: "index.html",
        template: path.resolve(projectRoot, "index.html"),
        chunks: [],
        movySceneNames: Object.keys(entry),
      })
    );
  }

  return {
    plugins,
    entry,
  };
}

function createWebpackConfig(file, moduleDir, open = true) {
  const contentBase = [
    path.resolve(projectRoot, "dist"),
    path.resolve(projectRoot, "examples"),
    path.resolve(projectRoot, "node_modules/ccapture.js/build"),
    path.resolve(projectRoot, "node_modules/mathjax/es5"),
  ];
  if (file) {
    contentBase.push(path.join(path.dirname(file), path.parse(file).name));
    contentBase.push(path.dirname(file));
  }

  const modules = [
    path.resolve(projectRoot, "src"),
    path.resolve(projectRoot, "node_modules"),
    "node_modules",
  ];
  if (moduleDir !== undefined) {
    modules.push(moduleDir);
  }

  return {
    ...createEntries(file),
    mode: "development",
    resolve: {
      modules,
      extensions: [".js", ".ts", ".json"],
      fallback: {
        fs: false,
      },
    },
    resolveLoader: {
      modules: [path.resolve(projectRoot, "node_modules")],
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(projectRoot, "tsconfig.json"),
              transpileOnly: true,
            },
          },
        },
      ],
    },
    devServer: {
      compress: true,
      static: contentBase,
      open: open,
      devMiddleware: {
        stats: "minimal",
      },
    },
    optimization: {
      runtimeChunk: true,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    },
  };
}
