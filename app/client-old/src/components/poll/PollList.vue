<template>

    <div class="poll-list">

        <h2 class="title" v-show="Object.values(clientState.polls).length > 0">Polls</h2>

        <div v-show="Object.values(clientState.polls).length > 0">
            <div
                v-for="poll in Object.values(clientState.polls)"
                :key="poll.id"
                class="poll pending">
                <div class="info">
                    <div class="poll-title">
                        {{poll.title}}
                    </div>
                    <div class="poll-content">
                        {{poll.content}}
                    </div>

                    <!-- If voting in progress -->
                    <div class="poll-actions" v-if="poll.state !== 'finished' && typeof poll.opVote === 'undefined'">
                        <button @click="vote(poll, true)" class="skychat-button">
                            YES ({{poll.yesCount}})
                        </button>
                        <button @click="vote(poll, false)" class="skychat-button">
                            NO ({{poll.noCount}})
                        </button>
                    </div>

                    <!-- If voting in progress but an admin forced the result -->
                    <div class="poll-actions" v-if="poll.state !== 'finished' && typeof poll.opVote !== 'undefined'">
                        An admin voted `{{ poll.opVote ? 'yes' : 'no' }}`
                    </div>

                    <!-- If poll finished -->
                    <div v-if="poll.state === 'finished'">
                        <div>RESULT: {{typeof poll.result === 'undefined' ? 'NONE' : (poll.result ? 'YES' : 'NO')}}</div>
                        <div v-if="typeof poll.opVote !== 'undefined'">{{ typeof poll.opVote === 'boolean' ? ' (Vote overridden by admin)' : ''}}</div>
                        <br>
                        <div class="poll-actions">
                            <button @click="clear(poll.id)" class="skychat-button">
                                CLEAR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Vue from "vue";
import { mapGetters, mapActions } from "vuex";

export default Vue.extend({
    created: function() {
        this.Object = Object;
    },
    methods: {
        ...mapActions('SkyChatClient', [
            "sendMessage",
        ]),
        vote: function(poll, response) {
            this.sendMessage(`/poll ${poll.id} ${answer ? 'y' : 'n'}`);
        },
        clear: function(pollId) {
            //this.$store.commit('App/CLEAR_POLL', pollId);
        }
    },
    computed: {
        ...mapGetters('SkyChatClient', [
            'clientState'
        ]),
    }
});
</script>

<style lang="scss" scoped>

    .poll-list {
        padding-right: 20px;
        color: white;

        .poll {
            width: 100%;
            display: flex;
            color: white;
            margin-top: 4px;
            transition: all 0.2s;
            background: #242427;
            border-left: 4px solid #ff6d6d;

            &.pending {
                background: #290808;
            }

            &:hover {
                border-width: 0;
                margin-left: 4px;
                background: #313235;
            }

            >.info {
                padding-top: 6px;
                padding-left: 8px;
                padding-bottom: 10px;
                position: relative;
                flex-grow: 1;
                width: 0;
                display: flex;
                flex-direction: column;

                >.poll-title {
                    display: inline;
                    color: #ff6d6d;
                    font-weight: 800;
                    margin-bottom: 4px;
                    font-size: 110%;
                }
                >.poll-content {
                    margin-top: 0;
                    margin-bottom: 10px;
                }
                >.poll-actions {
                    display: flex;
                    justify-content: center;

                    >* {
                        margin-left: 10px;
                        margin-right: 10px;
                        flex-grow: 1;
                    }
                }
            }
        }
    }
</style>
