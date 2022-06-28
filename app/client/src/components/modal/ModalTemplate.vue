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
    <Teleport to="#modal-container">
        <Transition name="slide-fade">
            <div
                class="modal relative" 
                v-if="app.modals[id]"
            >

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
        </Transition>
    </Teleport>
</template>

<style >
.slide-fade-enter-active {
    transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
    transition: all 0.3s ease-out;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateX(20px);
    opacity: 0;
}
</style>
