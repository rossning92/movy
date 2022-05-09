const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

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
      new CopyPlugin({
        patterns: [
          {
            from: 'node_modules/mathjax/es5',
            to: 'mathjax',
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
