<script setup>
import UserBigAvatar from '@/components/user/UserBigAvatar.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import ExpandableBlock from '@/components/util/ExpandableBlock.vue';
import HoverCard from '@/components/util/HoverCard.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useEncryptionStore } from '@/stores/encryption';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import MessageReactionAdd from './MessageReactionAdd.vue';
import MessageReactions from './MessageReactions.vue';

const app = useAppStore();
const client = useClientStore();
const encryptionStore = useEncryptionStore();

const COMPACT_QUOTES_MAX_LENGTH = 30;

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
    showDate: {
        type: Boolean,
        default: false,
    },
});

// Content ref
const content = ref(null);

// Force expand (quotes)
const forceExpand = ref(false);
const showCompact = computed(() => {
    return props.compact && !forceExpand.value;
});
watch(showCompact, () => {
    nextTick(() => {
        emit('content-size-changed');
    });
});

const isBlacklisted = computed(() => {
    if (!client.state.user) {
        return false;
    }
    const blacklist = client.state.user.data.plugins.blacklist || [];
    return blacklist.includes(props.message.user.username.toLowerCase());
});

// Shown dates
const formattedDate = computed(() => {
    // Show "today" if today
    // Show "yesterday" if yesterday
    // Show "Month day" if this year
    // Show "Month day, year" if not this year
    const date = new Date(props.message.createdTimestamp * 1000);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    if (date.getFullYear() === today.getFullYear()) {
        return date.toLocaleString('default', { month: 'long', day: 'numeric' });
    }
    return date.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' });
});
const formattedTime = computed(() => {
    // Show time as "HH:MM:SS"
    const date = new Date(props.message.createdTimestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
});

// Room name
const room = computed(() => {
    const room = client.state.rooms.find((room) => room.id === props.message.room);
    if (!room) {
        return null;
    }
    return room;
});

// Users whose last seen message is this message
const lastSeenUsers = computed(() => {
    return (client.state.messageIdToLastSeenUsers[props.message.id] || []).slice(0, 6);
});

const encryptionLabel = computed(() => {
    return props.message.meta?.encryptionLabel || props.message.storage?.e2ee?.label || null;
});

const encryptionWarning = computed(() => {
    if (!props.message.meta?.encrypted) {
        return null;
    }
    if (!props.message.meta?.decryptionError) {
        return encryptionLabel.value ? `Encrypted message (${encryptionLabel.value})` : 'Encrypted message';
    }
    if (props.message.meta.decryptionError === 'missing-key') {
        return 'Encrypted message. Enter the shared passphrase to view it.';
    }
    if (props.message.meta.decryptionError === 'invalid-key') {
        return 'Encrypted message. The provided passphrase was rejected.';
    }
    return 'Encrypted message.';
});

const shouldShowUnlockForm = computed(() => {
    return props.message.meta?.encrypted && Boolean(props.message.meta?.decryptionError);
});

const unlockPassphrase = ref('');
const unlockError = ref('');
const unlocking = ref(false);

const unlockEncryptedMessage = async () => {
    if (!shouldShowUnlockForm.value || unlockPassphrase.value.trim().length === 0) {
        unlockError.value = 'Passphrase is required.';
        return;
    }
    unlocking.value = true;
    unlockError.value = '';
    const success = await encryptionStore.unlockMessage(
        props.message,
        unlockPassphrase.value.trim(),
        encryptionLabel.value || null,
    );
    if (success) {
        unlockPassphrase.value = '';
    } else {
        unlockError.value = 'Unable to decrypt this message with that passphrase.';
    }
    unlocking.value = false;
};

watch(
    () => props.message.meta?.decryptionError,
    (value) => {
        if (!value) {
            unlockPassphrase.value = '';
            unlockError.value = '';
        }
    },
);

watch(unlockPassphrase, () => {
    if (unlockError.value) {
        unlockError.value = '';
    }
});

// listen for events for buttons
const bindMessageContentEvents = () => {
    if (!content.value) {
        return;
    }

    emit('content-size-changed');

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
            if (
                button.dataset.action[0] === '/' &&
                button.dataset.trusted !== 'true' &&
                !confirm('Send "' + button.dataset.action + '"?')
            ) {
                return;
            }
            client.sendMessage(button.dataset.action);
        });
    }

    // Quotes
    const quotes = Array.from(content.value.getElementsByClassName('skychat-quote'));
    for (const quote of quotes) {
        quote.addEventListener('click', () => {
            app.setMessage('@' + quote.dataset.username + ' ');
        });
    }
};
onMounted(bindMessageContentEvents);
watch(
    () => props.message.formatted,
    () => nextTick(bindMessageContentEvents),
);

