const {join, resolve} = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ringUiWebpackConfig = require('@jetbrains/ring-ui/webpack.config');

const pkgConfig = require('./package.json').config;

const componentsPath = join(__dirname, pkgConfig.components);

// Patch @jetbrains/ring-ui svg-sprite-loader config
ringUiWebpackConfig.loaders.svgInlineLoader.include.push(
  require('@jetbrains/logos'),
  require('@jetbrains/icons')
);

const webpackConfig = () => ({
  entry: `${componentsPath}/app/app.js`,
  resolve: {
    mainFields: ['module', 'browser', 'main'],
    alias: {
      react: resolve('./node_modules/react'),
      'react-dom': resolve('./node_modules/react-dom'),
      '@jetbrains/ring-ui': resolve('./node_modules/@jetbrains/ring-ui')
    }
  },
  output: {
    path: resolve(__dirname, pkgConfig.dist),
    filename: '[name].js',
    publicPath: '',
    devtoolModuleFilenameTemplate: '/[absolute-resource-path]'
  },
  module: {
    rules: [
      ...ringUiWebpackConfig.config.module.rules,

      {
        test: /\.scss$/,
        include: componentsPath,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [
                require('postcss-modules-values-replace')({}),
                require('postcss-preset-env')({
                  importFrom: require.resolve('@jetbrains/ring-ui/components/global/variables.css'),
                  features: {
                    'postcss-custom-properties': {
                      preserve: true
                    }
                  }
                })
              ]
            }
          },
          'sass-loader'
        ]
      },
      {
        test: /\.css$/,
        include: [componentsPath],
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              import: true,
              modules: {
                localIdentName: '[name]__[local]__[hash:base64:7]'
              },
              importLoaders: 1
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [
                require('postcss-modules-values-replace')({}),
                require('postcss-preset-env')({
                  importFrom: require.resolve('@jetbrains/ring-ui/components/global/variables.css'),
                  features: {
                    'postcss-custom-properties': {
                      preserve: true
                    }
                  }
                })
              ]
            }
          }
        ]
      },

      {
        test: /\.css$/,
        include: [
          join(__dirname, 'node_modules', '@jetbrains', 'hub-widget-ui'),
          join(__dirname, 'node_modules', 'fullcalendar-reactwrapper'),
          join(__dirname, 'node_modules', 'fullcalendar'),
          join(__dirname, 'node_modules', 'react-big-calendar')
        ],
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.js$/,
        include: [
          join(__dirname, 'node_modules/chai-as-promised'),
          componentsPath
        ],
        loader: 'babel-loader?cacheDirectory'
      }
    ]
  },
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    stats: {
      assets: false,
      children: false,
      chunks: false,
      hash: false,
      version: false
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'html-loader?interpolate!src/index.html'
    }),
    new CopyWebpackPlugin([
      'manifest.json'
    ], {})
  ]
});

module.exports = webpackConfig;
