<!--
    Global page header
-->


<template>
    <div class="page-header">
        <div class="user-info">
            <div class="username">
                parser
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    export default Vue.extend({

    });
</script>

<style scoped>
    .page-header {
        width: 100%;
        height: 50px;
    }
    .user-info {
        height: 100%;
        float: right;
        width: 200px;
        text-align: right;
        margin-right: 10px;
    }
    .username {
        width: 130px;
        display: inline-block;
    }
</style>
