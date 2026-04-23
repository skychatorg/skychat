import { defineStore } from 'pinia';

export const usePaletteStore = defineStore('palette', {
    state: () => ({
        open: false,
        query: '',
        /** @type {import('@/lib/commands/types.js').ExpandResult[]} */
        stack: [],
    }),
    getters: {
        topFrame: (state) => state.stack[state.stack.length - 1] || null,
    },
    actions: {
        toggle() {
            if (this.open) {
                this.close();
            } else {
                this.openPalette();
            }
        },
        openPalette() {
            this.open = true;
            this.query = '';
            this.stack = [];
        },
        close() {
            this.open = false;
            this.query = '';
            this.stack = [];
        },
        push(frame) {
            this.stack.push(frame);
            this.query = '';
        },
        pop() {
            if (this.stack.length === 0) {
                this.close();
                return;
            }
            this.stack.pop();
            this.query = '';
        },
    },
});
