<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'radix-vue';

import { useAttrs } from 'vue';

const attrs = useAttrs();

const props = withDefaults(
    defineProps<{
        triggerClass?: string;
        side?: 'top' | 'right' | 'bottom' | 'left';
        sideOffset?: number;
        asChild?: boolean;
    }>(),
    {
        side: 'left',
        sideOffset: 0,
        asChild: false,
    },
);
</script>

<template>
    <TooltipProvider :delay-duration="0" as-child v-bind="attrs">
        <TooltipRoot>
            <TooltipTrigger :class="props.triggerClass" :as-child="props.asChild">
                <slot name="trigger" />
            </TooltipTrigger>

            <TooltipPortal>
                <TooltipContent
                    :side="props.side"
                    :side-offset="props.sideOffset"
                    align="center"
                    :arrow-padding="12"
                    class="z-50 bg-slate-700 rounded-lg px-4 py-2 text-sm"
                >
                    <slot />

                    <TooltipArrow class="fill-slate-700" />
                </TooltipContent>
            </TooltipPortal>
        </TooltipRoot>
    </TooltipProvider>
</template>
