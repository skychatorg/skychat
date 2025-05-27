<script setup lang="ts">
import { DropdownMenuItem } from 'radix-vue';
import { useAttrs } from 'vue';

const attrs = useAttrs();
</script>

<template>
    <DropdownMenuItem v-bind="attrs" class="px-2 py-1 rounded cursor-pointer hover:bg-skygray-dark/25">
        <slot />
    </DropdownMenuItem>
</template>
