<script setup lang="ts">
import { DropdownMenuArrow, DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'radix-vue';
import { ref, useAttrs } from 'vue';

const attrs = useAttrs();

const toggleState = ref(false);
</script>

<template>
    <DropdownMenuRoot v-bind="attrs" v-model:open="toggleState">
        <DropdownMenuTrigger>
            <slot name="trigger" />
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
            <DropdownMenuContent class="min-w-[220px] bg-skygray-darker/50 rounded-xl py-1" :side-offset="5">
                <slot />

                <DropdownMenuArrow class="fill-white" />
            </DropdownMenuContent>
        </DropdownMenuPortal>
    </DropdownMenuRoot>
</template>
