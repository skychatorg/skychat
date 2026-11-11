<script setup>
import { useClientStore } from '@/stores/client';
import { computed, ref, watch } from 'vue';
import draggable from 'vuedraggable';

const client = useClientStore();

const publicRooms = computed(() => client.state.rooms.filter((room) => !room.isPrivate));

// A local copy to drag around, refreshed whenever the server sends the list
const sortedRooms = ref([]);
watch(publicRooms, (rooms) => (sortedRooms.value = [...rooms]), { immediate: true });
const onMoved = () => client.sendMessage('/roomorder ' + sortedRooms.value.map((room) => room.id).join(','));

const newRoom = ref('');
const create = () => {
    const name = newRoom.value.trim();
    if (name) {
        client.sendMessage(`/roomcreate ${name}`);
        newRoom.value = '';
    }
};

/**
 * Room commands act on the room the admin is in: go there first, and wait for the server to confirm,
 * since commands sent right after a join could be handled before it
 */
const inRoom = (roomId, command) =>
    new Promise((resolve) => {
        if (client.state.currentRoomId === roomId) {
            client.sendMessage(command);
            resolve();
            return;
        }
        const stop = watch(
            () => client.state.currentRoomId,
            (id) => {
                if (id === roomId) {
                    stop();
                    client.sendMessage(command);
                    resolve();
                }
            },
        );
        client.join(roomId);
    });

// One room open for editing at a time
const editing = ref(null);
const edited = computed(() => publicRooms.value.find((room) => room.id === editing.value) ?? null);
const draft = ref({ name: '', minRight: '', limit: '' });
watch(edited, (room) => {
    if (room) {
        draft.value = { name: room.name, minRight: room.plugins.roomprotect ?? '', limit: room.plugins.messagelimiter ?? '' };
    }
});
const toggle = (room) => (editing.value = editing.value === room.id ? null : room.id);

// Risky buttons ask once more on the same button
const confirming = ref(null);
const confirmThen = (key, run) => {
    if (confirming.value !== key) {
        confirming.value = key;
        return;
    }
    confirming.value = null;
    run();
};

const rename = (room) => {
    const name = draft.value.name.trim();
    if (name && name !== room.name) {
        inRoom(room.id, `/roomset name ${name}`);
    }
};
const makeMain = (room) => inRoom(room.id, '/roomset main true');
const saveEntry = (room) => inRoom(room.id, `/roomprotect ${draft.value.minRight === '' ? 'off' : Number(draft.value.minRight)}`);
const saveLimit = (room) => inRoom(room.id, `/messagelimiter${draft.value.limit === '' ? '' : ` ${Number(draft.value.limit)}`}`);
const clearHistory = (room) => confirmThen(`clear-${room.id}`, () => inRoom(room.id, '/historyclear'));
const remove = (room) =>
    confirmThen(`delete-${room.id}`, () => {
        editing.value = null;
        inRoom(room.id, '/roomdelete');
    });
</script>

