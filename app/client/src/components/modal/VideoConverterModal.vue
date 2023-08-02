<script setup>
import { watch, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import SectionSubTitle from '@/components/util/SectionSubTitle.vue';

const client = useClientStore();
const app = useAppStore();

// When opened, load video stream info
watch(
    () => app.modals.videoConverter,
    () => {
        if (!app.modals.videoConverter) {
            return;
        }
        client.sendMessage(`/convertinfo ${app.modals.videoConverter.filePath}`);
    },
);

// List of selected stream indexes
const selectedStreamIndexes = ref([]);
const isStreamIndexSelected = (index) => selectedStreamIndexes.value.includes(index);
watch(
    () => client.state.videoStreamInfo,
    () => {
        const videoStreamInfo = client.state.videoStreamInfo;
        if (!videoStreamInfo) {
            return;
        }

        // Update selected streams
        const newSelectedStreams = [];
        const firstVideoStream = videoStreamInfo.find((stream) => stream.type === 'Video');
        const firstAudioStream = videoStreamInfo.find((stream) => stream.type === 'Audio');
        firstVideoStream && newSelectedStreams.push(firstVideoStream.index);
        firstAudioStream && newSelectedStreams.push(firstAudioStream.index);
        selectedStreamIndexes.value = newSelectedStreams;
    },
);
const toggleStreamIndexSelected = (index) => {
    if (isStreamIndexSelected(index)) {
        selectedStreamIndexes.value = selectedStreamIndexes.value.filter((i) => i !== index);
    } else {
        selectedStreamIndexes.value.push(index);
    }
};

// Convert
const convert = () => {
    if (selectedStreamIndexes.value.length === 0) {
        return;
    }
    client.sendMessage(`/convert ${app.modals.videoConverter.filePath} ${selectedStreamIndexes.value.join(',')}`);
    app.toggleModal('ongoingConverts');
};
</script>

<template>
    <ModalTemplate id="videoConverter" title="Video converter">
        <template v-if="!client.state.videoStreamInfo"> loading.. </template>
        <template v-else>
            <div class="text-center">
                <SectionSubTitle class="mt-5">Source</SectionSubTitle>
                <p class="mx-4">/{{ app.modals.videoConverter.filePath }}</p>

                <SectionSubTitle class="mt-5">Streams</SectionSubTitle>
                <HoverCard
                    v-for="stream in client.state.videoStreamInfo"
                    :key="stream.index"
                    :selectable="true"
                    :selected="isStreamIndexSelected(stream.index)"
                    :border-color="'rgb(var(--color-skygray-light))'"
                    @click="toggleStreamIndexSelected(stream.index)"
                >
                    <div class="px-4 py-2 cursor-pointer text-left flex">
                        <span class="fw-bold w-6">{{ stream.index }}</span>
                        <span class="grow w-0 overflow-x-hidden text-ellipsis">{{ stream.type }}</span>
                        <span v-if="stream.lang">{{ stream.lang }}</span>
                        <fa icon="info" class="ml-3 mt-1" :title="stream.info" />
                    </div>
                </HoverCard>

                <template v-if="selectedStreamIndexes.length > 0">
                    <SectionSubTitle class="mt-5">Convert to MP4</SectionSubTitle>
                    <button @click="convert" class="form-control w-2/3 mx-auto">Convert</button>
                </template>
            </div>
        </template>
    </ModalTemplate>
</template>
