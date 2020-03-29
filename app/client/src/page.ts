import Vue from 'vue';
import pageHeader from "./page-header";


/**
 * Main page component
 */
export default Vue.extend({

    components: {pageHeader},

    template: `
    <div id="page">
        <page-header></page-header>
        
        <div class="subpage-auth">
            <div class="shiny-block">
                <div class="header">
                    ~ SkyChat
                </div>
                <div class="content">
                    
                    <div class="form-group">
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
