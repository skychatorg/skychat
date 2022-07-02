<script setup>
import { computed, ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

// When mounted, reset folder
onMounted(() => {
    folderList.value = [];
    refresh();
});

// Refresh current folder
const refresh = () => {
    client.sendMessage(`/galleryls ${folderList.value.join('/')}`);
};

// Current folder
const folderList = ref([]);
const enterFolder = folderName => {
    folderList.value.push(folderName);
    refresh();
};
const leaveFolder = () => {
    folderList.value.pop();
    refresh();
};

// File info
const getFileNamePath = fileName => {
    return folderList.value.length === 0 ? fileName : `${folderList.value.join('/')}/${fileName}`;
};
const isFileTypeAddable = fileType => {
    return fileType === 'video';
};

// Selected files
const selectedFiles = ref([]);
const addableSelectedFiles = computed(() => selectedFiles.value.filter(file => isFileTypeAddable(file.type)));
const toggleSelectFile = file => {
    const filePath = getFileNamePath(file.name);
    if (isFileSelected(file)) {
        selectedFiles.value = selectedFiles.value.filter(file => file.filePath !== filePath);
    } else {
        selectedFiles.value.push({
            ...file,
            filePath,
        });
    }
};
const isFileSelected = file => {
    const filePath = getFileNamePath(file.name);
    return selectedFiles.value.find(selectedFile => selectedFile.filePath === filePath);
};
const clearSelectedFiles = () => {
    selectedFiles.value = [];
};
const addSelectedFiles = () => {
    if (addableSelectedFiles.value.length === 0) {
        return;
    }
    for (const selectedFile of addableSelectedFiles.value) {
        client.sendMessage(`/galleryadd ${selectedFile.filePath}`);
    }
    app.closeModal('gallery');
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
    <div class="flex flex-col h-full">

        <!-- Current location -->
        <div class="flex gap-4 mb-2">
            <input
                class="h-10 grow mousetrap form-control"
                type="text"
                :value="`gallery/${folderList.join('/')}`"
                disabled
            />
            <div class="h-10" v-if="client.state.gallery.thumb">
                <a :href="client.state.gallery.thumb" target="_blank">
                    <img :src="client.state.gallery.thumb" class="h-full fit-content" />
                </a>
            </div>
        </div>

        <!-- Folder & Files -->
        <div class="px-2 grow overflow-y-auto scrollbar flex flex-col">
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
                    :selected="isFileSelected(file)"
                    :borderColor="getFileColor(file)"
                >
                    <div
                        @click="toggleSelectFile(file)"
                        class="cursor-pointer select-none px-4 py-2 flex flex-nowrap"
                    >
                        <div class="basis-7">
                            <fa :icon="getFileIcon(file)" class="mr-2" />
                        </div>
                        <div :title="file.name" class="w-0 grow overflow-x-hidden whitespace-nowrap text-ellipsis">
                            {{ file.name }}
                        </div>
                        <div class="basis-7">
                            <a
                                @click.stop=""
                                :href="`/gallery/${getFileNamePath(file.name)}`"
                                title="Open in new tab"
                                target="_blank"
                                class="px-2 py-1"
                            >
                                <fa icon="arrow-up-right-from-square" />
                            </a>
                        </div>
                    </div>
                </HoverCard>
            </div>
        </div>

        <!-- Selected files -->
        <div v-if="selectedFiles.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-2">
            <span class="col-span-2 flex flex-col justify-center text-center text-sm">
                {{ selectedFiles.length }} file{{ selectedFiles.length > 1 ? 's' : '' }} / 
                <template v-if="addableSelectedFiles.length === 0">
                    no playable file selected
                </template>
                <template v-else>
                    {{ addableSelectedFiles.length }} playable file{{ addableSelectedFiles.length > 1 ? 's' : '' }} selected
                </template>
            </span>
            <button
                v-show="selectedFiles.length > 0"
                @click="clearSelectedFiles"
                class="form-control px-2 text-sm"
            >
                Clear selected
            </button>
            <button
                v-show="addableSelectedFiles.length > 0"
                @click="addSelectedFiles"
                class="form-control px-2 text-sm"
            >
                Add {{ addableSelectedFiles.length }} file{{ addableSelectedFiles.length > 1 ? 's' : '' }}
            </button>
        </div>
    </div>
</template>
