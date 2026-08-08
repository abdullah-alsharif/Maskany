export const THRESHOLDS = {
  http_req_duration: ['p(95)<200', 'p(99)<500'],
  errors: ['rate<0.01'],
  iteration_duration: ['p(95)<5000'],
};
