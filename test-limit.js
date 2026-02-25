import { ghlFetchAll } from './src/ghl-client.js';
async function test() {
    try {
        console.log('Testing ghlFetchAll for workflows skip limit...');
        const r = await ghlFetchAll('/workflows/', { locationId: 'test' }, { dataKey: 'workflows', limit: null });
        console.log('Success:', r.length);
    } catch (e) {
        console.error('Expected URL in error:', e.message);
    }
}
test();
