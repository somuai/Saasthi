import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE_URL = 'http://127.0.0.1:8001/api/v1';

export function ashaWorkerScenario(userData) {
    const headers = {
        'Authorization': `Bearer ${userData.token}`,
        'Content-Type': 'application/json'
    };

    // 1. Sync Pull
    const pullRes = http.get(`${API_BASE_URL}/sync/pull/?lastPulledAt=0`, { headers });
    check(pullRes, {
        'sync pull status is 200': (r) => r.status === 200,
    });
    
    sleep(Math.random() * 2 + 1); // Think time 1-3 seconds

    // 2. Sync Push (simulating sending some data)
    const pushPayload = JSON.stringify({
        changes: {
            patients: {
                created: [],
                updated: [],
                deleted: []
            },
            flags: {
                created: [],
                updated: [],
                deleted: []
            }
        },
        lastPulledAt: 0
    });
    
    const pushRes = http.post(`${API_BASE_URL}/sync/push/`, pushPayload, { headers });
    check(pushRes, {
        'sync push status is 200': (r) => r.status === 200,
    });

    sleep(Math.random() * 5 + 2); // Think time 2-7 seconds
}
