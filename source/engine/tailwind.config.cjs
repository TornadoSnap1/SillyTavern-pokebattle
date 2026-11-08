const path = require('path');
module.exports = {
  content: ['src/battle.html', 'src/main.js', 'src/battle-controls.mjs'].map(file => path.join(__dirname, file)),
  theme: { extend: {} },
  plugins: [],
};
