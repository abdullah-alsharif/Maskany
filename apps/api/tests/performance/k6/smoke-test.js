import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  const BASE = 'http://localhost:3001/api';
  const endpoints = [
    { url: '/properties?page=1&limit=20', name: 'list' },
    { url: '/properties?q=apartment&page=1', name: 'search' },
    { url: '/properties?type=VILLA&minPrice=1000', name: 'filter' },
  ];
  for (const { url, name } of endpoints) {
    const res = http.get(`${BASE}${url}`, { tags: { name } });
    check(res, { 'status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    sleep(1);
  }
}
