<template>
    <div class="room-list" v-show="rooms.length > 1 || op">
        <div class="subtitle">
            <h3>
                text
                <span v-show="op" @click="createRoom()" class="room-create material-icons md-12">add</span>
            </h3>
        </div>
        <hover-card v-for="room in rooms"
            :key="room.id"
            :selected="currentRoom === room.id"
            :highlighted="user.id > 0 && (user.data.plugins.lastseen[room.id] || 0) < room.lastReceivedMessageId && currentRoom !== room.id"
            :border-color="'#afafaf'"
            class="room"
            @click.native="joinRoom(room.id)"
        >
            <div class="room-content">
                <div class="room-icon material-icons md-18">tag</div>
                <div class="room-name" :title="room.name">
                    <b>{{room.name}}</b>
                </div>
                <div class="room-meta">

                    <!-- delete room (op) -->
                    <div v-show="currentRoom === room.id && op"
                        @click="deleteRoom()"
                        class="room-delete mr-1"
                        title="Delete this channel">
                        <i class="material-icons md-14">close</i>
                    </div>

                    <!-- user count -->
                    <div v-if="roomConnectedUsers[room.id] && roomConnectedUsers[room.id].length > 0"
                        class="room-users mr-1"
                        title="Users in this room">
                        <i class="material-icons md-14">{{roomConnectedUsers[room.id].length > 1 ? 'group' : 'person'}}</i>
                        <span>{{ roomConnectedUsers[room.id].length }}</span>
                    </div>
                </div>
            </div>
        </hover-card>
    </div>
</template>

<script>
    import Vue from "vue";
    import HoverCard from "../util/HoverCard.vue";

    export default Vue.extend({
        components: { HoverCard },
        props: { },
        methods: {
            joinRoom: function(id) {
                this.$client.joinRoom(id);
            },
            createRoom: function() {
                this.$client.createRoom();
            },
            deleteRoom: function() {
                this.$client.deleteCurrentRoom();
            }
        },
        computed: {
            rooms: function() {
                return this.$store.state.rooms;
            },
            currentRoom: function() {
                return this.$store.state.currentRoom;
            },
            roomConnectedUsers: function() {
                return this.$store.state.roomConnectedUsers;
            },
            user: function() {
                return this.$store.state.user;
            },
            op: function() {
                return this.$store.state.op;
            },
        },
    });
</script>

<style lang="scss" scoped>

.room-list {
    color: white;

    .subtitle {
        width: 100%;
        height: 16px;
        background: #242427;
        margin-top: 4px;
        text-align: center;

        h3 {
            color: #b4b4b4;
            font-size: 10px;
            text-transform: uppercase;
            padding-top: 2px;
        }

        .room-create {
            cursor: pointer;
            vertical-align: bottom;
        }
    }

    .room {
        
        height: 35px;
        margin-top: 4px;
        
        .room-content {
            display: flex;

            .room-icon {
                flex-basis: 20px;
                margin-top: 8px;
                margin-left: 10px;
            }

            .room-name {
                flex-grow: 1;
                margin-top: 8px;
                margin-left: 2px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .room-meta {
                flex-basis: 65px;
                margin-top: 10px;
                display: flex;
                flex-direction: row-reverse;

                .room-users {
                    color: #8ecfff;
                    span { vertical-align: top; }
                }

                .room-delete {
                    color: #ff8e8e;
                }
            }
        }
    }
}

</style>
