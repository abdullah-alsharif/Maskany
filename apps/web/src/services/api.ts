import axios from 'axios';

const envBaseUrl = (process.env['NEXT_PUBLIC_API_URL'] ?? '').trim();
const baseURL = envBaseUrl.length > 0 ? envBaseUrl : '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});
