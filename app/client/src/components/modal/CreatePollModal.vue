<script setup>
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref, watch } from 'vue';

const app = useAppStore();
const client = useClientStore();

const MAX_ANSWERS = 6;

const question = ref('');
const answers = ref(['', '']);

// A fresh poll every time it opens
watch(
    () => app.modals.createPoll,
    (open) => {
        if (open) {
            question.value = '';
            answers.value = ['', ''];
        }
    },
);

const filled = computed(() => answers.value.map((answer) => answer.trim()).filter(Boolean));
// One line each: the server splits the question and answers on line breaks
const canCreate = computed(() => question.value.trim() && !question.value.includes('\n') && filled.value.length >= 2);

const create = () => {
    client.sendMessage(`/userpoll ${question.value.trim()}\n${filled.value.join('\n')}`);
    app.closeModal('createPoll');
};
</script>

<template>
    <ModalTemplate id="createPoll" title="New poll" variant="dialog">
        <form class="flex flex-col gap-4 pb-4" @submit.prevent="create">
            <p class="text-sm text-white/55">Posted in this room. Everyone here can vote, once each, and see who voted what.</p>
            <div>
                <label class="block text-sm font-semibold mb-1" for="poll-question">Question</label>
                <input
                    id="poll-question"
                    v-model="question"
                    class="form-control w-full"
                    maxlength="200"
                    placeholder="Pizza or sushi tonight?"
                />
            </div>
            <fieldset class="flex flex-col gap-2">
                <legend class="text-sm font-semibold mb-1">Answers</legend>
                <div v-for="(answer, index) in answers" :key="index" class="flex gap-2">
                    <input
                        v-model="answers[index]"
                        class="form-control grow min-w-0"
                        maxlength="100"
                        :placeholder="`Answer ${index + 1}`"
                        :aria-label="`Answer ${index + 1}`"
                    />
                    <button
                        v-if="answers.length > 2"
                        type="button"
                        class="form-control shrink-0"
                        :aria-label="`Remove answer ${index + 1}`"
                        @click="answers.splice(index, 1)"
                    >
                        <fa icon="xmark" />
                    </button>
                </div>
                <button v-if="answers.length < MAX_ANSWERS" type="button" class="form-control self-start" @click="answers.push('')">
                    <fa icon="plus" class="mr-1.5" />Add an answer
                </button>
            </fieldset>
            <button class="form-control self-end px-4" type="submit" :disabled="!canCreate">Post the poll</button>
        </form>
    </ModalTemplate>
</template>
