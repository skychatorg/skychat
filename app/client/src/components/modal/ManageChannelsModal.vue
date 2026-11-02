<script setup>
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { betLimits, channelIcon } from '@/lib/channel';
import { useClientStore } from '@/stores/client';
import { reactive, ref, watch } from 'vue';
import draggable from 'vuedraggable';

const client = useClientStore();

const channels = ref([]);
watch(
    () => client.state.playerChannels,
    (list) => (channels.value = [...list]),
    { immediate: true },
);

const manage = (command) => client.sendMessage(`/playerchannelmanage ${command}`);

const onMoved = () => manage(`reorder ${channels.value.map((channel) => channel.id).join(',')}`);

function rename(channel, event) {
    const name = event.target.value.trim();
    if (name && name !== channel.name) {
        manage(`rename ${channel.id} ${name}`);
    } else {
        event.target.value = channel.name;
    }
}

// Deleting asks once more on the same button, since it kicks everyone out of the channel
const confirmingDelete = ref(null);
function remove(channel) {
    if (confirmingDelete.value !== channel.id) {
        confirmingDelete.value = channel.id;
        return;
    }
    confirmingDelete.value = null;
    manage(`delete ${channel.id}`);
}

const KINDS = [
    { kind: 'media', label: 'Media', icon: 'music', description: 'A shared queue of videos and music' },
    { kind: 'casino', label: 'Casino', icon: 'dice', description: 'A blackjack table played with SkyChat money' },
];
const form = reactive({ name: '', kind: 'media', minBet: 10, maxBet: 100 });
function create() {
    const name = form.name.trim();
    if (!name) {
        return;
    }
    // The form is in dollars, the server counts cents like all user money
    const cents = (dollars) => Math.round(dollars * 100);
    manage(form.kind === 'casino' ? `create casino ${cents(form.minBet)} ${cents(form.maxBet)} ${name}` : `create media ${name}`);
    form.name = '';
}
</script>

<template>
    <ModalTemplate id="manageChannels" title="Manage channels">
        <div class="flex flex-col gap-6 pb-4">
            <section class="flex flex-col gap-2">
                <p class="text-sm text-white/50">Rename a channel in place, drag to reorder.</p>
                <p v-if="!channels.length" class="text-sm text-white/60">No channel yet. Create the first one below.</p>
                <!-- Each item is wrapped in a div: vuedraggable marks the item's root element as draggable -->
                <draggable v-model="channels" item-key="id" handle=".grip" @end="onMoved">
                    <template #item="{ element }">
                        <div class="flex items-center gap-2 p-2 mb-2 rounded-lg hairline bg-white/[.02]">
                            <span class="grip px-1 text-white/40 cursor-grab" title="Drag to reorder"><fa icon="ellipsis-vertical" /></span>
                            <span
                                class="w-7 h-7 shrink-0 rounded flex items-center justify-center"
                                :class="element.kind === 'casino' ? 'bg-amber-400/15 text-amber-300' : 'bg-primary/15 text-primary'"
                            >
                                <fa :icon="channelIcon(element)" />
                            </span>
                            <div class="flex-1 min-w-0 flex flex-col">
                                <input
                                    :value="element.name"
                                    :aria-label="`Name of channel ${element.name}`"
                                    maxlength="32"
                                    class="w-full bg-transparent rounded px-1.5 py-0.5 text-sm font-medium hover:bg-white/5 focus:bg-black/30 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    @change="rename(element, $event)"
                                    @keydown.enter="$event.target.blur()"
                                />
                                <span class="px-1.5 font-mono text-xs text-white/40">
                                    {{ element.kind === 'casino' ? `casino · blackjack ${betLimits(element.casino)}` : 'media' }}
                                </span>
                            </div>
                            <button
                                class="shrink-0 px-2 py-1 rounded-md text-xs hairline"
                                :class="
                                    confirmingDelete === element.id ? 'text-danger ring-1 ring-danger/60' : 'text-white/50 hover:text-white'
                                "
                                @click="remove(element)"
                                @blur="confirmingDelete = null"
                            >
                                {{ confirmingDelete === element.id ? 'Delete for everyone?' : 'Delete' }}
                            </button>
                        </div>
                    </template>
                </draggable>
            </section>

            <form class="flex flex-col gap-3 p-3 rounded-xl hairline bg-white/[.02]" @submit.prevent="create">
                <h3 class="text-base font-semibold">New channel</h3>
                <label class="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-white/50">
                    Name
                    <input
                        id="newChannelName"
                        v-model="form.name"
                        maxlength="32"
                        required
                        :placeholder="form.kind === 'casino' ? 'High rollers' : 'Movie night'"
                        class="form-control normal-case tracking-normal font-sans text-sm text-white"
                    />
                </label>
                <div class="grid grid-cols-2 gap-2" role="group" aria-label="Kind of channel">
                    <button
                        v-for="option in KINDS"
                        :key="option.kind"
                        type="button"
                        class="flex flex-col items-start gap-0.5 p-2.5 rounded-lg text-left hairline"
                        :class="form.kind === option.kind ? 'ring-1 ring-amber-300/70 bg-amber-300/[.06]' : 'bg-black/20'"
                        :aria-pressed="form.kind === option.kind"
                        @click="form.kind = option.kind"
                    >
                        <span class="text-sm font-semibold"><fa :icon="option.icon" class="mr-1.5" />{{ option.label }}</span>
                        <span class="text-xs text-white/50">{{ option.description }}</span>
                    </button>
                </div>
                <div v-if="form.kind === 'casino'" class="grid grid-cols-2 gap-2">
                    <label class="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-white/50">
                        Min bet $
                        <input
                            id="newChannelMinBet"
                            v-model.number="form.minBet"
                            type="number"
                            min="1"
                            class="form-control text-sm text-white"
                        />
                    </label>
                    <label class="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-white/50">
                        Max bet $
                        <input
                            id="newChannelMaxBet"
                            v-model.number="form.maxBet"
                            type="number"
                            :min="form.minBet"
                            class="form-control text-sm text-white"
                        />
                    </label>
                </div>
                <button type="submit" class="form-control self-start px-4" :disabled="!form.name.trim()">Create channel</button>
            </form>
        </div>
    </ModalTemplate>
</template>
