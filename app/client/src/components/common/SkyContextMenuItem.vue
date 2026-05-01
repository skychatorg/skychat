<script setup lang="ts">
import { ContextMenuItem } from 'radix-vue';
import { useAttrs } from 'vue';

const attrs = useAttrs();
</script>

<template>
    <ContextMenuItem v-bind="attrs" class="px-2 py-1 rounded cursor-pointer hover:bg-skygray-dark/25">
        <slot />
    </ContextMenuItem>
</template>
