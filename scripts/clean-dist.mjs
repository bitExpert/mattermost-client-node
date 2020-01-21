import {
    existsSync,
    readdirSync,
    lstatSync,
    unlinkSync,
    rmdirSync,
} from 'fs';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const deleteFolderRecursive = (filePath) => {
    if (existsSync(filePath)) {
        readdirSync(filePath).forEach((file, _index) => {
            const curPath = join(filePath, file);
            if (lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                unlinkSync(curPath);
            }
        });
        rmdirSync(filePath);
    }
};

deleteFolderRecursive('./dist');
