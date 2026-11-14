<script setup>
import { useNow } from '@/composables/useNow';
import { useUserRight } from '@/composables/useUserRight';
import { mediaFromLink } from '@/lib/mediaLink';
import { useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';

const client = useClientStore();
const now = useNow(30_000);

const canAdd = useUserRight('minRightForPlayerAddMedia');
const canSchedule = useUserRight('minRightForPlayerManageSchedule');

// Add a link to the queue, right now
const link = ref('');
const media = computed(() => mediaFromLink(link.value));
const add = () => {
    client.sendMessage(`/${media.value.fetcher} ${media.value.param}`);
    link.value = '';
};

// Plan a link for later. The date goes out in UTC, whatever the server's time zone
const plan = ref({ link: '', at: '', minutes: '' });
const planned = computed(() => mediaFromLink(plan.value.link));
const canPlan = computed(() => planned.value && plan.value.at && new Date(plan.value.at).getTime() > Date.now());
const schedule = () => {
    const { fetcher, param } = planned.value;
    const duration = plan.value.minutes ? ` ${Math.round(plan.value.minutes * 60_000)}` : '';
    client.sendMessage(`/schedule ${fetcher} ${param} ${new Date(plan.value.at).toISOString()}${duration}`);
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
const cancel = (event) => client.sendMessage(`/unschedule ${event.start}`);
</script>

<template>
    <div class="flex flex-col gap-4 mt-6 pt-4 border-t border-white/10">
        <form v-if="canAdd" class="flex flex-col gap-1.5" @submit.prevent="add">
            <label class="text-sm font-semibold" for="player-link">Add by link</label>
            <div class="flex gap-2">
                <input
                    id="player-link"
                    v-model="link"
                    class="form-control grow min-w-0"
                    placeholder="YouTube, twitch.tv/…, SoundCloud…"
                    type="url"
                    autocomplete="off"
                />
                <button class="form-control shrink-0" type="submit" :disabled="!media">Add</button>
            </div>
            <p class="text-xs text-white/45">
                {{ media ? `Adds ${media.label} to the queue.` : 'Paste a link to a video, a stream or a sound.' }}
            </p>
        </form>

        <section v-if="canSchedule" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold">Scheduled</h3>
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
                <button class="form-control self-start" type="submit" :disabled="!canPlan">Schedule</button>
            </form>
        </section>
    </div>
</template>
