<script setup>
import { useClientStore } from '@/stores/client';
import { ref } from 'vue';

const client = useClientStore();

const manage = (command) => client.sendMessage(`/voicechannelmanage ${command}`);

function rename(channel, event) {
    const name = event.target.value.trim();
    if (name && name !== channel.name) {
        manage(`rename ${channel.id} ${name}`);
    } else {
        event.target.value = channel.name;
    }
}

// Deleting asks once more on the same button, since it drops everyone in the channel out of voice
const confirmingDelete = ref(null);
function remove(channel) {
    if (confirmingDelete.value !== channel.id) {
        confirmingDelete.value = channel.id;
        return;
    }
    confirmingDelete.value = null;
    manage(`delete ${channel.id}`);
}

const newName = ref('');
function create() {
    const name = newName.value.trim();
    if (name) {
        manage(`create ${name}`);
        newName.value = '';
    }
}
</script>

<template>
    <div class="flex flex-col gap-6 pb-4">
        <form class="flex gap-2 w-full max-w-md" @submit.prevent="create">
            <input
                v-model="newName"
                class="form-control grow min-w-0"
                maxlength="32"
                placeholder="New voice channel name"
                aria-label="New voice channel name"
                type="text"
            />
            <button class="form-control" type="submit" :disabled="!newName.trim()">Create</button>
        </form>

        <section class="flex flex-col gap-2">
            <p class="text-sm text-white/50">Rename a channel in place.</p>
            <p v-if="!client.state.voiceChannels.length" class="text-sm text-white/60">No voice channel yet. Create the first one above.</p>
            <div
                v-for="channel in client.state.voiceChannels"
                :key="channel.id"
                class="flex items-center gap-2 p-2 rounded-lg hairline bg-white/[.02]"
            >
                <span class="w-7 h-7 shrink-0 rounded flex items-center justify-center bg-primary/15 text-primary">
                    <fa icon="headphones" />
                </span>
                <div class="flex-1 min-w-0 flex flex-col">
                    <input
                        :value="channel.name"
                        :aria-label="`Name of voice channel ${channel.name}`"
                        maxlength="32"
                        class="w-full bg-transparent rounded px-1.5 py-0.5 text-sm font-medium hover:bg-white/5 focus:bg-black/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
                        @change="rename(channel, $event)"
                        @keydown.enter="$event.target.blur()"
                    />
                    <span class="px-1.5 font-mono text-xs text-white/40">
                        {{ channel.users.length ? `${channel.users.length} in voice: ${channel.users.join(', ')}` : 'empty' }}
                    </span>
                </div>
                <button
                    class="shrink-0 px-2 py-1 rounded-md text-xs hairline"
                    :class="confirmingDelete === channel.id ? 'text-danger ring-1 ring-danger/60' : 'text-white/50 hover:text-white'"
                    @click="remove(channel)"
                    @blur="confirmingDelete = null"
                >
                    {{ confirmingDelete === channel.id ? (channel.users.length ? 'Drop everyone and delete?' : 'Delete?') : 'Delete' }}
                </button>
            </div>
        </section>
    </div>
</template>
