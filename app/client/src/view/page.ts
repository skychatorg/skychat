import Vue from "vue";
import {PageHeader} from "./page-header";


/**
 * Main page component
 */
export const Page = Vue.extend({

    components: {
        'page-header': PageHeader
    },

    template: `
    <div id="page">
        <page-header></page-header>
        
        <div class="subpage-auth">
            <div class="shiny-block">
                <div class="header">
                    ~ SkyChat
                </div>
                <div class="content">
                    
                    <div class="form-group mt-1">
                        <button class="btn btn-full">Login</button>
                        <button class="btn btn-full mt-1">Register</button>
                        <button class="btn btn-full mt-1">Login as guest</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `
});
