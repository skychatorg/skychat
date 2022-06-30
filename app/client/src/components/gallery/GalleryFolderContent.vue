<script setup>
import { ref } from 'vue';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

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
const playFile = ({ name, type }) => {
    
    const filePath = folderList.value.length === 0 ? name : `${folderList.value.join('/')}/${name}`;

    if (['video'].includes(type)) {
        client.sendMessage(`/galleryadd ${filePath}`);
    } else {
        window.open(`/gallery/${filePath}`);
    }
};

const getFileIcon = ({ name, type }) => {
    return {
        video: 'video',
        subtitle: 'closed-captioning',
        audio: 'music',
        image: 'image',
        unknown: 'file',
    }[type] || 'file';
};
const getFileColor = ({ name, type }) => {
    return {
        video: 'rgb(var(--color-tertiary))',
        subtitle: 'rgb(var(--color-tertiary-light))',
        audio: 'rgb(var(--color-secondary))',
        image: 'rgb(var(--color-primary))',
    }[type] || 'rgb(var(--color-skygray-lightest))';
};

</script>

<template>
    <div class="flex flex-col">

        <!-- Current location -->
        <div class="flex gap-4 h-12 mb-2">
            <input
                class="grow mousetrap form-control"
                type="text"
                :value="`gallery/${folderList.join('/')}`"
                disabled
            />
            <div v-if="client.state.gallery.thumb">
                <a :href="client.state.gallery.thumb" target="_blank">
                    <img :src="client.state.gallery.thumb" class="h-full fit-content" />
                </a>
            </div>
        </div>

        <!-- Folder & Files -->
        <div class="px-2 flex flex-col">
            <div class="mb-2 flex flex-col">
                <HoverCard
                    :selectable="true"
                    :borderColor="'rgb(var(--color-skygray-light))'"
                >
                    <div
                        @click="leaveFolder()"
                        class="cursor-pointer select-none px-4 py-2"
                    >
                        <fa icon="arrow-left" class="mr-2" />
                    </div>
                </HoverCard>
                <HoverCard
                    v-for="folderName in client.state.gallery.folders"
                    :key="folderName"
                    :selectable="true"
                    :borderColor="'rgb(var(--color-skygray-light))'"
                >
                    <div
                        @click="enterFolder(folderName)"
                        class="cursor-pointer select-none px-4 py-2 flex flex-nowrap"
                    >
                        <div class="basis-7">
                            <fa icon="folder" class="mr-2" />
                        </div>
                        <div :title="folderName" class="w-0 grow overflow-x-hidden text-ellipsis">
                            {{ folderName }}
                        </div>
                    </div>
                </HoverCard>
            </div>
            <div class="flex flex-col">
                <HoverCard
                    v-for="file in client.state.gallery.files"
                    :key="file"
                    :selectable="true"
                    :borderColor="getFileColor(file)"
                >
                    <div
                        @click="playFile(file)"
                        class="cursor-pointer select-none px-4 py-2 flex flex-nowrap"
                    >
                        <div class="basis-7">
                            <fa :icon="getFileIcon(file)" class="mr-2" />
                        </div>
                        <div :title="file.name" class="w-0 grow overflow-x-hidden whitespace-nowrap text-ellipsis">
                            {{ file.name }}
                        </div>
                    </div>
                </HoverCard>
            </div>
        </div>
    </div>
</template>
