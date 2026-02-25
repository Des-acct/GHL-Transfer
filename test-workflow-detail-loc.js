import { ghlFetch } from './src/ghl-client.js';
import config from './src/config.js';
async function test() {
    try {
        const workflowId = 'edd2cb95-9de3-419c-817b-c5a364a3353c';
        const loc = config.locationId;
        console.log('Testing GET /workflows/' + workflowId + '?locationId=' + loc);
        const r = await ghlFetch('/workflows/' + workflowId + '?locationId=' + loc);
        console.log('Response Keys:', Object.keys(r));
        console.log('Full Response:', JSON.stringify(r, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
