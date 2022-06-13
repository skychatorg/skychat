<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div class="p-4 bg-primary">
        Player section
    </div>
</template>

<style scoped>

</style>
