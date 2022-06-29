<script setup>
import { onMounted, nextTick, watch, ref, reactive } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';
import SectionSubTitle from '@/components/util/SectionSubTitle.vue';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

const folderList = ref([]);
const enterFolder = folderName => {
    folderList.value.push(folderName);
    client.sendMessage(`/galleryls ${folderList.value.join('/')}`);
};
const leaveFolder = () => {
    folderList.value.pop();
    client.sendMessage(`/galleryls ${folderList.value.join('/')}`);
};
const playFile = file => {
    client.sendMessage(`/galleryadd ${folderList.value.join('/')}/${file}`);
};

</script>

<template>
    <ModalTemplate
        id="gallery"
        title="Gallery"
    >
        <div class="flex flex-col">

            <!-- Current location -->
            <input
                class="mousetrap form-control mb-2"
                type="text"
                :value="`gallery/${folderList.join('/')}`"
                disabled
            />

            <!-- Folder & Files -->
            <div class="flex flex-col mb-2">
                <HoverCard
                    :selectable="true"
                    :borderColor="'rgb(var(--color-primary))'"
                >
                    <div
                        @click="leaveFolder()"
                        class="cursor-pointer select-none px-4 py-2"
                    >
                        <fa icon="arrow-left" class="mr-2" />
                    </div>
                </HoverCard>
                <HoverCard
                    v-for="folder in client.state.gallery.folders"
                    :key="folder"
                    :selectable="true"
                    :borderColor="'rgb(var(--color-primary))'"
                >
                    <div
                        @click="enterFolder(folder)"
                        class="cursor-pointer select-none px-4 py-2"
                    >
                        <fa icon="folder" class="mr-2" /> {{ folder }}
                    </div>
                </HoverCard>
            </div>

            <div class="flex flex-col">
                <HoverCard
                    v-for="file in client.state.gallery.files"
                    :key="file"
                    :selectable="true"
                    :selected="false"
                    :borderColor="'rgb(var(--color-secondary))'"
                >
                    <div
                        @click="playFile(file)"
                        class="cursor-pointer select-none px-4 py-2"
                    >
                        <fa icon="file" class="mr-2" /> {{ file }}
                    </div>
                </HoverCard>
            </div>
        </div>
    </ModalTemplate>
</template>
