import {SkyChat} from "./skychat/SkyChat";
import * as express from "express";


// WebSocket server
new SkyChat();

// Static content
const app = express();
app.use(express.static('dist'));
app.listen(8081, () => {
    console.log('http://localhost:8081');
});
