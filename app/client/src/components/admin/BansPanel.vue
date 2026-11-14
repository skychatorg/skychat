<script setup>
import { useNow } from '@/composables/useNow';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, onMounted, ref } from 'vue';

const app = useAppStore();
const client = useClientStore();
const now = useNow(1000);

const TYPES = [
    { id: 'ACCESS', label: 'Access', text: 'Disconnected, and cannot come back' },
    { id: 'SHADOW', label: 'Shadow', text: 'Their messages are only shown to themselves' },
    { id: 'LAG', label: 'Lag', text: 'Each of their messages is delayed up to 20 s' },
    { id: 'SPAM', label: 'Spam', text: 'Their chat fills with fake messages' },
];
const DURATIONS = [
    { label: '10 minutes', seconds: 600 },
    { label: '1 hour', seconds: 3600 },
    { label: '1 day', seconds: 86_400 },
    { label: '1 week', seconds: 604_800 },
    { label: 'Forever', seconds: null },
];

// Asked for without a chat table: the panel only needs the data
onMounted(() => client.sendMessage('/banlist ui'));

// One row per banned user: a ban also covers each IP they were connected from
const bans = computed(() => {
    const bySource = new Map();
    for (const ban of client.state.banList ?? []) {
        const row = bySource.get(ban.source) ?? { ...ban, ips: 0 };
        row.ips += ban.match.startsWith('ip:') ? 1 : 0;
        bySource.set(ban.source, row);
    }
    return [...bySource.values()].filter((ban) => ban.until === null || ban.until > now.value);
});

const left = (until) => {
    if (until === null) {
        return 'forever';
    }
    const minutes = Math.max(1, Math.round((until - now.value) / 60_000));
    if (minutes < 60) {
        return `${minutes} min left`;
    }
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h left` : `${Math.round(hours / 24)} days left`;
};

// The user menu's "Ban" opens this tab with the name filled in
const form = ref({ username: app.modals.admin?.username ?? '', type: 'ACCESS', seconds: 3600 });
const usernames = computed(() => (client.state.connectedList ?? []).map((entry) => entry.user.username));
const canBan = computed(() => /^[a-z0-9-_]+$/i.test(form.value.username.trim()));

const ban = () => {
    const { username, type, seconds } = form.value;
    client.sendMessage(`/ban ${username.trim()} ${type}${seconds === null ? '' : ` ${seconds}`}`);
    form.value.username = '';
};
const unban = (source) => client.sendMessage(`/unban ${source}`);
</script>

<template>
    <div class="flex flex-col gap-6 pb-6 text-skygray-lightest">
        <form class="flex flex-col gap-4 w-full max-w-md" @submit.prevent="ban">
            <div>
                <label class="block text-sm font-semibold text-skygray-white" for="ban-username">User</label>
                <input
                    id="ban-username"
                    v-model="form.username"
                    class="form-control mt-1 w-full"
                    list="ban-usernames"
                    placeholder="username"
                    autocomplete="off"
                    type="text"
                />
                <datalist id="ban-usernames">
                    <option v-for="name in usernames" :key="name" :value="name" />
                </datalist>
            </div>
            <fieldset>
                <legend class="text-sm font-semibold text-skygray-white">Type</legend>
                <div class="grid grid-cols-2 gap-2 mt-1">
                    <label v-for="type in TYPES" :key="type.id" class="choice" :class="{ picked: form.type === type.id }">
                        <input v-model="form.type" type="radio" name="ban-type" :value="type.id" class="sr-only" />
                        <span class="font-semibold">{{ type.label }}</span>
                        <span class="text-xs text-white/60">{{ type.text }}</span>
                    </label>
                </div>
            </fieldset>
            <fieldset>
                <legend class="text-sm font-semibold text-skygray-white">For</legend>
                <div class="flex flex-wrap gap-2 mt-1">
                    <label
                        v-for="duration in DURATIONS"
                        :key="duration.label"
                        class="choice pill"
                        :class="{ picked: form.seconds === duration.seconds }"
                    >
                        <input v-model="form.seconds" type="radio" name="ban-duration" :value="duration.seconds" class="sr-only" />
                        {{ duration.label }}
                    </label>
                </div>
            </fieldset>
            <div>
                <button class="form-control" type="submit" :disabled="!canBan">Ban</button>
            </div>
        </form>

        <div>
            <h3 class="font-semibold mb-2 text-skygray-white">Active bans ({{ bans.length }})</h3>
            <p v-if="client.state.banList === null" class="text-sm text-skygray-light">Loading…</p>
            <ul v-else-if="bans.length" class="flex flex-col gap-2">
                <li v-for="entry in bans" :key="entry.source" class="row">
                    <div class="grow min-w-0">
                        <div class="font-semibold truncate">{{ entry.source }}</div>
                        <div class="flex items-center gap-2 mt-0.5 text-xs text-white/60 whitespace-nowrap">
                            <span class="badge">{{ entry.type.toLowerCase() }}</span>
                            <span
                                >{{ left(entry.until)
                                }}<template v-if="entry.ips"> · {{ entry.ips }} IP{{ entry.ips > 1 ? 's' : '' }}</template></span
                            >
                        </div>
                    </div>
                    <button type="button" class="form-control unban" @click="unban(entry.source)">Unban</button>
                </li>
            </ul>
            <p v-else class="text-sm text-skygray-light">Nobody is banned.</p>
        </div>
    </div>
</template>

<style scoped>
.choice {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(255 255 255 / 0.03);
    color: #fff;
    cursor: pointer;
}
.choice:hover {
    border-color: rgb(255 255 255 / 0.3);
}
.choice.picked {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.12);
}
.choice:focus-within {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
}
.pill {
    flex-direction: row;
    padding: 6px 12px;
    font-size: 14px;
}
.row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: rgb(0 0 0 / 0.2);
    color: #fff;
}
.badge {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    background: rgb(var(--color-danger) / 0.2);
    color: rgb(var(--color-danger-light));
}
.unban {
    flex-shrink: 0;
}
</style>
