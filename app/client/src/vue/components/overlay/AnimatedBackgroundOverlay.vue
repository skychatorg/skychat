<template>
    <div class="animated-background"
        :style="{
            'background': gradientCss
        }">
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        methods: {

        },
        computed: {
            playerIntensity: function() {
                return this.$store.state.playerIntensity;
            },
            gradientCss: function() {
                let css = 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, ';
                css += `rgba(255, 255, 255, ${this.playerIntensity / 8}) 94%, `;
                css += `rgba(255, 255, 255, ${this.playerIntensity / 4}) 100%`;
                return css;
            },
        }
    });
</script>

<style lang="scss" scoped>
    .animated-background {
        width: 100%;
        height: 100%;
        position: absolute;
        z-index: -10;
    }
</style>
