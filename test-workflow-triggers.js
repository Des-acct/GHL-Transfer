import { ghlFetch } from './src/ghl-client.js';
async function test() {
    try {
        console.log('Testing GET /workflows/triggers');
        const r = await ghlFetch('/workflows/triggers');
        console.log('Success Keys:', Object.keys(r));
        console.log('Full Response:', JSON.stringify(r, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
