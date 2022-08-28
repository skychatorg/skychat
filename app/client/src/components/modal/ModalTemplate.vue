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
                class="modal relative flex flex-col" 
                v-if="app.modals[id]"
            >
                <div>
                    <button
                        @click="app.closeModal(id)"
                        class="absolute top-3 left-6"
                    >
                        <fa icon="times" />
                    </button>

                    <SectionTitle>{{ title }}</SectionTitle>
                    <hr class="my-4 border-skygray-light">
                </div>

                <div class="h-0 grow overflow-y-scroll scrollbar px-4">
                    <slot />
                </div>
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
    transform: translate3d(20px, 0, 0);
    opacity: 0;
}
</style>
