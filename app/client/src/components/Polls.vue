<template>

    <div class="polls">

        <div v-if="pollResult">
            <div class="poll">
                <div class="info">
                    <div class="poll-title">
                        Result of: {{pollResult.title}}
                    </div>
                    <div class="poll-content">
                        {{pollResult.content}}<br>
                        <br>
                        RESULT: {{typeof pollResult.result === 'undefined' ? 'NONE' : (pollResult.result ? 'YES' : 'NO')}}
                    </div>
                    <div class="poll-actions">
                        <button @click="clear" class="skychat-button">
                            CLEAR
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-show="polls.length > 0">
            <div v-for="poll in polls" class="poll pending">
                <div class="info">
                    <div class="poll-title">
                        {{poll.title}}
                    </div>
                    <div class="poll-content">
                        {{poll.content}}
                    </div>
                    <div class="poll-actions">
                        <button @click="vote(poll, true)" class="skychat-button">
                            YES ({{poll.yesCount}})
                        </button>
                        <button @click="vote(poll, false)" class="skychat-button">
                            NO ({{poll.noCount}})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        methods: {
            vote: function(poll, response) {
                this.$client.vote(poll.id, response);
            },
            clear: function() {
                this.$store.commit('CLEAR_POLL_RESULT');
            }
        },
        computed: {
            polls: function() {
                return this.$store.state.polls;
            },
            pollResult: function() {
                return this.$store.state.pollResult;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .polls {
        padding-right: 20px;
        padding-left: 6px;
        color: white;

        >* {
            padding-top: 40px;
        }

        .poll {
            width: 100%;
            display: flex;
            color: white;
            margin-top: 4px;
            transition: all 0.2s;
            background: #2b2b2f;
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
                        margin: 10px;
                        flex-grow: 1;
                    }
                }
            }
        }
    }
</style>
