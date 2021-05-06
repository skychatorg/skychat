<template>
    <div class="hover-card"
        :class="{
            'selected': selected,
            'highlighted': highlighted,
        }">
        <div class="hover-card-border" :style="{'background-color': borderColor}"></div>
        <div class="hover-card-content">
            <slot></slot>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        
        props: ['selected', 'highlighted', 'borderColor'],

    });
</script>

<style lang="scss" scoped>

    .hover-card {

        width: 100%;
        display: flex;
        cursor: pointer;
        color: white;
        justify-content: end;
        justify-items: end;
        transition: all .2s ease-out;

        .hover-card-border {
            width: 4px;
            flex-basis: 4px;
            background-color: rgb(175, 175, 175);
            transition: all .2s ease-out;
        }

        .hover-card-content {
            flex-grow: 1;
            width: 0;
            transition: all .2s ease-out;
            background: #242427;
        }

        &.selected {
            margin-left: 4px;
        }

        &:hover:not(.selected) {

            .hover-card-border {
                flex-basis: 0;
                width: 0;
                margin-left: 4px;
            }

            .hover-card-content {
                background: #313235;
            }
        }

        &.selected .hover-card-content {
            background: #424248;
        }

        &.highlighted .hover-card-content {
            background: #e2b14152;
        }
    }

</style>
