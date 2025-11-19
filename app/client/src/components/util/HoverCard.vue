<script setup>
defineProps({
    /**
     * Whether this hover card is selectable
     */
    selectable: {
        type: Boolean,
        required: false,
        default: () => true,
    },

    /**
     * Whether this hover card is selected
     */
    selected: {
        type: Boolean,
        required: false,
        default: () => false,
    },

    /**
     * Tailwind class name for the border color
     */
    borderColor: {
        type: String,
        required: false,
        default: () => 'rgb(var(--color-skygray-light))',
    },

    /**
     * Whether to use border radius on first and last card elements relative to container
     */
    useBorderRadius: {
        type: Boolean,
        required: false,
        default: () => true,
    },

    /**
     * Whether the border should animate with a shiny effect
     */
    shiny: {
        type: Boolean,
        required: false,
        default: () => false,
    },
});
</script>

<template>
    <div
        class="hover-card flex flex-row"
        :class="{
            selectable: selectable,
            selected: selected,
            shiny: shiny && !selected,
        }"
    >
        <div class="colored-border"></div>
        <div class="content grow" :class="{ 'hover:bg-skygray-white/10': selectable }">
            <slot />
        </div>
    </div>
</template>

<style scoped>
.hover-card {
    transition: all 0.2s ease-out;
}
.hover-card.selected {
    transform: translate3d(6px, 0, 0);
}
.hover-card > .colored-border {
    min-width: 6px;
    width: 6px;
    transition: all 0.2s ease-out;
    background-color: v-bind(borderColor);
}
.hover-card:hover:not(.selected) > .colored-border {
    transform: translate3d(-3px, 0, 0);
    filter: brightness(1.25);
}
.hover-card:nth-child(1) .colored-border.rounded {
    border-top-left-radius: v-bind("useBorderRadius ? '4px' : '0'");
    border-top-right-radius: v-bind("useBorderRadius ? '4px' : '0'");
}
.hover-card:nth-last-child(1) .colored-border.rounded {
    border-bottom-left-radius: v-bind("useBorderRadius ? '4px' : '0'");
    border-bottom-right-radius: v-bind("useBorderRadius ? '4px' : '0'");
}
.hover-card > .content {
    transition: all 0.2s ease-out;
}
.hover-card.selected > .content {
    background-color: rgb(var(--color-skygray-light));
}
.hover-card.shiny > .colored-border {
    background-image: linear-gradient(
        120deg,
        rgb(var(--color-primary)),
        rgb(var(--color-tertiary)),
        rgb(var(--color-secondary))
    );
    background-size: 300% 300%;
    animation: hover-card-shiny 2.5s linear infinite;
    box-shadow: 0 0 6px rgba(var(--color-primary), 0.6);
}
@keyframes hover-card-shiny {
    0% {
        background-position: 0% 50%;
    }
    50% {
        background-position: 100% 50%;
    }
    100% {
        background-position: 0% 50%;
    }
}
</style>
