<template>
    <div class="file-manager">
        <div class="file-list">
            <hover-card
                v-for="filePath in files"
                :key="filePath"
                :border-color="'#afafaf'"
                :selected="file && file.filePath === filePath"
                class="file-card"
                @click.native="loadFile(filePath)"
            >
                <div class="file">
                    {{ filePath.split('/')[1] }}
                </div>
            </hover-card>
        </div>
        <div class="file-editor" v-if="file">
            <div class="file-content">
                <p>Editing {{ file.filePath }}</p>
                <textarea class="editor scrollbar" v-model="content" spellcheck=”false”></textarea>
            </div>
            <div class="actions">
                <button
                    v-show="content !== file.content"
                    @click="save" class="skychat-button">Save</button>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';
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
            'file.filePath': function() {
                this.content = this.file.content;
            },
        },

        mounted: function() {
            this.update();
            if (this.file) {
                this.content = this.file.content;
            }
        },

        methods: {
            update: function() {
                this.$client.sendMessage('/filelist');
            },
            loadFile: function(filePath) {
                this.$client.sendMessage('/fileget ' + filePath);
            },
            save: function() {
                this.$client.sendMessage(`/fileset ${this.file.filePath} ${this.content}`);
            },
        },

        computed: {
            ...mapState('Main', [
                'files',
                'file',
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
