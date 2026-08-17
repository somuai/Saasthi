import { ashaWorkerScenario } from './asha_worker_scenario.js';
import { adminScenario } from './admin_scenario.js';
import { SharedArray } from 'k6/data';

const usersData = new SharedArray('users', function () {
    return [JSON.parse(open('../backend/users.json'))];
});

export const options = {
    scenarios: {
        asha_workers: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 1000 },
                { duration: '1m', target: 1000 },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '10s',
            exec: 'runAshaScenario'
        },
        admins: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '15s', target: 100 },
                { duration: '1m30s', target: 100 },
                { duration: '15s', target: 0 },
            ],
            gracefulRampDown: '10s',
            exec: 'runAdminScenario'
        }
    },
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01']    // Less than 1% of requests can fail
    }
};

export function runAshaScenario() {
    const data = usersData[0].ashas;
    const user = data[__VU % data.length];
    ashaWorkerScenario(user);
}

export function runAdminScenario() {
    const data = usersData[0].admins;
    const user = data[__VU % data.length];
    adminScenario(user);
}
