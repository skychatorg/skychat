<script setup>
/**
 * A bar that drains once over `ms`, starting over whenever `deadline` changes.
 * One CSS animation, not a width set on every tick: that made it jump back in Firefox
 */
defineProps({
    deadline: { type: Number, default: null },
    ms: { type: Number, required: true },
    hurry: { type: Boolean, default: false },
});
</script>

<template>
    <div class="bar" :class="{ hurry }" aria-hidden="true">
        <span :key="deadline" :style="{ animationDuration: `${ms}ms` }"></span>
    </div>
</template>

<style scoped>
.bar {
    border-radius: 3px;
    background: rgb(255 255 255 / 0.1);
    overflow: hidden;
}
.bar span {
    display: block;
    height: 100%;
    background: #f0c46c;
    transform-origin: left;
    animation: drain linear forwards;
}
.hurry span {
    background: #ff8fa3;
}
@keyframes drain {
    to {
        transform: scaleX(0);
    }
}
</style>
