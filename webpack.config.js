const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const examples = (() => {
  const out = [];
  const root = path.resolve(__dirname, 'src');
  (function getExamples(d) {
    fs.readdirSync(`${root}/${d}`).forEach((file) => {
      const filePath = `${d}/${file}`;
      if (file.endsWith('.js')) {
        out.push(filePath);
      } else if (fs.statSync(`${root}/${filePath}`).isDirectory()) {
        getExamples(`${filePath}`);
      }
    });
  })('examples');
  return out;
})();

function generateConfig({ name, entry, plugins = [], outputModule = false } = {}) {
  return {
    entry,
    resolve: {
      extensions: ['.js', '.ts', '.json'],
      fallback: {
        fs: false, // workaround for ccapture.js referencing fs module
      },
    },
    plugins,
    experiments: {
      outputModule,
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: `${name}.js`,
      library: {
        type: outputModule ? 'module' : 'umd',
      },
      umdNamedDefine: true,
      publicPath: '/',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
            },
          },
        },
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
  };
}

module.exports = [
  generateConfig({ name: 'movy', entry: './src/movy.ts', outputModule: true }),
  generateConfig({
    name: 'editor',
    entry: './src/editor.jsx',
    plugins: [
      new webpack.DefinePlugin({
        examples: JSON.stringify(examples),
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'node_modules/mathjax/es5',
            to: 'mathjax',
            info: { minimized: true },
          },
          {
            from: 'assets',
            info: { minimized: true },
          },
          {
            from: 'src/examples',
            to: 'examples',
            info: { minimized: true },
          },
        ],
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'editor.html'),
      }),
    ],
  }),
];
