const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const fs = require("fs");

const plugins = [];

// Setup HtmlWebpackPlugin for all found entries. Automatically search all
// files under `./examples` folder and add them as webpack entries.
const entries = {};

function addEntry(file) {
  const name = path.basename(file, ".js");
  entries[name] = file;

  plugins.push(
    new HtmlWebpackPlugin({
      filename: name + ".html",
      template: path.resolve(__dirname, "player.html"),
      chunks: [name],
      title: name,
    })
  );
}

module.exports = (env) => {
  let openPage = undefined;
  const contentBase = [
    path.resolve(__dirname, "examples"),
    path.resolve(__dirname, "node_modules/ccapture.js/build"),
  ];

  if (env && env.file) {
    addEntry(env.file);
    openPage = path.basename(env.file, ".js") + ".html";
    contentBase.push(path.dirname(env.file));
  } else {
    // The folder that contains source code and resource files (images, videos,
    // etc.)
    const entryFolders = [path.resolve(__dirname, "examples")];
    entryFolders.forEach((dir) => {
      fs.readdirSync(dir).forEach((file) => {
        if (path.extname(file).toLowerCase() !== ".js") {
          return;
        }

        const fullPath = path.join(dir, file);
        addEntry(fullPath);
      });
    });
  }

  plugins.push(
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: path.resolve(__dirname, "index.html"),
      chunks: [],
      movySceneNames: Object.keys(entries),
    })
  );

  return {
    entry: entries,
    plugins: plugins,
    mode: "development",
    resolve: {
      modules: [
        path.resolve(__dirname, "src"),
        path.resolve(__dirname, "node_modules"),
        "node_modules",
      ],
      extensions: [".js", ".ts", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: path.resolve(__dirname, "node_modules/ts-loader"),
          exclude: /node_modules/,
        },
      ],
    },
    devServer: {
      compress: true,
      contentBase,
      open: true,
      openPage,
      stats: "minimal",
    },
  };
};
