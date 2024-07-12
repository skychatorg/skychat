<script setup>
import { useGallery } from '@/lib/Gallery';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';

const app = useAppStore();
const client = useClientStore();
const gallery = useGallery();

const props = defineProps({
    folderList: {
        type: Array,
        default: () => [],
    },
    file: {
        type: Object,
        required: true,
    },
});

// Actions
const open = () => {
    window.open(`/gallery/${gallery.getFileNamePath(props.folderList, props.file.name)}`);
};
const convert = () => {
    app.toggleModal('videoConverter', { filePath: gallery.getFileNamePath(props.folderList, props.file.name) });
};
const rm = () => {
    client.sendMessage(`/galleryrm ${gallery.getFileNamePath(props.folderList, props.file.name)}`);
};
</script>

<template>
    <div class="file-dot-menu relative" @click.stop="">
        <div target="_blank" class="px-2">
            <fa icon="ellipsis-vertical" />
        </div>
        <div class="menu absolute mt-0 bg-skygray-darker rounded-lg z-50">
            <ul class="text-center text-xs">
                <!-- Open file -->
                <li class="rounded cursor-pointer py-2 px-4 hover:bg-skygray-dark" title="Open in new tab" @click.stop="open">
                    <fa icon="arrow-up-right-from-square" class="mr-1" /> Open
                </li>

                <!-- Convert -->
                <li
                    v-if="['mkv'].includes(gallery.getFileExtension(file.name))"
                    class="rounded cursor-pointer py-2 px-4 hover:bg-skygray-dark"
                    title="Convert file"
                    @click.stop="convert"
                >
                    <fa icon="file-video" class="mr-1" /> Convert
                </li>

                <!-- Delete -->
                <li class="rounded cursor-pointer py-2 px-4 hover:bg-skygray-dark" title="Delete file" @click.stop="rm">
                    <fa icon="xmark" class="mr-1" /> Delete
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.file-dot-menu .menu {
    display: none;
}
.file-dot-menu:hover .menu {
    display: block;
}
.menu {
    /* Custom styling to align it perfectly */
    left: -66px;
    width: 110px;
}
</style>
