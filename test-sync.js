async function test() {
    try {
        const history = await fetch('http://localhost:3000/api/exports-list/workflows').then(r => r.json());
        if (!history.success || history.exports.length === 0) {
            console.log('No history to test sync.');
            return;
        }
        const targetId = history.exports[0].id;
        console.log('Testing sync for ID:', targetId);
        
        const res = await fetch('http://localhost:3000/api/sync-workflow-logic/' + targetId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ realData: { name: "Synced Test", definition: { triggers: [{type:"TEST", label:"Real Trigger"}] } } })
        }).then(r => r.json());
        
        console.log('Sync Result:', JSON.stringify(res));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
