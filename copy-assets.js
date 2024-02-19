const fs = require('fs-extra');
const path = require('path');

const srcDir = 'src';
const destDir = 'built';

fs.copy(srcDir, destDir, {
  filter: (src, dest) => {
    // Allow directories to ensure the structure is preserved
    if (fs.lstatSync(src).isDirectory()) {
      return true;
    }
    // Check if the file extension is .csv or .json
    return path.extname(src) === '.csv' || path.extname(src) === '.json';
  }
})
.then(() => console.log('Selective copy completed!'))
.catch(err => console.error(err));
