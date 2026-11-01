<script setup>
import { computed, ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useGallery } from '@/lib/Gallery';
import HoverCard from '@/components/util/HoverCard.vue';
import GalleryFileDotMenu from '@/components/gallery/GalleryFileDotMenu.vue';

const app = useAppStore();
const client = useClientStore();
const gallery = useGallery();

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
const enterFolder = (folderName) => {
    folderList.value.push(folderName);
    refresh();
};
const leaveFolder = () => {
    folderList.value.pop();
    refresh();
};

// Not while loading, when there is no folder content yet
const isEmpty = computed(() => client.state.gallery && !client.state.gallery.folders.length && !client.state.gallery.files.length);

// Selected files
const selectedFiles = ref([]);
const addableSelectedFiles = computed(() => selectedFiles.value.filter((file) => gallery.isFileTypeAddable(file.type)));
const toggleSelectFile = (file) => {
    const filePath = gallery.getFileNamePath(folderList.value, file.name);
    if (isFileSelected(file)) {
        selectedFiles.value = selectedFiles.value.filter((file) => file.filePath !== filePath);
    } else {
        selectedFiles.value.push({
            ...file,
            filePath,
        });
    }
};
const isFileSelected = (file) => {
    const filePath = gallery.getFileNamePath(folderList.value, file.name);
    return selectedFiles.value.find((selectedFile) => selectedFile.filePath === filePath);
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
</script>

<template>
    <div class="flex flex-col h-full">
        <!-- Current location -->
        <div class="flex gap-4 mb-2">
            <button
                v-if="client.state.ongoingConverts.length"
                class="form-control text-tertiary"
                @click="app.toggleModal('ongoingConverts')"
            >
                <fa icon="file-video" class="mr-2"></fa>
                {{ client.state.ongoingConverts.length }}
            </button>
            <input class="h-10 grow mousetrap form-control" type="text" :value="`/${folderList.join('/')}`" disabled />
            <div v-if="client.state.gallery.thumb" class="h-10">
                <a :href="client.state.gallery.thumb" target="_blank">
                    <img :src="client.state.gallery.thumb" class="h-full fit-content" />
                </a>
            </div>
        </div>

        <!-- Folder & Files -->
        <div class="px-2 grow overflow-y-auto scrollbar flex flex-col">
            <div class="mb-2 flex flex-col">
                <HoverCard v-if="folderList.length > 0" :selectable="true" :border-color="'rgb(var(--color-skygray-light))'">
                    <div class="cursor-pointer select-none px-4 py-2" @click="leaveFolder()">
                        <fa icon="arrow-left" class="mr-2" />
                    </div>
                </HoverCard>
                <HoverCard
                    v-for="folderName in client.state.gallery.folders"
                    :key="folderName"
                    :selectable="true"
                    :border-color="'rgb(var(--color-skygray-light))'"
                >
                    <div class="cursor-pointer select-none px-4 py-2 flex flex-nowrap" @click="enterFolder(folderName)">
                        <div class="basis-7">
                            <fa icon="folder" class="mr-2" />
                        </div>
                        <div :title="folderName" class="w-0 grow overflow-x-hidden text-ellipsis whitespace-nowrap">
                            {{ folderName }}
                        </div>
                    </div>
                </HoverCard>
            </div>
            <p v-if="isEmpty" class="py-4 text-center text-sm text-white/40">This folder is empty</p>
            <div class="flex flex-col">
                <HoverCard
                    v-for="file in client.state.gallery.files"
                    :key="file"
                    :selectable="true"
                    :selected="isFileSelected(file)"
                    :border-color="gallery.getFileColor(file)"
                >
                    <div class="group cursor-pointer select-none px-4 py-2 flex flex-nowrap" @click="toggleSelectFile(file)">
                        <div class="basis-7">
                            <fa :icon="gallery.getFileIcon(file)" class="mr-2" />
                        </div>
                        <div :title="file.name" class="w-0 grow overflow-x-hidden whitespace-nowrap text-ellipsis">
                            {{ file.name }}
                        </div>
                        <div class="basis-7 transition-all opacity-0 group-hover:opacity-100">
                            <GalleryFileDotMenu :folder-list="folderList" :file="file" />
                        </div>
                    </div>
                </HoverCard>
            </div>
        </div>

        <!-- Selected files -->
        <div v-if="selectedFiles.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-2">
            <span class="lg:col-span-2 flex flex-col justify-center text-center text-sm">
                {{ selectedFiles.length }} file{{ selectedFiles.length > 1 ? 's' : '' }} /
                <template v-if="addableSelectedFiles.length === 0"> no playable file selected </template>
                <template v-else>
                    {{ addableSelectedFiles.length }} playable file{{ addableSelectedFiles.length > 1 ? 's' : '' }} selected
                </template>
            </span>
            <button v-show="selectedFiles.length > 0" class="form-control px-2 text-sm" @click="clearSelectedFiles">Clear selected</button>
            <button v-show="addableSelectedFiles.length > 0" class="form-control px-2 text-sm" @click="addSelectedFiles">
                Add {{ addableSelectedFiles.length }} file{{ addableSelectedFiles.length > 1 ? 's' : '' }}
            </button>
        </div>
    </div>
</template>
