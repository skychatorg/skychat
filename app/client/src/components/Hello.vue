<template>
    <div>
        <p>{{message}}</p>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";

    export default Vue.extend({

        props: [],

        data() {
            return {
                message: 'Hello'
            }
        },
    });
</script>

<style>
    .greeting {
        font-size: 20px;
    }
</style>
