const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

// Read and encode favicon for inline use
const faviconSvg = fs.readFileSync('./public/favicon.svg', 'utf8')
  .replace(/\s*<!--[\s\S]*?-->\s*/g, '') // Remove comments
  .replace(/\s+/g, ' ') // Collapse whitespace
  .trim();
const faviconDataUri = 'data:image/svg+xml,' + encodeURIComponent(faviconSvg);

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist-offline'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: 'asset/inline',
      },
    ],
  },
  resolve: { 
    extensions: ['.js', '.jsx'],
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      vm: require.resolve('vm-browserify'),
      path: false,
      fs: false
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      inject: 'body',
      faviconDataUri: faviconDataUri,
      csp: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none';",
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
      }
    }),
    new HtmlInlineScriptPlugin()
  ],
  mode: 'production',
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: true,
    concatenateModules: true,
    providedExports: true,
  }
};
