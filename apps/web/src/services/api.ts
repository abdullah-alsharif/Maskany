import axios from 'axios';
import type { PropertyTranslation } from '../types/property';

const envBaseUrl = (process.env['NEXT_PUBLIC_API_URL'] ?? '').trim();
const baseURL = envBaseUrl.length > 0 ? envBaseUrl : '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface FavoriteProperty {
  propertyId: string;
  favoritedAt: string;
  property: {
    id: string;
    title: string;
    summary: string | null;
    propertyType: string;
    price: string;
    currency: string;
    priceUnit: string;
    city: string;
    area: string | null;
    country: string;
    locale: string;
    rooms: number;
    bathrooms: number;
    areaSqm: string | null;
    whatsappNumber: string;
    coverImage: {
      url: string;
      thumbnailUrl: string | null;
      altText: string | null;
    } | null;
    translation: PropertyTranslation | null;
  };
}

export interface FavoritesResponse {
  favorites: FavoriteProperty[];
}

export async function getFavorites(): Promise<FavoriteProperty[]> {
  const response = await apiClient.get<FavoritesResponse>('/favorites');
  return response.data.favorites;
}

export async function addFavorite(propertyId: string): Promise<void> {
  await apiClient.post(`/favorites/${propertyId}`);
}

export async function removeFavorite(propertyId: string): Promise<void> {
  await apiClient.delete(`/favorites/${propertyId}`);
}

export async function mergeFavorites(propertyIds: string[]): Promise<void> {
  await apiClient.post('/favorites/merge', { propertyIds });
}
