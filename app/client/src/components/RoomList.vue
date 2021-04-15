<template>
    <div class="room-list">

        <div v-for="room in rooms"
            :key="room.id"
            class="room"
            :class="{
                'selected': currentRoom === room.id,
                'has-unread': false
            }"
            @click="joinRoom(room.id)">
            <div class="room-name">
                <b># {{room.name}}<sup v-show="roomConnectedCounts[room.id]">{{roomConnectedCounts[room.id]}}</sup></b>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        components: { },
        props: { },
        methods: {
            joinRoom: function(id) {
                this.$client.joinRoom(id);
            },
        },
        computed: {
            rooms: function() {
                return this.$store.state.rooms;
            },
            currentRoom: function() {
                return this.$store.state.currentRoom;
            },
            roomConnectedCounts: function() {
                return this.$store.state.roomConnectedCounts;
            },
        },
    });
</script>

<style lang="scss" scoped>

.room-list {
    padding-top: 20px;
    padding-right: 6px;
    padding-left: 20px;
    color: white;

    .room {
        width: 100%;
        height: 35px;
        display: flex;
        color: white;
        background: #242427;
        margin-top: 4px;
        border-left: 4px solid #a3a5b4;
        transition: all 0.2s;
        cursor: pointer;

        &.has-unread {
            background: #e2b14152;
        }

        &.selected {
            margin-left: 4px;
            background: #424248;
        }

        &:hover:not(.selected) {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        .room-name {
            margin-top: 10px;
            margin-left: 14px;
        }
    }
}

</style>
