const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const process = require('process');

module.exports = {
  mode: 'development',
  entry: './src/movy.ts',
  resolve: {
    extensions: ['.js', '.ts', '.json'],
    fallback: {
      fs: false, // workaround for ccapture.js referencing fs module
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'node_modules/mathjax/es5',
          to: 'mathjax',
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'editor.html'),
    }),
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'movy.js',
    libraryTarget: 'umd',
    umdNamedDefine: true,
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
  devServer: {
    compress: true,
    static: [path.resolve(__dirname, 'dist')].concat(
      process.env.FILE ? [path.dirname(path.resolve(process.env.FILE))] : [],
    ),
    devMiddleware: {
      stats: 'minimal',
    },
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  },
};
