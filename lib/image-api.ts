/**
 * Image API Integration
 * Fetches stock photos from Pexels and Pixabay
 */

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

export interface ImageResult {
  url: string;
  thumbnail: string;
  alt: string;
  photographer?: string;
  source: 'pexels' | 'pixabay';
}

/**
 * Search Pexels for images
 */
async function searchPexels(query: string, perPage: number = 5): Promise<ImageResult[]> {
  if (!PEXELS_API_KEY) {
    console.log('   ⚠️  Pexels API key not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      {
        headers: { Authorization: PEXELS_API_KEY }
      }
    );

    if (!response.ok) {
      console.log(`   ⚠️  Pexels API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.photos.map((photo: any) => ({
      url: photo.src.large,
      thumbnail: photo.src.medium,
      alt: query,
      photographer: photo.photographer,
      source: 'pexels' as const
    }));
  } catch (error) {
    console.error('   ❌ Pexels fetch error:', error);
    return [];
  }
}

/**
 * Search Pixabay for images
 */
async function searchPixabay(query: string, perPage: number = 5): Promise<ImageResult[]> {
  if (!PIXABAY_API_KEY) {
    console.log('   ⚠️  Pixabay API key not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${perPage}&orientation=horizontal`
    );

    if (!response.ok) {
      console.log(`   ⚠️  Pixabay API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.hits.map((image: any) => ({
      url: image.largeImageURL,
      thumbnail: image.webformatURL,
      alt: query,
      photographer: image.user,
      source: 'pixabay' as const
    }));
  } catch (error) {
    console.error('   ❌ Pixabay fetch error:', error);
    return [];
  }
}

/**
 * Search for stock images using available APIs
 * Falls back through: Pexels → Pixabay
 */
export async function searchStockImages(query: string, count: number = 5): Promise<ImageResult[]> {
  console.log(`\n📸 Searching for stock images: "${query}"`);

  // Try Pexels first
  let images = await searchPexels(query, count);

  if (images.length >= count) {
    console.log(`   ✅ Found ${images.length} images from Pexels`);
    return images.slice(0, count);
  }

  // Try Pixabay as fallback
  const pixabayImages = await searchPixabay(query, count - images.length);
  images = [...images, ...pixabayImages];

  if (images.length > 0) {
    console.log(`   ✅ Found ${images.length} images (Pexels + Pixabay)`);
    return images.slice(0, count);
  }

  console.log(`   ⚠️  No images found for "${query}"`);
  return [];
}

/**
 * Get images for a blog post topic
 * Tries the main keyword first, then falls back to topic words
 */
export async function getImagesForTopic(
  topicTitle: string,
  keyword: string,
  count: number = 3
): Promise<ImageResult[]> {
  // Try keyword first
  let images = await searchStockImages(keyword, count);

  if (images.length >= count) {
    return images;
  }

  // Extract meaningful words from title as fallback
  const titleWords = topicTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(word => word.length > 4 && !['about', 'what', 'when', 'where', 'which', 'guide'].includes(word));

  if (titleWords.length > 0) {
    const fallbackQuery = titleWords.slice(0, 2).join(' ');
    console.log(`   🔄 Trying fallback query: "${fallbackQuery}"`);
    const fallbackImages = await searchStockImages(fallbackQuery, count - images.length);
    images = [...images, ...fallbackImages];
  }

  return images.slice(0, count);
}
