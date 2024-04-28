import { GlobalPlugin } from '../../GlobalPlugin.js';

export class VoidPlugin extends GlobalPlugin {
    static readonly commandName = 'void';
    readonly minRight = -1;
    readonly hidden = true;
    async run(): Promise<void> {
        void 0;
    }
}
