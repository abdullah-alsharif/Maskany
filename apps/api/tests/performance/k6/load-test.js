import { sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { mixedTraffic } from './scenarios/mixed-traffic.js';
import { THRESHOLDS } from './thresholds.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: THRESHOLDS,
};

export default function () {
  const BASE = 'http://localhost:3001/api';
  const res = mixedTraffic(BASE, '');
  errorRate.add(res.status !== 200);
  sleep(0.5 + Math.random() * 1.5);
}
