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

        created() {
            console.log('d1', this.$client);
            console.log('d2', this.$store);
        }
    });
</script>

<style>
    .greeting {
        font-size: 20px;
    }
</style>
