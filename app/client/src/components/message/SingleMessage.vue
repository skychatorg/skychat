<script setup>
import { nextTick, computed, onMounted, defineEmits, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import UserBigAvatar from '@/components/user/UserBigAvatar.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';

const app = useAppStore();
const client = useClientStore();

const emit = defineEmits(['content-size-changed']);

const props = defineProps({
    message: {
        type: Object,
        required: true,
    },
    selectable: {
        type: Boolean,
        default: true,
    },
    compact: {
        type: Boolean,
        default: false,
    },
});

const content = ref(null);

// Shown date
const formattedDate = computed(() => {
    const date = new Date(props.message.createdTimestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
});

// Room name
const room = computed(() => {
    const room = client.state.rooms.find(room => room.id === props.message.room);
    if (! room) {
        return null;
    }
    return room;
});

// Users whose last seen message is this message
const lastSeenUsers = computed(() => {
    return (client.state.messageIdToLastSeenUsers[props.message.id] || []).slice(0, 6);
});

// listen for events for buttons
const bindMessageContentEvents = () => {


    // Images
    const images = Array.from(content.value.getElementsByTagName('img'));
    for (const image of images) {
        image.addEventListener('load', () => {
            emit('content-size-changed');
        });
    }

    // Get buttons
    const buttons = Array.from(content.value.getElementsByClassName('skychat-button'));
    for (const button of buttons) {
        button.addEventListener('click', () => {
            if (button.dataset.action[0] === '/' && button.dataset.trusted === 'false' && ! confirm('Send "' + button.dataset.action + '"?')) {
                return;
            }
            client.sendMessage(button.dataset.action);
        });
    }
};
onMounted(bindMessageContentEvents);
watch(() => props.message.formatted, () => nextTick(bindMessageContentEvents));

// When interacting with a message
const messageInteract = () => {

    // Cycle between these texts
    const editText = '/edit ' + props.message.id + ' ' + props.message.content;
    const deleteText = '/delete ' + props.message.id;
    const quoteText = '@' + props.message.id + ' ';
    const rotation = [quoteText, editText, deleteText];

    // Find whether we have one of these text set already & Decide new text
    const currentPosition = rotation.indexOf(app.newMessage);
    const newPosition = (currentPosition + 1) % rotation.length;

    // Set new text & Focus on input
    app.setMessage(rotation[newPosition]);
};

</script>

<template>
    <HoverCard
        :borderColor="message.user.data.plugins.custom.color"
        :selectable="selectable"
        :selected="false"
        @contextmenu.prevent="messageInteract"
    >
        <div class="py-1 px-3 flex flex-row">

            <UserBigAvatar
                v-if="! compact"
                class="mt-1"
                :user="message.user"
            />

            <div class="grow pl-4">
                <!-- First row -->
                <div class="flex">
                    <div
                        class="font-bold"
                        :style="{
                            color: message.user.data.plugins.custom.color,
                        }"
                    >
                        {{ message.user.username }}
                        <sup v-if="message.meta.device === 'mobile'">
                            <fa icon="mobile-screen" class="ml-1" />
                        </sup>
                    </div>
                    <div v-if="compact" class="text-skygray-lightest text-xs pt-1 ml-2">
                        {{ formattedDate }}
                        <template v-if="room">
                            @ {{ room.name }}
                        </template>
                    </div>
                </div>
                <!-- Quoted message -->
                <SingleMessage
                    v-if="message.quoted"
                    :message="message.quoted"
                    :selectable="false"
                    :compact="true"
                    class="mt-2 mb-4 opacity-75"
                />
                <!-- Message content -->
                <div
                    class="text-skygray-white w-0 min-w-full whitespace-pre-wrap overflow-hidden break-words"
                    v-html="message.formatted"
                    ref="content"
                ></div>
            </div>

            <div v-if="! compact" class="basis-16 w-16 flex flex-col text-center">
                <span class="grow text-xs text-skygray-lightest">
                    {{ formattedDate }}
                </span>
                <UserMiniAvatarCollection
                    :users="lastSeenUsers"
                    class="my-2"
                />
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>
</style>
