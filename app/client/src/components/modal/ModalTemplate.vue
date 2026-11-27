<script setup>
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'radix-vue';
import SectionTitle from '@/components/util/SectionTitle.vue';
import { useAppStore } from '@/stores/app';
import { computed } from 'vue';

const app = useAppStore();

const emit = defineEmits(['close']);

const props = defineProps({
    id: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        default: '',
    },
    // drawer: right-side slide-in (default) · dialog: centered medium · wide: centered large (media browsing)
    variant: {
        type: String,
        default: 'drawer',
    },
    // A modal driven by something else than the store (the URL): it says when it is open, and handles @close
    open: {
        type: Boolean,
        default: null,
    },
});

const isOpen = computed(() => props.open ?? !!app.modals[props.id]);
const close = () => (props.open === null ? app.closeModal(props.id) : emit('close'));

// Focus the dialog itself, not its first field: Tab then stays inside, and no phone keyboard pops up on open
const focusDialog = (event) => {
    event.preventDefault();
    event.target.focus();
};
</script>

<template>
    <DialogRoot :open="isOpen" @update:open="(v) => !v && close()">
        <DialogPortal>
            <DialogOverlay class="modal-overlay" />
            <DialogContent :class="['modal-surface', `modal-${variant}`]" @open-auto-focus="focusDialog">
                <div class="relative shrink-0">
                    <button class="absolute -top-2.5 -left-1 w-11 h-11 flex items-center justify-center" aria-label="Close" @click="close">
                        <fa icon="times" />
                    </button>
                    <DialogTitle as-child>
                        <SectionTitle
                            ><slot name="title">{{ title }}</slot></SectionTitle
                        >
                    </DialogTitle>
                    <hr class="my-4 border-skygray-light" />
                </div>

                <div class="grow min-h-0 overflow-y-auto scrollbar px-4">
                    <slot />
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<!-- Unscoped: radix portals the content to <body>, outside this component's subtree, so scoped styles would not match. -->
<style>
.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(16px);
}

.modal-surface {
    position: fixed;
    z-index: 301;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    color: rgb(var(--color-skygray-white));
    background: rgb(var(--color-secondary) / 0.1);
    backdrop-filter: blur(40px);
}
/* Focused on open so Tab stays inside; the box itself needs no ring, its buttons keep theirs */
.modal-surface:focus {
    outline: none;
}

/* Drawer: pinned to the right, below the header. On ultrawide it hugs the centered content track, matching the old layout. */
.modal-drawer {
    top: var(--page-header-height);
    right: max(0px, calc((100vw - var(--page-max-width)) / 2));
    height: calc(100% - var(--page-header-height));
    width: 100%;
}
@media (min-width: 1024px) {
    .modal-drawer {
        width: var(--modal-width);
    }
}

/* Centered surfaces */
.modal-dialog,
.modal-wide {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.modal-dialog {
    width: min(560px, calc(100vw - 2rem));
    max-height: 85vh;
}
.modal-wide {
    width: min(1100px, calc(100vw - 3rem));
    height: min(85vh, 900px);
}

/* radix Presence keeps the node mounted through the close animation by reading animation-name,
   so enter/leave must be keyframe animations (not transitions). Reduced-motion → no animation → instant. */
@media (prefers-reduced-motion: no-preference) {
    .modal-overlay[data-state='open'] {
        animation: modal-overlay-in 0.25s ease-out;
    }
    .modal-overlay[data-state='closed'] {
        animation: modal-overlay-out 0.2s ease-in;
    }

    .modal-drawer[data-state='open'] {
        animation: modal-drawer-in 0.3s ease-out;
    }
    .modal-drawer[data-state='closed'] {
        animation: modal-drawer-out 0.25s ease-in;
    }

    .modal-dialog[data-state='open'],
    .modal-wide[data-state='open'] {
        animation: modal-pop-in 0.2s ease-out;
    }
    .modal-dialog[data-state='closed'],
    .modal-wide[data-state='closed'] {
        animation: modal-pop-out 0.15s ease-in;
    }
}

@keyframes modal-overlay-in {
    from {
        opacity: 0;
    }
}
@keyframes modal-overlay-out {
    to {
        opacity: 0;
    }
}
@keyframes modal-drawer-in {
    from {
        transform: translate3d(20px, 0, 0);
        opacity: 0;
    }
}
@keyframes modal-drawer-out {
    to {
        transform: translate3d(20px, 0, 0);
        opacity: 0;
    }
}
@keyframes modal-pop-in {
    from {
        transform: translate(-50%, -50%) scale(0.96);
        opacity: 0;
    }
}
@keyframes modal-pop-out {
    to {
        transform: translate(-50%, -50%) scale(0.96);
        opacity: 0;
    }
}
</style>
