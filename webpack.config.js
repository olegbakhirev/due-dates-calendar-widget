const {join, resolve} = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const ringUiWebpackConfig = require('@jetbrains/ring-ui/webpack.config');

const pkgConfig = require('./package.json').config;

const componentsPath = join(__dirname, pkgConfig.components);

// Patch @jetbrains/ring-ui svg-sprite-loader config
ringUiWebpackConfig.loaders.svgSpriteLoader.include.push(
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
      // {
      //   test: /calendar\.css$/,
      //   include: componentsPath,
      //   use: [
      //     'style-loader',
      //     {
      //       loader: 'css-loader'
      //     }
      //   ]
      // },
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
                require('postcss-cssnext')({
                  features: {
                    customProperties: {
                      preserve: true,
                      variables: require('@jetbrains/ring-ui/extract-css-vars')
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
        include: componentsPath,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true,
              importLoaders: 1,
              localIdentName: '[name]__[local]__[hash:base64:7]'
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [
                require('postcss-modules-values-replace')({}),
                require('postcss-cssnext')({
                  features: {
                    customProperties: {
                      preserve: true,
                      variables: require('@jetbrains/ring-ui/extract-css-vars')
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
        include: [/fullcalendar-reactwrapper/, /fullcalendar/],
        use: [
          'style-loader',
          {
            loader: 'css-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        include: [/react-big-calendar/],
        use: [
          'style-loader',
          {
            loader: 'css-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        include: join(__dirname, 'node_modules', '@jetbrains', 'hub-widget-ui'),
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
    })
  ]
});

module.exports = webpackConfig;
