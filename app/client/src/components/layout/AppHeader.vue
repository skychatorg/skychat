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

            <!-- Left col (empty for now) -->
            <div class="w-0 lg:w-[var(--page-col-left-width)]"></div>

            <!-- Logo -->
            <div class="pl-6 lg:pl-0 grow text-center flex lg:justify-center" href="/">
                <div class="flex flex-col justify-center">
                    <a href="/"><img src="/assets/logo.png" width="60" height="40.5" ></a>
                </div>
            </div>

            <!-- User -->
            <div class="p-2 w-0 w-[var(--page-col-right-width)]">
                <template v-if="connectionStatus === 'connected'">
                    <div class="flex items-center">
                        <UserBigAvatar :user="client.state.user" />
                        <div class="flex flex-col">
                            <span class="ml-2">
                                {{ client.state.user.username }}
                            </span>
                            <button @click="logout">
                                <fa icon="arrow-right-from-bracket" />
                            </button>
                        </div>
                    </div>
                </template>
                <template v-if="connectionStatus === 'connecting'">
                    <p class="p-4 text-primary font-bold text-center">Connecting..</p>
                </template>
                <template v-if="connectionStatus === 'disconnected'">
                    <p class="p-4 text-danger font-bold text-center">Disconnected</p>
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
</style>
