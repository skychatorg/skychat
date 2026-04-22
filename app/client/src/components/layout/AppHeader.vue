<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { usePaletteStore } from '@/stores/palette';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const app = useAppStore();
const client = useClientStore();
const palette = usePaletteStore();
const router = useRouter();

const logout = () => {
    if (client.state.user.id > 0) {
        client.logout();
    }
    router.push({ name: 'home', params: {} });
};

const connectionStatus = computed(() => {
    if (client.state.isConnected) {
        return 'connected';
    } else if (client.state.isReconnecting) {
        return 'reconnecting';
    } else if (client.state.websocketReadyState === WebSocket.CONNECTING) {
        return 'connecting';
    } else {
        return 'disconnected';
    }
});

const onlineCount = computed(() => (client.state.connectedList || []).length);
</script>

<template>
    <header class="h-16 shrink-0 hairline backdrop-blur-xl" :style="{ background: 'var(--header)' }">
        <div class="h-full w-full max-w-[var(--page-max-width)] mx-auto flex items-stretch">
            <!-- Logo + wordmark — aligned with the left column on desktop -->
            <div
                class="flex items-center justify-center gap-2 px-3 select-none lg:w-[var(--page-col-left-width)] lg:shrink-0 overflow-hidden"
            >
                <a href="/" class="flex items-center gap-2 min-w-0">
                    <img src="/assets/logo.png" alt="SkyChat" class="h-7 w-auto shrink-0" />
                    <span v-if="!app.effectiveLeftCollapsed" class="font-semibold text-base tracking-tight">SkyChat</span>
                </a>
            </div>

            <!-- Middle: command palette trigger, aligned with the middle column -->
            <div class="grow flex items-center justify-center px-3">
                <button
                    class="hidden lg:flex items-center gap-2 px-3 py-1.5 hairline rounded-lg bg-white/[.02] hover:bg-white/[.05] transition text-xs text-white/60"
                    title="Command palette"
                    @click="palette.openPalette()"
                >
                    <fa icon="magnifying-glass" class="text-[10px]" />
                    <span>Search or run a command</span>
                    <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 ml-2">Ctrl K</span>
                </button>
            </div>

            <!-- Right: status + user pill — aligned with the right column on desktop -->
            <div class="flex items-center justify-end gap-3 px-3 lg:w-[var(--page-col-right-width)] lg:shrink-0">
                <template v-if="connectionStatus === 'connected'">
                    <span
                        v-if="onlineCount > 0 && !app.effectiveRightCollapsed"
                        class="inline-flex items-center gap-1 px-1.5 py-[2px] rounded font-mono text-xs font-medium bg-primary/15 text-primary ring-1 ring-primary/30"
                    >
                        <fa icon="circle" class="text-[6px]" />
                        {{ onlineCount }}<span class="hidden lg:inline"> online</span>
                    </span>
                    <button
                        class="flex items-center gap-2 pl-2 pr-2 py-1 hairline rounded-lg bg-white/[.02] hover:bg-white/[.05] transition"
                        @click="app.toggleModal('profile')"
                    >
                        <div
                            class="w-[22px] h-[22px] rounded overflow-hidden bg-black border-2"
                            :style="{ borderColor: client.state.user.data.plugins.custom.color }"
                        >
                            <img
                                :src="client.state.user.data.plugins.avatar"
                                :alt="client.state.user.username"
                                class="h-full w-full object-cover"
                            />
                        </div>
                        <span v-if="!app.effectiveRightCollapsed" class="text-sm">{{ client.state.user.username }}</span>
                        <span v-if="!app.effectiveRightCollapsed" class="font-mono text-xs text-white/40">
                            {{ client.state.user.right }}
                        </span>
                    </button>
                    <button
                        v-if="!app.effectiveRightCollapsed"
                        class="w-10 h-10 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition"
                        title="Logout"
                        @click="logout"
                    >
                        <fa icon="arrow-right-from-bracket" />
                    </button>
                </template>
                <template v-if="connectionStatus === 'connecting'">
                    <span class="text-primary font-mono text-sm">Connecting…</span>
                </template>
                <template v-if="connectionStatus === 'reconnecting'">
                    <span class="text-warn font-mono text-sm">
                        Reconnecting<span v-if="client.state.reconnectAttempts > 1"> ({{ client.state.reconnectAttempts }})</span>…
                    </span>
                </template>
                <template v-if="connectionStatus === 'disconnected'">
                    <span class="text-danger font-mono text-sm">Disconnected</span>
                </template>
            </div>
        </div>
    </header>
</template>
