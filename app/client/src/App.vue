<script setup>
import AppHeader from '@/components/layout/AppHeader.vue';
import { ModalsContainer } from 'vue-final-modal';
import CursorOverlay from '@/components/cursor/CursorOverlay.vue';
</script>

<template>
    <div class="flex flex-col h-full">
        <CursorOverlay />
        <ModalsContainer />
        <AppHeader />
        <router-view class="grow"></router-view>
    </div>
</template>

<style>
</style>
