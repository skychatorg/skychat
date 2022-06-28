<script setup>
import SectionTitle from '@/components/util/SectionTitle.vue';
import { useAppStore } from '@/stores/app';

const app = useAppStore();

defineProps({
    id: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        default: '',
    },
})
</script>

<template>
    <Teleport to="#modals">
        <div class="modal relative">

            <button
                @click="app.toggleModal(id)"
                class="absolute top-3 left-6"
            >
                <fa icon="times" />
            </button>

            <SectionTitle>{{ title }}</SectionTitle>
            <hr class="my-4 border-skygray-light">

            <slot />
        </div>
    </Teleport>
</template>

<style scoped>
</style>
