<script setup>
import CursorOverlay from '@/components/cursor/CursorOverlay.vue';
import AdminModal from '@/components/admin/AdminModal.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import GalleryModal from '@/components/modal/GalleryModal.vue';
import OngoingConvertsModal from '@/components/modal/OngoingConvertsModal.vue';
import PlayerModal from '@/components/modal/PlayerModal.vue';
import ProfileModal from '@/components/modal/ProfileModal.vue';
import ShopModal from '@/components/modal/ShopModal.vue';
import UserProfileModal from '@/components/modal/UserProfileModal.vue';
import VideoConverterModal from '@/components/modal/VideoConverterModal.vue';
import CommandPalette from '@/components/palette/CommandPalette.vue';
import CreatePollModal from '@/components/modal/CreatePollModal.vue';
import GroupChatModal from '@/components/modal/GroupChatModal.vue';
</script>

<template>
    <div class="flex flex-col h-full">
        <CursorOverlay />
        <AppHeader />
        <ProfileModal />
        <ShopModal />
        <UserProfileModal />
        <OngoingConvertsModal />
        <VideoConverterModal />
        <GalleryModal />
        <PlayerModal />
        <AdminModal />
        <CreatePollModal />
        <GroupChatModal />
        <CommandPalette />
        <RouterView class="grow" />
    </div>
</template>
