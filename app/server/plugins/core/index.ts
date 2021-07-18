import * as fs from 'fs';

// Export dynamically all files in this directory
const files = fs.readdirSync(__dirname + '/');
for (const file of files) {
    if (['index.js'].indexOf(file) !== -1) {
        continue;
    }
    if (file.substr(file.length - 3) !== '.js') {
        continue;
    }
    const ClassName = file.substr(0, file.length - 3);
    exports[ClassName] = require(__dirname + '/' + file)[ClassName];
}