watch(
    () => props.message.storage?.reactions,
    () => nextTick(() => emit('content-size-changed')),
);

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
    <ExpandableBlock
        :force-expand="message.user.username.toLowerCase() === client.state.user?.username.toLowerCase()"
        @content-size-changed="() => emit('content-size-changed')"
    >
        <HoverCard
            :border-color="message.user.data.plugins.custom.color"
            :selectable="selectable"
            :selected="false"
            :use-border-radius="false"
            :class="{
                blacklisted: isBlacklisted,
            }"
            class="group relative flex flex-row"
            @contextmenu.prevent="messageInteract"
        >
            <div v-if="showDate" class="absolute w-full text-center text-xs">
                <span class="border px-2 py-1/2 rounded-full">
                    {{ formattedDate }}
                </span>
            </div>

            <div v-if="!compact" class="hidden group-hover:block absolute right-[80px] top-0">
                <MessageReactionAdd :message-id="message.id" />
            </div>

            <div v-if="!isBlacklisted" class="py-1 px-3 flex flex-row">
                <UserBigAvatar v-if="!compact" class="mt-1" :user="message.user" />

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
                            <sup
                                v-if="isBlacklisted"
                                title="This user is blacklisted. Click to remove from blacklist."
                                @click.stop="client.sendMessage('/unblacklist ' + entry.user.username)"
                            >
                                <fa icon="ban" class="text-danger" />
                            </sup>
                            <sup v-if="message.meta.device === 'mobile'">
                                <fa icon="mobile-screen" class="ml-1" />
                            </sup>
                        </div>
                        <div v-if="compact" class="text-skygray-lightest text-xs pt-1 ml-2">
                            {{ formattedTime }}
                            <template v-if="room"> @ {{ room.name }} </template>
                        </div>
                    </div>

                    <!-- Quoted message -->
                    <SingleMessage
                        v-if="message.quoted"
                        :message="message.quoted"
                        :selectable="false"
                        :compact="true"
                        :force-expand="true"
                        class="mt-2 mb-4 opacity-75"
                    />

                    <!-- Message content -->
                    <template v-if="showCompact">
                        <div class="text-skygray-white w-0 min-w-full">
                            <template v-if="message.content.length < COMPACT_QUOTES_MAX_LENGTH">
                                {{ message.content }}
                            </template>
                            <template v-else>
                                {{ message.content.substr(0, COMPACT_QUOTES_MAX_LENGTH) }}
                                <button class="skychat-button" @click="forceExpand = true">...</button></template
                            >
                        </div>
                    </template>
                    <template v-else>
                        <div v-if="encryptionWarning" class="text-xs text-primary flex items-center mb-2">
                            <fa icon="lock" class="mr-2" />
                            <span>{{ encryptionWarning }}</span>
                        </div>
                        <div v-if="shouldShowUnlockForm" class="mb-3 text-xs">
                            <div class="flex flex-col gap-2 lg:flex-row">
                                <input
                                    v-model="unlockPassphrase"
                                    type="password"
                                    class="form-control w-full"
                                    placeholder="Enter passphrase"
                                    @keydown.enter.prevent="unlockEncryptedMessage"
                                />
                                <button class="form-control lg:w-32" :disabled="unlocking" @click="unlockEncryptedMessage">
                                    {{ unlocking ? 'Unlocking…' : 'Unlock' }}
                                </button>
                            </div>
                            <p v-if="unlockError" class="text-danger mt-2">{{ unlockError }}</p>
                        </div>
                        <div
                            ref="content"
                            class="text-skygray-white w-0 min-w-full whitespace-pre-wrap overflow-hidden break-words"
                            v-html="message.formatted"
                        />
                    </template>
                </div>

                <div v-if="!showCompact" class="basis-16 w-16 flex flex-col text-center">
                    <span class="grow text-xs text-skygray-lightest">
                        {{ formattedTime }}
                    </span>
                    <UserMiniAvatarCollection :users="lastSeenUsers" class="my-2" />
                </div>
            </div>
            <div v-else class="flex pl-6 items-center">
                <UserMiniAvatar :user="message.user" class="mr-2" />
                <div class="text-skygray-lighter">
                    <a class="cursor-pointer hover:underline" @click.stop="client.sendMessage('/unblacklist ' + message.user.username)">
                        Unblacklist {{ message.user.username }} to see his messages
                    </a>
                </div>
            </div>

            <MessageReactions v-if="message.storage.reactions && !compact" :message="message" />
        </HoverCard>
    </ExpandableBlock>
</template>
