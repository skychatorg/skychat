<script setup>
import { watch, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import HoverCard from '@/components/util/HoverCard.vue';

const client = useClientStore();
const app = useAppStore();
</script>

<template>
    <ModalTemplate
        id="ongoingConverts"
        title="Ongoing converts"
    >

        <div class="text-center">
            <button
                @click="client.sendMessage('/convertlist')"
                class="form-control mb-4"
            >
                Update
            </button>
            <div>
                <HoverCard
                    v-for="ongoingConvert in client.state.ongoingConverts"
                    :key="ongoingConvert.target"
                    :selectable="false"
                    :selected="false"
                >
                    <div class="px-3 py-1 text-center flex flex-col">
                        <div>
                            {{ ongoingConvert.source.split('/').pop() }}
                        </div>
                        <div>
                            ⬇
                        </div>
                        <div>
                            {{ ongoingConvert.target.split('/').pop() }}
                        </div>
                        <hr class="my-4">
                        <div class="text-skygray-lightest">
                            {{ ongoingConvert.lastUpdate }}
                        </div>
                    </div>
                </HoverCard>
            </div>
        </div>
    </ModalTemplate>
</template>
