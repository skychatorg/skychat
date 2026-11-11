<script setup>
import { useClientStore } from '@/stores/client';
import { computed, onMounted, ref } from 'vue';

const client = useClientStore();

onMounted(() => client.sendMessage('/bunker status'));
const bunker = computed(() => client.state.bunker);
const toggleBunker = () => client.sendMessage(`/bunker ${bunker.value ? 'off' : 'on'}`);

// What each action answered: the server replies in the chat, hidden behind this panel
const done = ref({});
const run = (key, command) => {
    client.sendMessage(command);
    done.value = { ...done.value, [key]: true };
    setTimeout(() => (done.value = { ...done.value, [key]: false }), 3000);
};

const usernames = computed(() =>
    (client.state.connectedList ?? [])
        .map((entry) => entry.user)
        .filter((user) => user.right >= 0)
        .map((user) => user.username),
);
const gift = ref({ username: '', dollars: 10 });
const canGive = computed(() => /^[a-z0-9-_]+$/i.test(gift.value.username.trim()) && gift.value.dollars > 0);
const give = () => {
    // Money is counted in cents
    run('money', `/offermoney ${gift.value.username.trim()} ${Math.round(gift.value.dollars * 100)}`);
    gift.value.username = '';
};
</script>

<template>
    <div class="flex flex-col gap-4 pb-6 text-white max-w-xl">
        <section class="card">
            <div class="flex items-center gap-3">
                <div class="grow">
                    <h3 class="font-semibold">Lockdown</h3>
                    <p class="hint">Guests can't send messages or speak in voice while it is on.</p>
                </div>
                <button
                    class="form-control shrink-0"
                    :class="{ on: bunker }"
                    :aria-pressed="Boolean(bunker)"
                    :disabled="bunker === null"
                    @click="toggleBunker"
                >
                    <fa :icon="bunker ? 'lock' : 'unlock'" class="mr-1.5" />{{ bunker === null ? '…' : bunker ? 'On' : 'Off' }}
                </button>
            </div>
        </section>

        <form class="card" @submit.prevent="give">
            <h3 class="font-semibold">Give money</h3>
            <p class="hint">Created out of nothing, not taken from you.</p>
            <div class="flex flex-wrap gap-2 mt-2">
                <input
                    v-model="gift.username"
                    class="form-control grow min-w-0"
                    list="server-usernames"
                    placeholder="username"
                    aria-label="Username"
                    autocomplete="off"
                    type="text"
                />
                <datalist id="server-usernames">
                    <option v-for="name in usernames" :key="name" :value="name" />
                </datalist>
                <label class="flex items-center gap-1">
                    <span>$</span>
                    <input
                        v-model.number="gift.dollars"
                        class="form-control w-24"
                        type="number"
                        min="0.01"
                        step="0.01"
                        aria-label="Amount in dollars"
                    />
                </label>
                <button class="form-control" type="submit" :disabled="!canGive">{{ done.money ? 'Sent' : 'Give' }}</button>
            </div>
        </form>

        <section class="card">
            <h3 class="font-semibold">Maintenance</h3>
            <div class="flex flex-wrap gap-2 mt-2">
                <button class="form-control" @click="run('summary', '/dailysummary')">
                    {{ done.summary ? 'Posted' : 'Post the daily summary now' }}
                </button>
                <button class="form-control" @click="run('reload', '/adminconfig reload')">
                    {{ done.reload ? 'Reloaded' : 'Reload the preferences' }}
                </button>
                <button class="form-control" @click="run('backup', '/backup')">{{ done.backup ? 'Started' : 'Back up now' }}</button>
            </div>
            <p class="hint mt-2">Each answer shows in the chat once you close this panel.</p>
        </section>
    </div>
</template>

<style scoped>
.card {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: rgb(0 0 0 / 0.2);
}
.hint {
    font-size: 13px;
    color: rgb(255 255 255 / 0.55);
}
.on {
    color: rgb(var(--color-danger-light));
    box-shadow: inset 0 0 0 1px rgb(var(--color-danger) / 0.6);
}
</style>
