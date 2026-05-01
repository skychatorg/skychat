<script setup lang="ts">
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'radix-vue';
import { useAttrs } from 'vue';

const attrs = useAttrs();

defineProps<{
    disabled?: boolean;
}>();
</script>

<template>
    <ContextMenuRoot v-bind="attrs">
        <ContextMenuTrigger as-child :disabled="disabled">
            <slot name="trigger" />
        </ContextMenuTrigger>

        <ContextMenuPortal>
            <ContextMenuContent class="min-w-[220px] bg-skygray-darker/50 rounded-xl py-1" :collision-padding="8">
                <slot />
            </ContextMenuContent>
        </ContextMenuPortal>
    </ContextMenuRoot>
</template>
