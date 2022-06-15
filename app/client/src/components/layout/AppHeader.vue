<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useRouter } from 'vue-router';
import UserBigAvatar from '@/components/user/UserBigAvatar.vue';

const app = useAppStore();
const client = useClientStore();
const router = useRouter();


const logout = () => {
    if (client.state.user.id > 0) {
        client.logout();
    }
    router.push({ name: 'home', params: { } });
};

const connectionStatus = computed(() => {
    if (client.state.websocketReadyState === WebSocket.OPEN) {
        return 'connected';
    } else if (client.state.websocketReadyState === WebSocket.CONNECTING) {
        return 'connecting';
    } else {
        return 'disconnected';
    }
});

</script>

<template>
    <header class="header h-16 bg-skygray-lighter/10 backdrop-brightness-125 w-full flex">

            <!-- Logo -->
            <a
                href="/"
                class="pl-6 logo text-center flex flex-col justify-center text-center"
            >
                <img class="inline" src="/assets/logo.png" width="60" height="60">
            </a>

            <!-- User -->
            <div class="grow flex justify-end pr-4">
                <template v-if="connectionStatus === 'connected'">
                    <div class="flex items-center">
                        <UserBigAvatar :user="client.state.user" />
                        <div class="flex flex-col">
                            <span class="ml-2">{{ client.state.user.username }}</span>
                            <button @click="logout">
                                <fa icon="arrow-right-from-bracket" />
                            </button>
                        </div>
                    </div>
                </template>
                <template v-else>
                    disconnected
                </template>
            </div>
    </header>
</template>

<style scoped>
.header {
    width: 100%;
    max-width: var(--page-max-width);
    margin: 0 auto;
}
.logo {
    width: var(--page-col-left-width);
    max-width: var(--page-col-left-width);
    min-width: var(--page-col-left-width);
}
</style>
