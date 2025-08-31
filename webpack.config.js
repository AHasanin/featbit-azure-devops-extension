const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = argv.mode === 'development';
  
  return {
    entry: {
      'feature-flag-panel': './src/components/FeatureFlagPanel/index.tsx',
      'configuration-hub': './src/components/ConfigurationHub/index.tsx',
      'create-flag-dialog': './src/components/CreateFeatureFlagDialog/index.tsx'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
      publicPath: isDevelopment ? 'http://localhost:3000/' : './'
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource'
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/components/FeatureFlagPanel/index.html',
        filename: 'feature-flag-panel.html',
        chunks: ['feature-flag-panel']
      }),
      new HtmlWebpackPlugin({
        template: './src/components/ConfigurationHub/index.html',
        filename: 'configuration-hub.html',
        chunks: ['configuration-hub']
      }),
      new HtmlWebpackPlugin({
        template: './src/components/CreateFeatureFlagDialog/index.html',
        filename: 'create-flag-dialog.html',
        chunks: ['create-flag-dialog']
      })
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    externals: {
      // Remove the SDK external since we're using the npm package
    },
    devServer: isDevelopment ? {
      static: [
        {
          directory: path.join(__dirname, 'dist'),
        },
        {
          directory: path.join(__dirname, 'assets'),
          publicPath: '/assets',
        }
      ],
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
      },
      hot: true,
      liveReload: true,
      open: false,
      compress: true
    } : undefined
  };
};