<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <header class="header bg-skygray-white/10 backdrop-brightness-150 w-full">
        <div class="header-content grid grid-cols-12">
            <div class="col-start-1 col-span-3 my-4 ml-8 flex">
                <img class="hidden logo" src="/assets/logo.png" width="60" height="60">
                <div class="text-skygray-lightest text-xl font-bold mt-2">
                    SkyChat
                </div>
            </div>
            <div class="col-start-10 col-span-3 text-center flex flex-col justify-center">
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
