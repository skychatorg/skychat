<script setup>
import AppHeader from '@/components/layout/AppHeader.vue';
import { ModalsContainer } from 'vue-final-modal';
</script>

<template>
    <div class="flex flex-col h-full">
        <ModalsContainer />
        <AppHeader />
        <router-view class="grow"></router-view>
    </div>
</template>

<style>
</style>
