-- Verify index usage on listing query
EXPLAIN ANALYZE SELECT id, title, price, city, property_type
  FROM properties WHERE status = 'active'
  ORDER BY created_at DESC LIMIT 20;

-- Full-text search plan (ILIKE-based search as used by search-service.ts)
EXPLAIN ANALYZE SELECT id, title, summary, city, area
  FROM properties
  WHERE title ILIKE '%apartment%'
     OR summary ILIKE '%apartment%'
     OR description ILIKE '%apartment%'
     OR city ILIKE '%apartment%'
     OR area ILIKE '%apartment%'
  ORDER BY
    (CASE WHEN title    ILIKE '%apartment%' THEN 5 ELSE 0 END) +
    (CASE WHEN city     ILIKE '%apartment%' THEN 4 ELSE 0 END) +
    (CASE WHEN summary  ILIKE '%apartment%' THEN 3 ELSE 0 END) +
    (CASE WHEN area     ILIKE '%apartment%' THEN 2 ELSE 0 END) +
    (CASE WHEN description ILIKE '%apartment%' THEN 1 ELSE 0 END) DESC,
    id ASC
  LIMIT 20;

-- Filter + sort plan
EXPLAIN ANALYZE SELECT id, title, price FROM properties
  WHERE status = 'active' AND property_type = 'VILLA' AND price BETWEEN 1000 AND 5000
  ORDER BY price ASC LIMIT 20;

-- Review aggregation plan (used by property detail)
EXPLAIN ANALYZE SELECT
    AVG(rating)::numeric(2,1) AS average_rating,
    COUNT(*) AS review_count
  FROM reviews
  WHERE property_id = '00000000-0000-0000-0000-000000000001';

-- Media query plan (used by property detail)
EXPLAIN ANALYZE SELECT id, media_type, url, thumbnail_url, sort_order
  FROM property_media
  WHERE property_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY sort_order ASC;
