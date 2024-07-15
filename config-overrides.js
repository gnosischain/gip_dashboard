const path = require('path');

module.exports = {
  // Other configuration options...
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer/")
    }
  }
};
