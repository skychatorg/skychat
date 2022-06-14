<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import MediaPlayer from '@/components/player/MediaPlayer.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div class="pannel w-full flex flex-col">
        
        <!-- Pannel content -->
        <div class="grow flex">

            <!-- Actual player implementation -->
            <MediaPlayer class="player grow bg-danger/20" />

            <!-- Queue if shown -->
            <div v-if="false" class="queue bg-secondary/20"></div>
        </div>

        <!-- Pannel contro bar -->
        <div class="basis-8">
            
        </div>
    </div>
</template>

<style scoped>
.pannel {

    /* Pannel total size */
    min-height: 35vh;
}

.queue {
    flex-basis: 12rem;
}
</style>
