<template>
    <div class="room-list">
        <h2 class="title">Channels</h2>
        <div class="subtitle"><h3>text</h3></div>
        <hover-card v-for="room in rooms"
            :key="room.id"
            :selected="currentRoom === room.id"
            :highlighted="user.id > 0 && (user.data.plugins.lastseen[room.id] || 0) < room.lastReceivedMessageId && currentRoom !== room.id"
            :border-color="'#9b71b9'"
            class="room"
            @click.native="joinRoom(room.id)"
        >
            <div class="room-content">
                <div class="room-icon material-icons md-18">tag</div>
                <div class="room-name" :title="room.name">
                    <b>{{room.name}}</b>
                </div>
                <div class="room-meta">
                    <div v-show="roomConnectedCounts[room.id]"
                        class="room-users mr-1"
                        title="Users in this room">
                        <i class="material-icons md-14">{{roomConnectedCounts[room.id] > 1 ? 'group' : 'person'}}</i>
                        <span>{{ roomConnectedCounts[room.id] }}</span>
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
            }
        }
    }
}

</style>
