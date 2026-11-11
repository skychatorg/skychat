<script setup>
import BansPanel from '@/components/admin/BansPanel.vue';
import ChannelsPanel from '@/components/admin/ChannelsPanel.vue';
import HighlightsPanel from '@/components/admin/HighlightsPanel.vue';
import RoomsPanel from '@/components/admin/RoomsPanel.vue';
import ServerPanel from '@/components/admin/ServerPanel.vue';
import StickersPanel from '@/components/admin/StickersPanel.vue';
import UsersPanel from '@/components/admin/UsersPanel.vue';
import VoiceChannelsPanel from '@/components/admin/VoiceChannelsPanel.vue';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { useAdminTabs } from '@/composables/useAdminTabs';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const app = useAppStore();
const client = useClientStore();
const tabs = useAdminTabs();

const PANELS = {
    users: UsersPanel,
    bans: BansPanel,
    rooms: RoomsPanel,
    channels: ChannelsPanel,
    stickers: StickersPanel,
    voice: VoiceChannelsPanel,
    highlights: HighlightsPanel,
    server: ServerPanel,
};

// The tab asked for when opening, if this user may see it, else the first one they may
const active = computed(() => {
    const asked = app.modals.admin?.tab;
    return tabs.value.find((tab) => tab.id === asked) ?? tabs.value[0] ?? null;
});
const select = (tab) => (app.modals.admin = { tab: tab.id });
// Without OP the tabs are gone, so the panel closes too
const leaveOp = () => {
    client.sendMessage('/opexit');
    app.closeModal('admin');
};
</script>

<template>
    <ModalTemplate id="admin" title="Admin" variant="wide">
        <div class="flex flex-col md:flex-row gap-4 md:gap-6 h-full pb-4">
            <nav class="tabs" aria-label="Admin sections">
                <div role="tablist" class="contents">
                    <button
                        v-for="tab in tabs"
                        :id="`admin-tab-${tab.id}`"
                        :key="tab.id"
                        role="tab"
                        class="tab"
                        :class="{ active: active?.id === tab.id }"
                        :aria-selected="active?.id === tab.id"
                        :aria-controls="`admin-panel-${tab.id}`"
                        @click="select(tab)"
                    >
                        <fa :icon="tab.icon" class="w-4" />
                        <span>{{ tab.label }}</span>
                    </button>
                </div>
                <button v-if="client.state.op" class="tab leave" @click="leaveOp">
                    <fa icon="arrow-right-from-bracket" class="w-4" />
                    <span>Leave OP mode</span>
                </button>
            </nav>
            <section
                v-if="active"
                :id="`admin-panel-${active.id}`"
                class="grow min-w-0"
                role="tabpanel"
                :aria-labelledby="`admin-tab-${active.id}`"
            >
                <component :is="PANELS[active.id]" />
            </section>
            <p v-else class="text-sm text-white/50">Nothing to manage with your rights.</p>
        </div>
    </ModalTemplate>
</template>

<style scoped>
/* On phones the tabs wrap, so every one stays in sight */
.tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex-shrink: 0;
}
.tab {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 8px;
    white-space: nowrap;
    font-size: 14px;
    color: rgb(255 255 255 / 0.6);
}
.tab:hover {
    background: rgb(255 255 255 / 0.06);
    color: #fff;
}
.leave {
    color: rgb(255 255 255 / 0.45);
}
/* Apart from the tabs: it is an action, not a section */
@media (min-width: 768px) {
    .leave {
        margin-top: 12px;
    }
}
.tab.active {
    background: rgb(var(--color-primary) / 0.15);
    color: #fff;
    box-shadow: inset 0 0 0 1px rgb(var(--color-primary) / 0.5);
}
/* Side by side on wide screens: the tabs become a column on the left */
@media (min-width: 768px) {
    .tabs {
        flex-direction: column;
        flex-wrap: nowrap;
        width: 190px;
    }
}
</style>
