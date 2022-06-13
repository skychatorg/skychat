<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <header class="header bg-skygray-dark w-full">
        <div class="header-content grid grid-cols-12">
            <div class="col-start-1 col-span-3 my-4 ml-8 flex">
                <img class="logo" src="/assets/logo.png" width="60" height="60">
                <div class="text-skygray-lightest text-xl font-bold ml-12 mt-2">
                    SkyChat
                </div>
            </div>
            <div class="col-start-10 col-span-3 text-center flex flex-col justify-center">
                {{ client.state.user.username }}
            </div>
        </div>
    </header>
</template>

<style scoped>
.header {
    min-height: 70px;
    flex-basis: 70px;
}
.header-content {
    width: 100%;
    max-width: var(--page-max-width);
    margin: 0 auto;
}
</style>
