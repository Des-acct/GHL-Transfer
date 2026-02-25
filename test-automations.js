import { ghlFetch } from './src/ghl-client.js';
async function test() {
    try {
        console.log('Testing GET /automations/');
        const r = await ghlFetch('/automations/');
        console.log('Success Keys:', Object.keys(r));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
