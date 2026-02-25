import { ghlFetch } from './src/ghl-client.js';
async function test() {
    try {
        console.log('Testing GET /automations/workflows');
        const r = await ghlFetch('/automations/workflows');
        console.log('Success Keys:', JSON.stringify(Object.keys(r)));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
