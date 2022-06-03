<template>
    <div class="file-manager">
        <div class="file-list">
            <hover-card
                v-for="filePath in clientState.files"
                :key="filePath"
                :border-color="'#afafaf'"
                :clickable="true"
                :selected="clientState.file && clientState.file.filePath === filePath"
                class="file-card"
                @click.native="loadFile(filePath)"
            >
                <div class="file">
                    {{ filePath.split('/')[1] }}
                </div>
            </hover-card>
        </div>
        <div class="file-editor" v-if="clientState.file">
            <div class="file-content">
                <p>Editing {{ clientState.file.filePath }}</p>
                <textarea class="editor scrollbar" v-model="content" spellcheck=”false”></textarea>
            </div>
            <div class="actions">
                <button
                    v-show="content !== clientState.file.content"
                    @click="save" class="skychat-button">Save</button>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapActions, mapGetters } from 'vuex';
    import HoverCard from "../util/HoverCard.vue";

    export default Vue.extend({
        
        components: { HoverCard },

        props: [],

        data: function() {
            return {
                content: '',
            }
        },

        watch: {
            'clientState.file.filePath': function() {
                this.content = this.clientState.file.content;
            },
        },

        mounted: function() {
            this.update();
            if (this.clientState.file) {
                this.content = this.clientState.file.content;
            }
        },

        methods: {
            ...mapActions('SkyChatClient', [
                'sendMessage',
            ]),
            update: function() {
                this.sendMessage('/filelist');
            },
            loadFile: function(filePath) {
                this.sendMessage('/fileget ' + filePath);
            },
            save: function() {
                this.sendMessage(`/fileset ${this.clientState.file.filePath} ${this.content}`);
            },
        },

        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState',
            ]),
        },
    });
</script>

<style lang="scss" scoped>

.file-manager {
    height: 100%;
    width: 100%;
    display: flex;

    .file-list {
        min-width: 100px;
        flex-basis: 220px;
        margin-right: 20px;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;

        .file-card {
            margin-top: 5px;
            
            .file {
                padding: 5px 10px;
            }
        }
    }

    .file-editor {
        min-width: 0;
        flex-grow: 1;
        margin-top: 20px;
        display: flex;
        flex-direction: column;

        .file-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;

            .editor {
                background-color: transparent;
                color: white;
                padding: 10px;
                width: 100%;
                flex-grow: 1;
                resize: none;
            }
        }

        .actions {
            display: flex;
            padding-top: 10px;
            flex-basis: 40px;

            button {
                padding: 5px 10px;
                flex-grow: 1;
                background: #18191c;
                color: white;
            }
        }
    }
}
</style>
