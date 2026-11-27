<script setup>
import SectionSubTitle from '@/components/util/SectionSubTitle.vue';
import { useClientStore } from '@/stores/client';
import { computed, ref } from 'vue';

const client = useClientStore();

const email = ref('');
const saveEmail = () => {
    client.sendMessage(`/set email ${email.value.trim()}`);
    email.value = '';
};

const password = ref({ current: '', next: '', again: '' });
// The command takes both passwords as words, so neither may hold a space
const passwordProblem = computed(() => {
    const { current, next, again } = password.value;
    if (!current || !next) {
        return null;
    }
    if (/\s/.test(current + next)) {
        return 'Passwords cannot contain spaces.';
    }
    if (next !== again) {
        return "The new passwords don't match.";
    }
    return null;
});
const canChangePassword = computed(() => password.value.current && password.value.next && !passwordProblem.value);
const changePassword = () => {
    client.sendMessage(`/set password ${password.value.current} ${password.value.next}`);
    password.value = { current: '', next: '', again: '' };
};

// The Discord plugin keeps its data on the user, under its name: no key means it isn't on
const discordOn = computed(() => 'discord' in (client.state.user.data?.plugins ?? {}));
const discordName = computed(() => client.state.user.data?.plugins?.discord?.discordUsername ?? null);
</script>

<template>
    <div>
        <SectionSubTitle class="mt-6">Email</SectionSubTitle>
        <form class="flex gap-2" @submit.prevent="saveEmail">
            <input
                v-model="email"
                class="grow min-w-0 form-control"
                type="email"
                placeholder="you@example.com"
                aria-label="Email"
                autocomplete="email"
            />
            <button class="form-control" type="submit" :disabled="!email.includes('@')">Save</button>
        </form>
        <p class="text-xs text-white/40 mt-1">Used to reset your password if you forget it.</p>

        <SectionSubTitle class="mt-6">Password</SectionSubTitle>
        <form class="flex flex-col gap-2" @submit.prevent="changePassword">
            <input
                v-model="password.current"
                class="form-control"
                type="password"
                placeholder="Current password"
                aria-label="Current password"
                autocomplete="current-password"
            />
            <input
                v-model="password.next"
                class="form-control"
                type="password"
                placeholder="New password"
                aria-label="New password"
                autocomplete="new-password"
            />
            <input
                v-model="password.again"
                class="form-control"
                type="password"
                placeholder="New password again"
                aria-label="New password again"
                autocomplete="new-password"
            />
            <p v-if="passwordProblem" class="text-xs text-danger-light">{{ passwordProblem }}</p>
            <button class="form-control self-start" type="submit" :disabled="!canChangePassword">Change password</button>
        </form>

        <template v-if="discordOn">
            <SectionSubTitle class="mt-6">Discord</SectionSubTitle>
            <div class="flex items-center gap-2">
                <span class="grow text-sm text-white/70">
                    <fa :icon="['fab', 'discord']" class="mr-1.5" />{{ discordName ? `Linked to ${discordName}` : 'Not linked' }}
                </span>
                <button v-if="discordName" class="form-control" @click="client.sendMessage('/discord unlink')">Unlink</button>
                <button v-else class="form-control" @click="client.sendMessage('/discord link')">Link</button>
            </div>
            <p class="text-xs text-white/40 mt-1">Shows when you're on Discord, and who is in voice there.</p>
        </template>
    </div>
</template>
