<script setup>
import { computed, ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useGallery } from '@/lib/Gallery';
import HoverCard from '@/components/util/HoverCard.vue';

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
                <li class="rounded cursor-pointer py-2 px-4 hover:bg-skygray-dark" @click.stop="open" title="Open in new tab"><fa icon="arrow-up-right-from-square" class="mr-1" /> Open</li>

                <!-- Convert -->
                <li class="rounded cursor-pointer py-2 px-4 hover:bg-skygray-dark" @click.stop="convert" v-if="['mkv'].includes(gallery.getFileExtension(file.name))" title="Convert file">
                    <fa icon="file-video" class="mr-1" /> Convert
                </li>

                <!-- Delete -->
                <li class="rounded cursor-pointer py-2 px-4 hover:bg-skygray-dark" @click.stop="rm" title="Delete file"><fa icon="xmark" class="mr-1" /> Delete</li>
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
