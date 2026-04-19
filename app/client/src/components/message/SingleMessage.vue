<script setup>
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';
import { useIsBlacklisted } from '@/composables/useIsBlacklisted';
import { useUserRight } from '@/composables/useUserRight';
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

// Action menu state
const showActionMenu = ref(false);
const actionMenuContainer = ref(null);
const reactionPickerOpen = ref(false);

const anyMenuOpen = computed(() => showActionMenu.value || reactionPickerOpen.value);

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

const isBlacklisted = useIsBlacklisted(() => props.message.user);

const formattedDate = computed(() => {
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
    const date = new Date(props.message.createdTimestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
});

const room = computed(() => {
    const r = client.state.rooms.find((room) => room.id === props.message.room);
    return r || null;
});

const lastSeenUsers = computed(() => {
    return (client.state.messageIdToLastSeenUsers[props.message.id] || []).slice(0, 6);
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
    const success = await encryptionStore.unlockMessage(props.message, unlockPassphrase.value.trim());
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

const bindMessageContentEvents = () => {
    if (!content.value) {
        return;
    }
    emit('content-size-changed');

    const images = Array.from(content.value.getElementsByTagName('img'));
    for (const image of images) {
        image.addEventListener('load', () => {
            emit('content-size-changed');
        });
    }

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

    const quotes = Array.from(content.value.getElementsByClassName('skychat-quote'));
    for (const quote of quotes) {
        quote.addEventListener('click', () => {
            app.setMessage('@' + quote.dataset.username + ' ');
        });
    }
};
onMounted(() => {
    bindMessageContentEvents();
    document.addEventListener('click', (event) => {
        if (showActionMenu.value && actionMenuContainer.value && !actionMenuContainer.value.contains(event.target)) {
            showActionMenu.value = false;
        }
    });
});
watch(
    () => props.message.formatted,
    () => nextTick(bindMessageContentEvents),
);

watch(
    () => props.message.storage?.reactions,
    () => nextTick(() => emit('content-size-changed')),
);

const isAutomatedMessage = computed(() => props.message.id === 0);

const canEditMessage = computed(() => {
    if (isAutomatedMessage.value) return false;
    return props.message.user.username.toLowerCase() === client.state.user?.username.toLowerCase();
});

const canModerate = useUserRight('minRightForUserModeration');

const canDeleteMessage = computed(() => {
    if (isAutomatedMessage.value) return false;
    return canEditMessage.value || canModerate.value;
});

const quoteMessage = () => {
    app.setMessage('@' + props.message.id + ' ');
    showActionMenu.value = false;
};

const editMessage = () => {
    if (!canEditMessage.value) return;
    app.setMessage('/edit ' + props.message.id + ' ' + props.message.content);
    showActionMenu.value = false;
};

const deleteMessage = () => {
    if (!canDeleteMessage.value) return;
    if (confirm('Delete this message?')) {
        client.sendMessage('/delete ' + props.message.id);
    }
    showActionMenu.value = false;
};

const copyMessage = () => {
    navigator.clipboard.writeText(props.message.content);
    showActionMenu.value = false;
};

const toggleActionMenu = () => {
    showActionMenu.value = !showActionMenu.value;
};

const userColor = computed(() => props.message.user.data.plugins.custom.color);
</script>

<template>
    <!-- Day separator pill -->
    <div v-if="showDate && !compact" class="px-4 pt-4 pb-1 flex items-center justify-center gap-2">
        <div class="h-px flex-1 bg-white/5"></div>
        <div class="font-mono text-xs uppercase tracking-wider text-white/40 px-2">{{ formattedDate }}</div>
        <div class="h-px flex-1 bg-white/5"></div>
    </div>

    <div
        class="group relative flex transition"
        :class="[
            compact ? 'gap-2' : 'gap-3 px-4 py-1',
            isBlacklisted ? 'opacity-50' : 'hover:bg-white/[.02]',
            isAutomatedMessage ? 'opacity-60 italic' : '',
        ]"
    >
        <!-- Blacklisted compact view -->
        <template v-if="isBlacklisted">
            <UserMiniAvatar :user="message.user" />
            <a
                class="text-skygray-lighter cursor-pointer hover:underline text-sm"
                @click.stop="client.sendMessage('/unblacklist ' + message.user.username)"
            >
                Unblacklist {{ message.user.username }} to see his messages
            </a>
        </template>

        <template v-else>
            <!-- Avatar column -->
            <div
                v-if="!compact"
                class="w-7 h-7 shrink-0 mt-[2px] rounded overflow-hidden bg-black border-2"
                :style="{ borderColor: userColor }"
                :title="message.user.username"
            >
                <img :src="message.user.data.plugins.avatar" :alt="message.user.username" class="h-full w-full object-cover" />
            </div>

            <div class="flex-1 min-w-0">
                <!-- Header row -->
                <div v-if="!compact" class="flex items-baseline gap-2 mb-0.5">
                    <span class="font-semibold text-sm" :style="{ color: userColor }">
                        {{ message.user.username }}
                    </span>
                    <span v-if="message.user.right > 0" class="font-mono text-xs text-white/30" :title="`Level ${message.user.right}`">
                        {{ message.user.right }}
                    </span>
                    <fa v-if="message.meta.device === 'mobile'" icon="mobile-screen" class="text-xs text-white/40" />
                    <span class="font-mono text-xs text-white/35">{{ formattedTime }}</span>
                </div>
                <div v-else class="flex items-baseline gap-2 mb-0.5">
                    <span class="font-semibold text-sm" :style="{ color: userColor }">
                        {{ message.user.username }}
                    </span>
                    <span class="font-mono text-xs text-white/35">
                        {{ formattedTime }}<template v-if="room"> @ {{ room.name }}</template>
                    </span>
                </div>

                <!-- Quoted message -->
                <div
                    v-if="message.quoted && !compact"
                    class="my-2 pl-2 border-l-[3px] opacity-75"
                    :style="{ borderColor: message.quoted.user.data.plugins.custom.color }"
                >
                    <SingleMessage :message="message.quoted" :selectable="false" :compact="true" />
                </div>

                <!-- Encrypted unlock form -->
                <template v-if="!showCompact && shouldShowUnlockForm">
                    <div class="text-xs text-primary flex items-center mb-2 italic">
                        <fa icon="lock" class="mr-2" />
                        <span>{{ message.meta.encryptionLabel ?? 'Encrypted message' }}</span>
                    </div>
                    <div class="mb-3 text-xs">
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
                </template>

                <!-- Compact body (used inside quoted nested view) -->
                <div v-if="showCompact" class="text-skygray-white text-sm truncate">
                    <template v-if="message.content.length < COMPACT_QUOTES_MAX_LENGTH">
                        {{ message.content }}
                    </template>
                    <template v-else>
                        {{ message.content.substr(0, COMPACT_QUOTES_MAX_LENGTH) }}
                        <button class="skychat-button" @click="forceExpand = true">...</button>
                    </template>
                </div>

                <!-- Full message body -->
                <div
                    v-else-if="!shouldShowUnlockForm"
                    ref="content"
                    class="text-base text-white/90 leading-[1.45] whitespace-pre-wrap break-words"
                    v-html="message.formatted"
                />

                <!-- Reactions -->
                <MessageReactions v-if="!compact && message.storage?.reactions" :message="message" />
            </div>

            <!-- Right column: time + last-seen avatars (non-compact) -->
            <div v-if="!compact && lastSeenUsers.length > 0" class="shrink-0 flex flex-col items-end gap-1">
                <div class="flex -space-x-1.5">
                    <UserMiniAvatar v-for="user in lastSeenUsers" :key="user.username" :user="user" />
                </div>
            </div>

            <!-- Hover toolbar -->
            <div
                v-if="!compact && !isAutomatedMessage"
                class="absolute -top-3 right-6 transition flex items-center gap-0.5 rounded-lg hairline p-0.5 z-20"
                :class="anyMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                :style="{ background: 'var(--surface-2)' }"
            >
                <MessageReactionAdd :message-id="message.id" @picker-toggle="reactionPickerOpen = $event" />
                <button
                    title="Reply / quote"
                    class="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 rounded-md text-sm"
                    @click="quoteMessage"
                >
                    <fa icon="reply" />
                </button>
                <div ref="actionMenuContainer" class="relative">
                    <button
                        title="More actions"
                        class="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 rounded-md text-sm"
                        @click="toggleActionMenu"
                    >
                        <fa icon="ellipsis" />
                    </button>
                    <div v-show="showActionMenu" class="absolute right-0 top-9 form-control p-1 flex flex-col gap-1 z-50 min-w-max">
                        <button
                            v-if="canEditMessage"
                            class="form-control w-full h-8 flex items-center gap-2 px-3 text-sm"
                            @click="editMessage"
                        >
                            <fa icon="pen-to-square" class="w-4" />
                            <span>Edit</span>
                        </button>
                        <button
                            v-if="canDeleteMessage"
                            class="form-control w-full h-8 flex items-center gap-2 px-3 text-sm text-danger"
                            @click="deleteMessage"
                        >
                            <fa icon="trash" class="w-4" />
                            <span>Delete</span>
                        </button>
                        <button class="form-control w-full h-8 flex items-center gap-2 px-3 text-sm" @click="copyMessage">
                            <fa icon="copy" class="w-4" />
                            <span>Copy</span>
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
