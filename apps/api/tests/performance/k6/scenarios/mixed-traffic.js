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

export function authFlow(baseUrl) {
  const res = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({
      phone: '+966500001001',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth-login' },
    },
  );
  check(res, { 'auth status 200': (r) => r.status === 200 });
  return res;
}

export function createProperty(baseUrl, token) {
  const res = http.post(
    `${baseUrl}/properties`,
    JSON.stringify({
      title: 'k6 Test Property',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '2500.00',
      currency: 'SAR',
      whatsapp_number: '+966500009001',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      tags: { name: 'create-property' },
    },
  );
  check(res, { 'create status 201': (r) => r.status === 201 });
  return res;
}

export function mixedTraffic(baseUrl, token) {
  const roll = Math.random();
  if (roll < 0.6) return browseProperties(baseUrl);
  if (roll < 0.8) return searchProperties(baseUrl);
  if (roll < 0.9) return authFlow(baseUrl);
  return createProperty(baseUrl, token);
}
