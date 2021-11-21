const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const fs = require("fs");

const plugins = [];

// Setup HtmlWebpackPlugin for all found entries. Automatically search all
// files under `./examples` folder and add them as webpack entries.
const entries = {};

function addEntry(file, html_file) {
  const name = path.parse(file).name;
  entries[name] = file;

  plugins.push(
    new HtmlWebpackPlugin({
      filename: html_file ? html_file : name + ".html",
      template: path.resolve(__dirname, "player.html"),
      chunks: [name],
      title: name,
    })
  );
}

module.exports = ({ file, moduleDir, open = true } = {}) => {
  const contentBase = [
    path.resolve(__dirname, "dist"),
    path.resolve(__dirname, "examples"),
    path.resolve(__dirname, "node_modules/ccapture.js/build"),
    path.resolve(__dirname, "node_modules/mathjax/es5"),
  ];

  if (file) {
    addEntry(file, "index.html");
    contentBase.push(path.join(path.dirname(file), path.parse(file).name));
    contentBase.push(path.dirname(file));
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

    plugins.push(
      new HtmlWebpackPlugin({
        filename: "index.html",
        template: path.resolve(__dirname, "index.html"),
        chunks: [],
        movySceneNames: Object.keys(entries),
      })
    );
  }

  const modules = [
    "./",
    path.resolve(__dirname, "src"),
    path.resolve(__dirname, "node_modules"),
    "node_modules",
    "module",
  ];
  if (moduleDir !== undefined) {
    modules.push(moduleDir);
  }

  return {
    entry: entries,
    plugins: plugins,
    mode: "development",
    resolve: {
      modules: modules,
      extensions: [".js", ".ts", ".json"],
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
              configFile: path.resolve(__dirname, "tsconfig.json"),
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
};
