import http from 'k6/http';
import { check } from 'k6';

export function browseProperties(baseUrl) {
  const res = http.get(`${baseUrl}/properties?page=1&limit=20`, {
    tags: { name: 'browse' },
  });
  check(res, { 'browse status 200': (r) => r.status === 200 });
  return res;
}

export function searchProperties(baseUrl) {
  const queries = ['apartment', 'villa', 'studio', 'chalet', 'furnished'];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`${baseUrl}/properties?q=${q}&page=1`, {
    tags: { name: 'search' },
  });
  check(res, { 'search status 200': (r) => r.status === 200 });
  return res;
}

export function viewDetail(baseUrl) {
  const res = http.get(`${baseUrl}/properties?page=1&limit=1`, {
    tags: { name: 'detail-lookup' },
  });
  if (res.status !== 200) return res;
  try {
    const body = JSON.parse(res.body);
    if (body.properties && body.properties.length > 0) {
      const id = body.properties[0].id;
      const detailRes = http.get(`${baseUrl}/properties/${id}`, {
        tags: { name: 'property-detail' },
      });
      check(detailRes, { 'detail status 200': (r) => r.status === 200 });
      return detailRes;
    }
  } catch {
    /* ignore parse errors */
  }
  return res;
}

export function mixedTraffic(baseUrl) {
  const roll = Math.random();
  if (roll < 0.55) return browseProperties(baseUrl);
  if (roll < 0.8) return searchProperties(baseUrl);
  return viewDetail(baseUrl);
}
