<script setup>
import { reactive, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useClientStore } from '@/stores/client';

const client = useClientStore();
const router = useRouter();

const state = reactive({
    username: '',
    password: '',
});


/**
 * When current room changes, auto switch to the room.
 */
watch(() => client.state.currentRoomId, function(newRoomId, oldRoomId) {
    if (oldRoomId === null && newRoomId >= 0) {
        router.push({ name: 'app', params: { } });
    }
});

const joinAsGuest = function() {
    client.join(client.state.rooms[0].id);
    if (client.state.playerChannels.length > 0) {
        client.sendMessage('/playerchannel join ' + client.state.playerChannels[0].id);
    }
};

</script>

<template>

    <!-- Grid -->
    <div class="home-view">

        <!-- Row -->
        <div class="auth bg-skygray-darker p-4 rounded w-full text-center">

            <!-- Main content -->
            <p class="font-bold mt-2 mb-8 text-3xl">Login / Register</p>
            <div class="px-4 grid grid-cols-4 gap-4">
                <input class="form-control col-start-1 col-span-4" type="text" placeholder="Username" v-model="state.username" />
                <input class="form-control col-start-1 col-span-4" type="password" placeholder="Password" v-model="state.password" />
                <button @click="client.login({ username: state.username, password: state.password })" class="form-control col-span-2">Login</button>
                <button @click="client.register({ username: state.username, password: state.password })" class="form-control col-span-2">Register</button>
                <hr class="col-span-4">
                <p class="col-span-4">or</p>
                <button @click="joinAsGuest" class="form-control col-start-2 col-span-2">Continue as guest</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.home-view {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    margin-top: 10vh;
}
.auth {
    max-height: 500px;
}
</style>
