export interface InsightsStats {
  totalListings: number;
  activeListings: number;
  inactiveListings: number;
  draftListings: number;
  totalViews30d: number;
  totalInquiries30d: number;
}

export interface HealthBreakdown {
  criteria: string;
  label: string;
  met: boolean;
  points: number;
}

export interface InsightsProperty {
  id: string;
  title: string;
  city: string;
  propertyType: string;
  status: string;
  coverImage: {
    url: string;
    thumbnailUrl: string | null;
    altText: string | null;
  } | null;
  viewCount30d: number;
  inquiryCount30d: number;
  healthScore: number;
  healthBreakdown: HealthBreakdown[];
}

export interface InsightsResponse {
  stats: InsightsStats;
  properties: InsightsProperty[];
  topProperties: InsightsProperty[];
  viewsOverTime: { date: string; views: number }[];
}
