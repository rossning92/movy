const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const examples = (() => {
  const base = path.resolve(__dirname, 'src');
  return (function traverse(d) {
    const children = [];
    fs.readdirSync(`${base}/${d}`).forEach((f) => {
      if (f.endsWith('.js')) {
        children.push({ name: f, children: [], path: `${d}/${f}` });
      } else if (fs.statSync(`${base}/${d}/${f}`).isDirectory()) {
        children.push({ name: f, children: traverse(`${d}/${f}`) });
      }
    });
    return children;
  })('examples');
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
    entry: './src/editor.tsx',
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
