import { ghlFetch } from './src/ghl-client.js';
async function test() {
    try {
        const id = 'edd2cb95-9de3-419c-817b-c5a364a3353c';
        console.log('Testing GET /workflows/' + id + '/definition');
        const r = await ghlFetch('/workflows/' + id + '/definition');
        console.log('Success Keys:', JSON.stringify(Object.keys(r)));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
