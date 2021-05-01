<template>
    <div class="room-list">
        <h2 class="title">Channels</h2>
        <div v-for="room in rooms"
            :key="room.id"
            class="room"
            :class="{
                'selected': currentRoom === room.id,
                'has-unread': user.id > 0 && (user.data.plugins.lastseen[room.id] || 0) < room.lastReceivedMessageId
            }"
            @click="joinRoom(room.id)"
        >
            <span class="material-icons md-18 room-icon">tag</span>
            <div class="room-name" :title="room.name">
                <b>{{room.name}}</b>
            </div>
            <div class="room-meta">
                <div v-show="room.plugins.yt"
                    class="room-player mr-1"
                    title="A video is currently playing in this room">
                    <i class="material-icons md-14">movie</i>
                </div>
                <div v-show="roomConnectedCounts[room.id]"
                    class="room-users mr-1"
                    title="Users in this room">
                    <i class="material-icons md-14">{{roomConnectedCounts[room.id] > 1 ? 'group' : 'person'}}</i>
                     <span>{{ roomConnectedCounts[room.id] }}</span>
                </div>
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
            user: function() {
                return this.$store.state.user;
            },
        },
    });
</script>

<style lang="scss" scoped>

.room-list {
    padding-top: 20px;
    padding-right: 10px;
    padding-left: 10px;
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

        &:hover:not(.selected) {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        &.selected {
            margin-left: 8px;
            background: #424248;
        }

        .room-icon {
            margin-top: 10px;
            margin-left: 4px;
        }

        .room-name {
            flex-grow: 1;
            margin-top: 10px;
            margin-left: 4px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .room-meta {
            flex-basis: 85px;
            margin-top: 10px;
            display: flex;
            flex-direction: row-reverse;

            .room-users {
                color: #8ecfff;
                span { vertical-align: top; }
            }

            .room-player {
                color: #ff8f8f;
            }
        }
    }
}

</style>
