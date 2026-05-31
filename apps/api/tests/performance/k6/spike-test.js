import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 1 },
    { duration: '5s', target: 200 },
    { duration: '30s', target: 200 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.02'],
  },
};

export default function () {
  const BASE = 'http://localhost:3001/api';
  const res = http.get(`${BASE}/properties?page=1&limit=20`, {
    tags: { name: 'spike' },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  sleep(1);
}
