const path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production',
  resolve: {
    fallback: {
      "fs": false,
      "path": false,
      "crypto": false,
      "process": false,
      "buffer": false
    }
  },
  performance: {
    hints: false
  }
};
