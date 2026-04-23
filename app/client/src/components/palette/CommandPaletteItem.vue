<script setup>
defineProps({
    command: { type: Object, required: true },
    active: { type: Boolean, default: false },
    itemId: { type: String, required: true },
});

defineEmits(['select', 'hover']);
</script>

<template>
    <button
        :id="itemId"
        type="button"
        role="option"
        :aria-selected="active"
        class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
        :class="active ? 'bg-white/10 text-skygray-white' : 'text-skygray-lightest hover:bg-white/5'"
        @click="$emit('select')"
        @mousemove="$emit('hover')"
    >
        <div class="w-6 flex-none text-center opacity-80">
            <fa v-if="command.icon" :icon="command.icon" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="truncate text-sm">{{ command.title }}</div>
            <div v-if="command.subtitle" class="truncate text-xs text-skygray-lighter">{{ command.subtitle }}</div>
        </div>
        <div v-if="command.expand" class="text-xs text-skygray-lighter">
            <fa icon="chevron-right" />
        </div>
        <div v-else-if="command.shortcut" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-skygray-lighter">
            {{ command.shortcut }}
        </div>
    </button>
</template>
