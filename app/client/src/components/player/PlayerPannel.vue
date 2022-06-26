<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useToast } from "vue-toastification";
import { $vfm } from 'vue-final-modal';
import HoverCard from '@/components/util/HoverCard.vue';
import MediaPlayer from '@/components/player/MediaPlayer.vue';
import MediaQueue from '@/components/player/MediaQueue.vue';
import YoutubeVideoSearcherModal from '@/components/modal/YoutubeVideoSearcherModal.vue';
import GalleryModal from '@/components/modal/GalleryModal.vue';


const app = useAppStore();
const client = useClientStore();
const toast = useToast();

const playerHeightCss = computed(() => {
    return {
        xs: '100px',
        sm: '20vh',
        md: '35vh',
        lg: 'calc(100vh - 450px)',
    }[app.playerMode.size];
});

const showPlayer = computed(() => {
    return client.state.player.current && app.playerMode.enabled;
});

const showQueue = computed(() => {
    return client.state.player.queue.length && app.playerMode.queueEnabled;
});

const showPannel = computed(() => {
    return showPlayer.value || showQueue.value;
});

const openYoutubeModal = () => {
   $vfm.show({ component: YoutubeVideoSearcherModal });
};

const openGalleryModal = () => {
   $vfm.show({ component: GalleryModal });
};

</script>

<template>
    <div class="pannel group w-full flex flex-col">
        
        <!-- Pannel content -->
        <div
            v-if="showPannel"
            class="pannel-content grow flex transition"
        >

            <!-- Actual player implementation -->
            <MediaPlayer v-if="showPlayer" class="player overflow-hidden grow" />

            <!-- Queue if shown -->
            <MediaQueue v-if="showQueue" class="overflow-y-auto h-0 min-h-full scrollbar queue" />
        </div>

        <!-- Pannel control bar -->
        <div class="basis-12 p-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition duration-200">

            <div class="grid grid-cols-12 gap-2 text-skygray-lighter">
            
                <!-- Player type (big to disabled) -->
                <div class="col-span-4 btn-group">
                    <button
                        class="hidden btn text-sm"
                        :class="{ 'active': app.playerMode.cinemaMode, 'disabled': ! showPannel }"
                        @click="toast.error('The cinema mode is not yet implemented.')"
                    >
                        <fa icon="tv" />
                    </button>
                    <button
                        @click="app.shrinkPlayer"
                        class="btn text-sm"
                        :class="{ 'disabled': app.playerMode.size === 'xs' || ! showPannel }"
                    >
                        <fa icon="chevron-up" />
                    </button>
                    <button
                        @click="app.expandPlayer"
                        class="btn text-sm"
                        :class="{ 'disabled': app.playerMode.size === 'lg' || ! showPannel }"
                    >
                        <fa icon="chevron-down" />
                    </button>
                    <button
                        class="btn text-sm"
                        :class="{ 'active': app.playerMode.enabled }"
                        @click="app.setPlayerEnabled(! app.playerMode.enabled)"
                    >
                        <fa :icon="'toggle-' + (app.playerMode.enabled ? 'on' : 'off')" />
                    </button>
                </div>
            
                <!-- Player controls -->
                <div v-if="false" class="col-start-5 col-span-4 btn-group">
                    <button class="btn text-sm">
                        <fa icon="caret-left" />
                        <fa icon="caret-left" />
                    </button>
                    <button class="btn text-sm">
                        <fa icon="caret-left" />
                    </button>
                    <button class="hidden btn text-sm">
                        <fa icon="pause" />
                    </button>
                    <button class="btn text-sm">
                        <fa icon="caret-right" />
                    </button>
                    <button class="btn text-sm">
                        <fa icon="caret-right" />
                        <fa icon="caret-right" />
                    </button>
                </div>
            
                <!-- Player actions -->
                <div class="col-start-7 col-span-4 btn-group">
                    <button
                        @click="client.sendMessage('/player skip')"
                        class="btn text-sm"
                        :class="{
                            'disabled': ! showPlayer,
                        }"
                    >
                        <fa icon="forward-step" />
                    </button>
                    <button
                        @click="openYoutubeModal"
                        class="btn text-sm"
                    >
                        <fa icon="plus" />
                    </button>
                    <button
                        v-if="client.state.gallery"
                        @click="openGalleryModal"
                        class="btn text-sm"
                    >
                        <fa icon="folder-tree" />
                    </button>
                </div>
            
                <!-- Queue -->
                <div class="col-start-11 col-span-2 btn-group">
                    <button
                        class="btn text-sm"
                        :class="{
                            'disabled': ! client.state.player.queue.length,
                            'active': showQueue,
                        }"
                        @click="app.toggleShowPlayerQueue"
                    >
                        <fa icon="list" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pannel-content {

    /* Pannel total size */
    height: v-bind(playerHeightCss);
}

.queue {
    min-width: 16rem;
    flex-basis: 16rem;
}
</style>
