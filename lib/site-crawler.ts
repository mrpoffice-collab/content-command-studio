import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  contentPreview: string; // First 500 chars
  wordCount: number;
  images: CrawledImage[];
}

export interface CrawledImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  priority?: string;
}

/**
 * Fetch and parse XML sitemap
 */
export async function parseSitemap(sitemapUrl: string): Promise<SitemapEntry[]> {
  try {
    console.log(`📄 Fetching sitemap: ${sitemapUrl}`);

    const response = await axios.get(sitemapUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Content-Command-Studio-Bot/1.0'
      }
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls: SitemapEntry[] = [];

    // Handle standard sitemap format
    $('url').each((_, element) => {
      const loc = $(element).find('loc').text();
      const lastmod = $(element).find('lastmod').text();
      const priority = $(element).find('priority').text();

      if (loc) {
        urls.push({
          url: loc,
          lastmod: lastmod || undefined,
          priority: priority || undefined,
        });
      }
    });

    // Handle sitemap index (sitemaps that link to other sitemaps)
    if (urls.length === 0) {
      const sitemapIndexUrls: string[] = [];
      $('sitemap').each((_, element) => {
        const loc = $(element).find('loc').text();
        if (loc) {
          sitemapIndexUrls.push(loc);
        }
      });

      // Recursively fetch sub-sitemaps
      for (const subSitemapUrl of sitemapIndexUrls) {
        const subUrls = await parseSitemap(subSitemapUrl);
        urls.push(...subUrls);
      }
    }

    console.log(`   ✅ Found ${urls.length} URLs in sitemap`);
    return urls;
  } catch (error: any) {
    console.error(`   ❌ Failed to parse sitemap: ${error.message}`);
    return [];
  }
}

/**
 * Discover sitemap URL from robots.txt or common locations
 */
export async function discoverSitemap(baseUrl: string): Promise<string | null> {
  const parsedUrl = new URL(baseUrl);
  const origin = parsedUrl.origin;

  // Try common sitemap locations
  const commonLocations = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/wp-sitemap.xml`, // WordPress
  ];

  console.log(`🔍 Discovering sitemap for ${baseUrl}...`);

  // First, try robots.txt
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const response = await axios.get(robotsUrl, { timeout: 5000 });
    const robotsTxt = response.data;

    // Look for Sitemap directive
    const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.+)/i);
    if (sitemapMatch) {
      const sitemapUrl = sitemapMatch[1].trim();
      console.log(`   ✅ Found sitemap in robots.txt: ${sitemapUrl}`);
      return sitemapUrl;
    }
  } catch (error) {
    console.log(`   ℹ️  No robots.txt found`);
  }

  // Try common locations
  for (const location of commonLocations) {
    try {
      const response = await axios.head(location, { timeout: 5000 });
      if (response.status === 200) {
        console.log(`   ✅ Found sitemap at: ${location}`);
        return location;
      }
    } catch (error) {
      // Continue to next location
    }
  }

  console.log(`   ❌ No sitemap found`);
  return null;
}

/**
 * Scrape a single page
 */
export async function scrapePage(url: string): Promise<CrawledPage | null> {
  try {
    console.log(`   📄 Scraping: ${url}`);

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Content-Command-Studio-Bot/1.0'
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Extract title
    const title = $('title').text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('h1').first().text().trim() ||
                  'Untitled';

    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr('content') ||
                            $('meta[property="og:description"]').attr('content') ||
                            '';

    // Extract main content (try to avoid header/footer/nav)
    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('header').remove();
    $('footer').remove();
    $('.navigation').remove();
    $('.menu').remove();

    const bodyText = $('main').text() || $('article').text() || $('body').text();
    const cleanText = bodyText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    const contentPreview = cleanText.substring(0, 500);
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

    // Extract images
    const images: CrawledImage[] = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      const width = parseInt($(element).attr('width') || '0');
      const height = parseInt($(element).attr('height') || '0');

      if (src) {
        // Convert relative URLs to absolute
        let absoluteUrl = src;
        if (!src.startsWith('http')) {
          try {
            const pageUrl = new URL(url);
            absoluteUrl = new URL(src, pageUrl.origin).href;
          } catch (e) {
            // Skip invalid URLs
            return;
          }
        }

        images.push({
          url: absoluteUrl,
          alt,
          width: width || undefined,
          height: height || undefined,
        });
      }
    });

    console.log(`      ✅ Scraped: ${title} (${wordCount} words, ${images.length} images)`);

    return {
      url,
      title,
      metaDescription,
      contentPreview,
      wordCount,
      images,
    };
  } catch (error: any) {
    console.error(`      ❌ Failed to scrape ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Crawl a website (discover sitemap and scrape pages)
 */
export async function crawlWebsite(
  baseUrl: string,
  maxPages: number = 50
): Promise<CrawledPage[]> {
  console.log(`\n🕷️  Starting website crawl: ${baseUrl}`);
  console.log(`   Max pages: ${maxPages}\n`);

  // Discover sitemap
  const sitemapUrl = await discoverSitemap(baseUrl);

  let urlsToScrape: string[] = [];

  if (sitemapUrl) {
    // Parse sitemap
    const sitemapEntries = await parseSitemap(sitemapUrl);
    urlsToScrape = sitemapEntries.map(entry => entry.url).slice(0, maxPages);
  } else {
    // Fallback: just scrape the homepage and try to find links
    console.log(`   ℹ️  No sitemap found, will scrape homepage only`);
    urlsToScrape = [baseUrl];
  }

  // Scrape pages
  console.log(`\n📖 Scraping ${urlsToScrape.length} pages...\n`);
  const crawledPages: CrawledPage[] = [];

  for (const url of urlsToScrape) {
    const page = await scrapePage(url);
    if (page) {
      crawledPages.push(page);
    }

    // Be nice to the server - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Crawl complete: ${crawledPages.length} pages scraped\n`);
  return crawledPages;
}
