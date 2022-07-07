<script setup>
import AppHeader from '@/components/layout/AppHeader.vue';
import CursorOverlay from '@/components/cursor/CursorOverlay.vue';
import YoutubeVideoSearcherModal from '@/components/modal/YoutubeVideoSearcherModal.vue';
import GalleryModal from '@/components/modal/GalleryModal.vue';
import ProfileModal from '@/components/modal/ProfileModal.vue';
import PlayerQueueModal from '@/components/modal/PlayerQueueModal.vue';
import OngoingConvertsModal from '@/components/modal/OngoingConvertsModal.vue';
import VideoConverterModal from '@/components/modal/VideoConverterModal.vue';
</script>

<template>
    <div class="flex flex-col h-full">
        <CursorOverlay />
        <AppHeader />
        <ProfileModal />
        <YoutubeVideoSearcherModal />
        <OngoingConvertsModal />
        <VideoConverterModal />
        <GalleryModal />
        <PlayerQueueModal />
        <router-view class="grow"></router-view>
    </div>
</template>
