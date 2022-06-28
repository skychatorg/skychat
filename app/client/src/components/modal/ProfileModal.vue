<script setup>
import { onMounted, nextTick, watch, ref, reactive } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';
import SectionSubTitle from '@/components/util/SectionSubTitle.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <ModalTemplate
        id="profile"
        title="Preferences"
        v-if="app.modals.profile"
    >

        <!-- Color -->
        <SectionSubTitle>
            Custom color
        </SectionSubTitle>
        <div class="mt-2 px-16 flex flex-wrap gap-2 justify-center">
            <div
                v-for="color, index in client.state.custom.color"
                :key="index"
                class="w-4 h-4 cursor-pointer transition-all hover:rounded"
                :style="{
                    backgroundColor: color.value,
                }"
                :title="color.name"
                @click="client.sendMessage(`/custom use color:${color.id}`)"
            ></div>
        </div>
    </ModalTemplate>
</template>

<style scoped>
</style>
