<script setup>
import { useClientStore } from '@/stores/client';

const client = useClientStore();

</script>

<template>
    <div>
        <div
            v-for="poll in client.state.polls"
            :key="poll.id"
            class="ml-2 px-6 py-4 flex flex-wrap"
            :class="{
                'bg-primary/25': poll.state === 'pending' || poll.state === 'started',
                'bg-secondary/25': poll.state === 'finished',
            }"
        >
            <div class="grow p-2">
                <b>{{ poll.title }}</b>: {{ poll.content }}
            </div>
            <!-- OP Vote -->
            <div v-if="poll.opVote !== undefined">
                <button v-if="poll.opVote" class="form-control !text-primary">Vote by OP <fa icon="thumbs-up" class="ml-2" /></button>
                <button v-if="! poll.opVote" class="form-control !text-tertiary">Vote by OP <fa icon="thumbs-down" class="ml-2" /></button>
            </div>
            <!-- Vote -->
            <div v-if="poll.opVote === undefined && (poll.state === 'pending' || poll.state === 'started')">
                <button title="Vote yes" @click="client.sendMessage(`/vote ${poll.id} y`)" class="form-control !text-primary mr-2">
                    <template v-if="poll.yesCount">{{ poll.yesCount }}</template>
                    <fa icon="thumbs-up" :class="{ 'ml-2': poll.yesCount }" />
                </button>
                <button title="Vote no" @click="client.sendMessage(`/vote ${poll.id} n`)" class="form-control !text-tertiary">
                    <template v-if="poll.noCount">{{ poll.noCount }}</template>
                    <fa icon="thumbs-down" :class="{ 'ml-2': poll.noCount }" />
                </button>
            </div>
            <!-- Results -->
            <div v-if="poll.opVote === undefined && (poll.state === 'finished')">
                <p>
                    <button v-if="poll.result === true" class="form-control !text-primary">Decision made<fa icon="thumbs-up" class="ml-2" /></button>
                    <button v-if="poll.result === undefined" class="form-control !text-secondary">Unable to decide 🤷‍♂️</button>
                    <button v-if="poll.result === false" class="form-control !text-tertiary">Decision made<fa icon="thumbs-down" class="ml-2" /></button>
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
</style>
