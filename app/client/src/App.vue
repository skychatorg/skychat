<script setup>
import AppHeader from '@/components/layout/AppHeader.vue';
</script>

<template>
    <div class="flex flex-col h-full">
        <AppHeader />
        <router-view class="grow"></router-view>
    </div>
</template>

<style>
</style>