<template>
    <div class="flex flex-col gap-6 pb-6 text-skygray-lightest">
        <form class="flex gap-2 w-full max-w-md" @submit.prevent="create">
            <input v-model="newRoom" class="form-control grow min-w-0" placeholder="New room name" aria-label="New room name" type="text" />
            <button class="form-control" type="submit" :disabled="!newRoom.trim()">Create</button>
        </form>

        <div>
            <p class="mb-2 text-sm text-white/50">Drag rooms to change their order, click one to change it.</p>
            <draggable v-model="sortedRooms" item-key="id" handle=".grip" class="flex flex-col gap-2" @end="onMoved">
                <template #item="{ element: room }">
                    <div class="room" :class="{ open: editing === room.id }">
                        <div class="flex items-center gap-2">
                            <fa icon="grip-vertical" class="grip" title="Drag to reorder" />
                            <button
                                class="flex items-center gap-2 grow min-w-0 text-left"
                                :aria-expanded="editing === room.id"
                                @click="toggle(room)"
                            >
                                <span class="font-semibold truncate">{{ room.name }}</span>
                                <span v-if="room.main" class="badge">main</span>
                                <span v-if="room.plugins.roomprotect !== undefined" class="badge" title="Minimum right to enter">
                                    <fa icon="lock" /> right ≥ {{ room.plugins.roomprotect }}
                                </span>
                                <span v-if="room.plugins.messagelimiter" class="badge" title="Repeated characters limit">
                                    {{ room.plugins.messagelimiter }} repeats max
                                </span>
                            </button>
                            <fa :icon="editing === room.id ? 'chevron-up' : 'chevron-down'" class="text-white/40" />
                        </div>

                        <div v-if="editing === room.id" class="grid grid-cols-1 gap-4 mt-3 pt-3 border-t border-white/10">
                            <form class="field" @submit.prevent="rename(room)">
                                <label :for="`room-name-${room.id}`">Name</label>
                                <div class="flex gap-2">
                                    <input
                                        :id="`room-name-${room.id}`"
                                        v-model="draft.name"
                                        class="form-control grow min-w-0"
                                        type="text"
                                    />
                                    <button
                                        class="form-control"
                                        type="submit"
                                        :disabled="!draft.name.trim() || draft.name.trim() === room.name"
                                    >
                                        Rename
                                    </button>
                                </div>
                            </form>

                            <form class="field" @submit.prevent="saveEntry(room)">
                                <label :for="`room-right-${room.id}`">Who can enter</label>
                                <p v-if="room.main" class="hint">Everyone: the main room is always open.</p>
                                <div v-else class="flex gap-2 items-center">
                                    <input
                                        :id="`room-right-${room.id}`"
                                        v-model="draft.minRight"
                                        class="form-control w-28"
                                        type="number"
                                        min="-1"
                                        placeholder="anyone"
                                    />
                                    <button class="form-control" type="submit">Save</button>
                                </div>
                                <p v-if="!room.main" class="hint mt-1">The minimum right to enter. Empty: anyone.</p>
                            </form>

                            <form class="field" @submit.prevent="saveLimit(room)">
                                <label :for="`room-limit-${room.id}`">Repeated characters</label>
                                <div class="flex gap-2 items-center">
                                    <input
                                        :id="`room-limit-${room.id}`"
                                        v-model="draft.limit"
                                        class="form-control w-28"
                                        type="number"
                                        min="1"
                                        placeholder="no limit"
                                    />
                                    <button class="form-control" type="submit">Save</button>
                                </div>
                                <p class="hint mt-1">The most times a character may repeat in a row. Empty: no limit.</p>
                            </form>

                            <div class="flex flex-wrap gap-2">
                                <button v-if="!room.main" class="form-control" @click="makeMain(room)">Make it the main room</button>
                                <button class="form-control" @click="clearHistory(room)">
                                    {{ confirming === `clear-${room.id}` ? 'Click again to clear ($1)' : 'Clear history' }}
                                </button>
                                <button
                                    class="form-control danger"
                                    :disabled="room.main"
                                    :title="room.main ? 'Make another room the main one first' : ''"
                                    @click="remove(room)"
                                >
                                    {{ confirming === `delete-${room.id}` ? 'Click again to delete' : 'Delete room' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </draggable>
        </div>
    </div>
</template>

<style scoped>
.room {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: rgb(0 0 0 / 0.2);
    color: #fff;
}
.room.open {
    border-color: rgb(var(--color-primary) / 0.6);
}
.grip {
    cursor: grab;
    color: rgb(255 255 255 / 0.35);
    padding: 4px;
}
.badge {
    flex-shrink: 0;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    background: rgb(255 255 255 / 0.08);
    color: rgb(255 255 255 / 0.75);
}
.field label {
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 600;
}
.hint {
    font-size: 12px;
    color: rgb(255 255 255 / 0.5);
}
.danger {
    color: rgb(var(--color-danger-light));
}
</style>
