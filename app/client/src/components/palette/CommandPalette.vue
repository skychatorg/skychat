<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'radix-vue';
import { usePaletteStore } from '@/stores/palette';
import { useCommandRegistry } from '@/lib/commands/registry';
import { scoreCommands } from '@/lib/commands/fuzzy';
import CommandPaletteItem from './CommandPaletteItem.vue';

const palette = usePaletteStore();
const registry = useCommandRegistry();

const inputEl = ref(null);
const listEl = ref(null);
const promptValue = ref('');
const selectedIndex = ref(0);

const topFrame = computed(() => palette.topFrame);
const mode = computed(() => topFrame.value?.type || 'root');
const frameTitle = computed(() => topFrame.value?.title || 'Command palette');

const sourceCommands = computed(() => {
    if (!topFrame.value) return registry.value;
    if (topFrame.value.type === 'list') return topFrame.value.commands;
    return [];
});

const filteredCommands = computed(() => scoreCommands(sourceCommands.value, palette.query));

const groupedCommands = computed(() => {
    if (palette.query) {
        return [{ category: null, commands: filteredCommands.value }];
    }
    const groups = new Map();
    for (const cmd of filteredCommands.value) {
        if (!groups.has(cmd.category)) groups.set(cmd.category, []);
        groups.get(cmd.category).push(cmd);
    }
    return Array.from(groups, ([category, commands]) => ({ category, commands }));
});

const flatCommands = computed(() => filteredCommands.value);

const resetSelection = () => {
    selectedIndex.value = 0;
};

watch(() => palette.query, resetSelection);
watch(
    () => palette.stack.length,
    async () => {
        resetSelection();
        promptValue.value = '';
        await nextTick();
        inputEl.value?.focus();
    },
);
watch(
    () => palette.open,
    async (open) => {
        if (open) {
            resetSelection();
            promptValue.value = '';
            await nextTick();
            inputEl.value?.focus();
        }
    },
);

function run(cmd) {
    if (!cmd) return;
    if (cmd.expand) {
        palette.push(cmd.expand());
        return;
    }
    try {
        cmd.run?.();
    } finally {
        palette.close();
    }
}

function scrollSelectedIntoView() {
    nextTick(() => {
        const node = listEl.value?.querySelector('[aria-selected="true"]');
        node?.scrollIntoView({ block: 'nearest' });
    });
}

function onKeyDown(e) {
    if (mode.value === 'prompt') {
        if (e.key === 'Enter') {
            e.preventDefault();
            const v = promptValue.value;
            topFrame.value.run(v);
            palette.close();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            palette.pop();
        }
        return;
    }

    const total = flatCommands.value.length;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (total > 0) {
            selectedIndex.value = (selectedIndex.value + 1) % total;
            scrollSelectedIntoView();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (total > 0) {
            selectedIndex.value = (selectedIndex.value - 1 + total) % total;
            scrollSelectedIntoView();
        }
    } else if (e.key === 'Home') {
        e.preventDefault();
        selectedIndex.value = 0;
        scrollSelectedIntoView();
    } else if (e.key === 'End') {
        e.preventDefault();
        selectedIndex.value = Math.max(0, total - 1);
        scrollSelectedIntoView();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        run(flatCommands.value[selectedIndex.value]);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        palette.pop();
    } else if (e.key === 'Backspace' && palette.query === '' && palette.stack.length > 0) {
        e.preventDefault();
        palette.pop();
    }
}

const activeItemId = computed(() =>
    flatCommands.value[selectedIndex.value] ? `palette-item-${flatCommands.value[selectedIndex.value].id}` : undefined,
);
</script>

<template>
    <DialogRoot :open="palette.open" @update:open="(v) => !v && palette.close()">
        <DialogPortal>
            <DialogOverlay class="palette-overlay" />
            <DialogContent class="palette-content" @open-auto-focus.prevent="inputEl?.focus()">
                <DialogTitle class="sr-only">{{ frameTitle }}</DialogTitle>

                <div v-if="palette.stack.length > 0" class="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-skygray-lighter">
                    <button class="hover:text-skygray-white" aria-label="Back" @click="palette.pop()">
                        <fa icon="arrow-left" />
                    </button>
                    <span class="truncate">{{ frameTitle }}</span>
                </div>

                <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <fa :icon="mode === 'prompt' ? 'pen-to-square' : 'magnifying-glass'" class="text-skygray-lighter" />
                    <input
                        v-if="mode === 'prompt'"
                        ref="inputEl"
                        v-model="promptValue"
                        :placeholder="topFrame?.placeholder || ''"
                        class="flex-1 bg-transparent outline-none text-skygray-white placeholder:text-skygray-lighter"
                        @keydown="onKeyDown"
                    />
                    <input
                        v-else
                        ref="inputEl"
                        v-model="palette.query"
                        placeholder="Type a command or search…"
                        class="flex-1 bg-transparent outline-none text-skygray-white placeholder:text-skygray-lighter"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="palette-listbox"
                        :aria-activedescendant="activeItemId"
                        @keydown="onKeyDown"
                    />
                </div>

                <div
                    v-if="mode !== 'prompt'"
                    id="palette-listbox"
                    ref="listEl"
                    role="listbox"
                    class="max-h-[50vh] overflow-y-auto scrollbar px-2 py-2"
                >
                    <div v-if="flatCommands.length === 0" class="px-3 py-6 text-center text-sm text-skygray-lighter">
                        No matching commands
                    </div>
                    <template v-for="group in groupedCommands" :key="group.category ?? 'results'">
                        <div
                            v-if="group.category"
                            class="sticky top-0 bg-skygray-darker/80 backdrop-blur px-3 py-1 text-[10px] uppercase tracking-wider text-skygray-lighter"
                        >
                            {{ group.category }}
                        </div>
                        <CommandPaletteItem
                            v-for="cmd in group.commands"
                            :key="cmd.id"
                            :command="cmd"
                            :active="flatCommands[selectedIndex]?.id === cmd.id"
                            :item-id="`palette-item-${cmd.id}`"
                            @select="run(cmd)"
                            @hover="selectedIndex = flatCommands.findIndex((c) => c.id === cmd.id)"
                        />
                    </template>
                </div>

                <div class="px-4 py-2 border-t border-white/5 text-[10px] font-mono text-skygray-lighter flex gap-4">
                    <span><kbd>↑↓</kbd> navigate</span>
                    <span><kbd>↵</kbd> select</span>
                    <span><kbd>esc</kbd> {{ palette.stack.length > 0 ? 'back' : 'close' }}</span>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style>
.palette-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 200;
}

.palette-content {
    position: fixed;
    top: 15vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 2rem));
    background: rgb(17 17 17 / 0.95);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    z-index: 201;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Desktop layout has left (280px) and right (340px) columns flanking the middle.
   Shift the palette to align with the middle column's center, not the viewport's. */
@media (min-width: 1024px) {
    .palette-content {
        left: calc(50% + (var(--page-col-left-width) - var(--page-col-right-width)) / 2);
    }
}

.palette-content kbd {
    padding: 1px 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.04);
}

@media (prefers-reduced-motion: no-preference) {
    .palette-content {
        animation: palette-in 120ms ease-out;
    }
}

@keyframes palette-in {
    from {
        opacity: 0;
        transform: translate(-50%, -4px);
    }
    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}
</style>
