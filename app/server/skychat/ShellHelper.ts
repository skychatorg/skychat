import { exec } from 'child_process';


export class ShellHelper {

    static exec(cmd: string): Promise<{stdout: string, stderr: string}> {
        return new Promise((resolve, reject) => {
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stdout));
                } else {
                    resolve({stdout, stderr});
                }
            });
        });
    }
}
