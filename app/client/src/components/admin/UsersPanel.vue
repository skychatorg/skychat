<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';

const app = useAppStore();
const client = useClientStore();

// The user menu's "Set right" opens this tab filtered on that user
const search = ref(app.modals.admin?.username ?? '');

// Accounts only: guests have no right to change
const users = computed(() =>
    (client.state.connectedList ?? [])
        .map((entry) => entry.user)
        .filter((user) => user.right >= 0 && user.username.toLowerCase().includes(search.value.trim().toLowerCase()))
        .sort((a, b) => b.right - a.right || a.username.localeCompare(b.username)),
);

// Without OP, the server only lets you change people below you, and up to just below you
const myRight = computed(() => client.state.user.right);
const canEdit = (user) => client.state.op || user.right < myRight.value;
const maxRight = computed(() => (client.state.op ? undefined : myRight.value - 1));

const drafts = ref({});
const draft = (user) => drafts.value[user.username] ?? user.right;
const changed = (user) => draft(user) !== '' && Number(draft(user)) !== user.right;
const save = (user) => {
    client.sendMessage(`/setright ${user.username} ${Number(draft(user))}`);
    delete drafts.value[user.username];
};
</script>

<template>
    <div class="flex flex-col gap-4 pb-6 text-white">
        <input v-model="search" class="form-control w-full max-w-md" placeholder="Find a user" aria-label="Find a user" type="search" />
        <p class="text-sm text-white/50">
            Each user's right is the number on their line. Rights unlock features set in the server preferences, new accounts start at 0.
            <template v-if="!client.state.op">You can change the rights of users below yours, up to {{ myRight - 1 }}.</template>
        </p>
        <ul v-if="users.length" class="flex flex-col gap-2">
            <li v-for="user in users" :key="user.username" class="row">
                <span class="font-semibold truncate grow min-w-0">{{ user.username }}</span>
                <form class="flex items-center gap-2 shrink-0" @submit.prevent="save(user)">
                    <label class="sr-only" :for="`right-${user.username}`">Right of {{ user.username }}</label>
                    <input
                        :id="`right-${user.username}`"
                        :value="draft(user)"
                        class="form-control w-16 text-center"
                        type="number"
                        min="0"
                        :max="maxRight"
                        :disabled="!canEdit(user)"
                        @input="drafts[user.username] = $event.target.value"
                    />
                    <button class="form-control" type="submit" :disabled="!canEdit(user) || !changed(user)">Save</button>
                </form>
            </li>
        </ul>
        <p v-else class="text-sm text-white/50">No user matches.</p>
    </div>
</template>

<style scoped>
.row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: rgb(0 0 0 / 0.2);
}
</style>
