<script setup>
import { watch, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import SectionSubTitle from '@/components/util/SectionSubTitle.vue';

const app = useAppStore();
const client = useClientStore();

let newMotto = ref(client.state.user.data.plugins.motto);
const saveNewMotto = () => {
    client.sendMessage(`/motto ${newMotto.value}`);
};
watch(() => app.modals.profile, () => {
    if (app.modals.profile) {
        newMotto.value = client.state.user.data.plugins.motto;
    }
});

</script>

<template>
    <ModalTemplate
        id="profile"
        title="Preferences"
    >

        <!-- Motto -->
        <SectionSubTitle>Motto</SectionSubTitle>
        <div class="flex justify-center gap-4">
            <input v-model="newMotto" class="grow form-control" placeholder="What drives you?" />
            <button @click="saveNewMotto" class="form-control">Save</button>
        </div>

        <!-- Color -->
        <SectionSubTitle class="mt-6">Custom color</SectionSubTitle>
        <div class="mt-2 w-full md:w-2/3 lg:w-[120px] mx-auto flex flex-wrap gap-2 justify-center">
            <div
                v-for="color, index in client.state.custom.color"
                :key="index"
                class="w-6 h-6 lg:w-4 lg:h-4 cursor-pointer transition-all hover:rounded"
                :style="{
                    backgroundColor: color.value,
                }"
                :title="color.name"
                @click="client.sendMessage(`/custom use color:${color.id}`)"
            ></div>
        </div>

    </ModalTemplate>
</template>
