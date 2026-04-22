<script setup>
import CursorOverlay from '@/components/cursor/CursorOverlay.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import GalleryModal from '@/components/modal/GalleryModal.vue';
import JellyfinModal from '@/components/modal/JellyfinModal.vue';
import ManageRoomsModal from '@/components/modal/ManageRoomsModal.vue';
import ManageStickersModal from '@/components/modal/ManageStickersModal.vue';
import OngoingConvertsModal from '@/components/modal/OngoingConvertsModal.vue';
import PlayerQueueModal from '@/components/modal/PlayerQueueModal.vue';
import ProfileModal from '@/components/modal/ProfileModal.vue';
import VideoConverterModal from '@/components/modal/VideoConverterModal.vue';
import YoutubeVideoSearcherModal from '@/components/modal/YoutubeVideoSearcherModal.vue';
import CommandPalette from '@/components/palette/CommandPalette.vue';
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
        <JellyfinModal />
        <PlayerQueueModal />
        <ManageRoomsModal />
        <ManageStickersModal />
        <CommandPalette />
        <RouterView class="grow" />
    </div>
</template>
