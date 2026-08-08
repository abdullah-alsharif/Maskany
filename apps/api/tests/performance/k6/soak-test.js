import { sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { mixedTraffic } from './scenarios/mixed-traffic.js';
import { THRESHOLDS } from './thresholds.js';

const errorRate = new Rate('errors');

export const options = {
  vus: 100,
  duration: '30m',
  thresholds: THRESHOLDS,
};

export default function () {
  const BASE = 'http://localhost:3001/api';
  const res = mixedTraffic(BASE);
  errorRate.add(res.status !== 200);
  sleep(1 + Math.random() * 2);
}
