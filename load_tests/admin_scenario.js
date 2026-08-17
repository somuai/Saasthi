import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE_URL = 'http://127.0.0.1:8001/api/v1';

export function adminScenario(userData) {
    const headers = {
        'Authorization': `Bearer ${userData.token}`,
        'Content-Type': 'application/json'
    };

    // 1. Fetch Dashboard Stats
    const dashRes = http.get(`${API_BASE_URL}/dashboard/summary/`, { headers });
    check(dashRes, {
        'dashboard stats status is 200': (r) => r.status === 200,
    });
    
    sleep(Math.random() * 2 + 1);

    // 2. Fetch Patients List
    const patientsRes = http.get(`${API_BASE_URL}/registry/patients/?limit=50`, { headers });
    check(patientsRes, {
        'patients list status is 200': (r) => r.status === 200,
    });

    sleep(Math.random() * 3 + 2);
}
