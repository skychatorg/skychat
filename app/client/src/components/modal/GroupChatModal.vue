<script setup>
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { useRoomCommand } from '@/composables/useRoomCommand';
import { roomName } from '@/lib/roomName';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref, watch } from 'vue';

const app = useAppStore();
const client = useClientStore();
const inRoom = useRoomCommand();

const me = computed(() => client.state.user.username.toLowerCase());
// Opened with a room: its members. Without one: a new conversation
const room = computed(() => client.state.rooms.find((r) => r.id === app.modals.groupChat?.roomId) ?? null);

// Accounts you could talk to, for the suggestions
const usernames = computed(() =>
    (client.state.connectedList ?? [])
        .map((entry) => entry.user)
        .filter((user) => user.right >= 0 && user.username.toLowerCase() !== me.value)
        .map((user) => user.username),
);

const typed = ref('');
const picked = ref([]);
watch(
    () => app.modals.groupChat,
    () => {
        typed.value = '';
        picked.value = [];
    },
);
const validName = computed(() => /^[a-z0-9-_]+$/i.test(typed.value.trim()));
const pick = () => {
    const name = typed.value.trim();
    if (validName.value && !picked.value.some((p) => p.toLowerCase() === name.toLowerCase())) {
        picked.value.push(name);
    }
    typed.value = '';
};
const start = () => {
    client.sendMessage(`/pmnew ${picked.value.join(' ')}`);
    app.closeModal('groupChat');
};

const add = () => {
    inRoom(room.value.id, `/pmadd ${typed.value.trim()}`);
    typed.value = '';
};
const remove = (identifier) => inRoom(room.value.id, `/pmremove ${identifier}`);
</script>

<template>
    <ModalTemplate
        id="groupChat"
        :title="room ? `Members of ${roomName(room, client.state.user.username)}` : 'New conversation'"
        variant="dialog"
    >
        <div class="flex flex-col gap-4 pb-4">
            <datalist id="group-usernames">
                <option v-for="name in usernames" :key="name" :value="name" />
            </datalist>

            <template v-if="room">
                <ul class="flex flex-col gap-1.5">
                    <li
                        v-for="identifier in room.whitelist"
                        :key="identifier"
                        class="flex items-center gap-2 p-2 rounded-lg hairline bg-white/[.02]"
                    >
                        <span class="grow truncate">{{ identifier }}{{ identifier === me ? ' (you)' : '' }}</span>
                        <button v-if="identifier !== me" class="form-control text-sm" @click="remove(identifier)">Remove</button>
                    </li>
                </ul>
                <form class="flex gap-2" @submit.prevent="add">
                    <input
                        v-model="typed"
                        class="form-control grow min-w-0"
                        list="group-usernames"
                        placeholder="Add someone"
                        aria-label="Username to add"
                        autocomplete="off"
                    />
                    <button class="form-control" type="submit" :disabled="!validName">Add</button>
                </form>
            </template>

            <template v-else>
                <p class="text-sm text-white/55">A private conversation with one or more people. Anyone in it can add others.</p>
                <form class="flex gap-2" @submit.prevent="pick">
                    <input
                        v-model="typed"
                        class="form-control grow min-w-0"
                        list="group-usernames"
                        placeholder="Username"
                        aria-label="Username"
                        autocomplete="off"
                    />
                    <button class="form-control" type="submit" :disabled="!validName">Add</button>
                </form>
                <ul v-if="picked.length" class="flex flex-wrap gap-2">
                    <li
                        v-for="(name, index) in picked"
                        :key="name"
                        class="flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-primary/15 text-sm"
                    >
                        {{ name }}
                        <button
                            class="w-6 h-6 rounded-full hover:bg-white/10"
                            :aria-label="`Remove ${name}`"
                            @click="picked.splice(index, 1)"
                        >
                            <fa icon="xmark" />
                        </button>
                    </li>
                </ul>
                <button class="form-control self-end px-4" :disabled="!picked.length" @click="start">Start the conversation</button>
            </template>
        </div>
    </ModalTemplate>
</template>
