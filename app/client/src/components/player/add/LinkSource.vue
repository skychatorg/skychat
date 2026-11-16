<script setup>
import { computed, ref } from 'vue';
import { useNow } from '@/composables/useNow';
import { useUserRight } from '@/composables/useUserRight';
import { mediaFromLink } from '@/lib/mediaLink';
import { useClientStore } from '@/stores/client';
import { usePlayerAdd } from '@/composables/usePlayerAdd';

const client = useClientStore();
const now = useNow(30_000);
const { send } = usePlayerAdd();
const canSchedule = useUserRight('minRightForPlayerManageSchedule');

// Add a link to the queue, right now
const link = ref('');
const media = computed(() => mediaFromLink(link.value));
const add = () => {
    send(`/${media.value.fetcher} ${media.value.param}`);
    link.value = '';
};

// Plan a link for later. The date goes out in UTC, whatever the server's time zone
const plan = ref({ link: '', at: '', minutes: '' });
const planned = computed(() => mediaFromLink(plan.value.link));
const canPlan = computed(() => planned.value && plan.value.at && new Date(plan.value.at).getTime() > Date.now());
const schedule = () => {
    const { fetcher, param } = planned.value;
    const duration = plan.value.minutes ? ` ${Math.round(plan.value.minutes * 60_000)}` : '';
    send(`/schedule ${fetcher} ${param} ${new Date(plan.value.at).toISOString()}${duration}`);
    plan.value = { link: '', at: '', minutes: '' };
};

const upcoming = computed(() =>
    // From the channel list: the current channel's own copy isn't refreshed when the schedule changes
    (client.state.playerChannels.find((channel) => channel.id === client.state.currentPlayerChannelId)?.schedule?.events ?? [])
        .filter((event) => event.start + event.duration > now.value)
        .sort((a, b) => a.start - b.start),
);
const when = (start) =>
    new Date(start).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const cancel = (event) => send(`/unschedule ${event.start}`);
</script>

<template>
    <!-- p-1 -m-1: room for the inputs' focus ring, which the scroll container would clip -->
    <div class="flex flex-col gap-6 min-h-0 overflow-y-auto scrollbar p-1 -m-1">
        <form class="flex flex-col gap-1.5" @submit.prevent="add">
            <label class="text-sm font-semibold" for="player-link">Play a link</label>
            <div class="flex gap-2">
                <input
                    id="player-link"
                    v-model="link"
                    class="form-control grow min-w-0"
                    placeholder="YouTube, twitch.tv/…, SoundCloud…"
                    type="url"
                    autocomplete="off"
                />
                <button class="btn text-sm shrink-0" type="submit" :disabled="!media">Add</button>
            </div>
            <p class="text-xs text-white/45">
                {{ media ? `Adds ${media.label} to the queue.` : 'A video, a live stream, or any page that plays something.' }}
            </p>
        </form>

        <section v-if="canSchedule" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold">Schedule for later</h3>
            <ul v-if="upcoming.length" class="flex flex-col gap-1.5">
                <li v-for="event in upcoming" :key="event.start" class="flex items-center gap-2 p-2 rounded-lg hairline bg-white/[.02]">
                    <span class="text-xs font-mono text-primary shrink-0">{{ when(event.start) }}</span>
                    <span class="text-sm truncate grow min-w-0" :title="event.media.title">{{ event.media.title }}</span>
                    <button
                        class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-skygray-light hover:text-danger hover:bg-danger/10"
                        title="Cancel"
                        @click="cancel(event)"
                    >
                        <fa icon="xmark" />
                    </button>
                </li>
            </ul>
            <p v-else class="text-xs text-white/45">Nothing planned in this channel.</p>

            <form class="flex flex-col gap-2 p-3 rounded-xl hairline bg-white/[.02]" @submit.prevent="schedule">
                <input
                    v-model="plan.link"
                    class="form-control"
                    placeholder="Link to play"
                    aria-label="Link to play"
                    type="url"
                    autocomplete="off"
                />
                <div class="flex flex-wrap gap-2">
                    <input v-model="plan.at" class="form-control grow" type="datetime-local" aria-label="When" />
                    <input
                        v-model.number="plan.minutes"
                        class="form-control w-32"
                        type="number"
                        min="1"
                        placeholder="minutes"
                        aria-label="For how many minutes"
                    />
                </div>
                <p class="text-xs text-white/45">Leave the minutes empty to use the video's length, or 2 hours for a stream.</p>
                <button class="btn text-sm self-start" type="submit" :disabled="!canPlan">Schedule</button>
            </form>
        </section>
    </div>
</template>
