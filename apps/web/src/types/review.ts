export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  userId: string;
  propertyId: string;
  user: {
    id: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ReviewSummary = {
  averageRating: number;
  reviewCount: number;
  distribution: Record<number, number>;
};

export type ReviewListResponse = {
  reviews: Review[];
  nextCursor: string | null;
  total: number;
};
