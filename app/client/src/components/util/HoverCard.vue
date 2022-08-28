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
});

</script>

<template>
    <div
        class="hover-card flex flex-row"
        :class="{
            'selectable': selectable,
            'selected': selected,
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
    transition: all .2s ease-out;
}
.hover-card.selected {
    transform: translate3d(6px, 0, 0);
}
.hover-card > .colored-border {
    min-width: 6px;
    width: 6px;
    transition: all .2s ease-out;
    background-color: v-bind(borderColor);
}
.hover-card:hover:not(.selected) > .colored-border {
    transform: translate3d(-3px, 0, 0);
    filter: brightness(1.25);
}
.hover-card:nth-child(1) .colored-border {
    border-top-left-radius: v-bind("useBorderRadius ? '4px' : '0'");
    border-top-right-radius: v-bind("useBorderRadius ? '4px' : '0'");
}
.hover-card:nth-last-child(1) .colored-border {
    border-bottom-left-radius: v-bind("useBorderRadius ? '4px' : '0'");
    border-bottom-right-radius: v-bind("useBorderRadius ? '4px' : '0'");
}
.hover-card > .content {
    transition: all .2s ease-out;
}
.hover-card.selected > .content {
    background-color: rgb(var(--color-skygray-light));
}
</style>
