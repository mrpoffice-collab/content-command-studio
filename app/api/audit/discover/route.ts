import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as cheerio from 'cheerio';

interface DiscoveredPost {
  url: string;
  title: string;
  excerpt?: string;
  publishedDate?: string;
}

/**
 * POST /api/audit/discover
 * Discover blog posts from a blog index URL
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { blogUrl, limit = 24 } = body;

    if (!blogUrl) {
      return NextResponse.json(
        { error: 'Blog URL is required' },
        { status: 400 }
      );
    }

    console.log(`Discovering blog posts from: ${blogUrl}`);

    const discoveredPosts: DiscoveredPost[] = [];
    const baseUrl = new URL(blogUrl);
    const domain = baseUrl.origin;

    // Strategy 1: Try sitemap.xml
    try {
      const sitemapUrl = `${domain}/sitemap.xml`;
      console.log(`Trying sitemap: ${sitemapUrl}`);

      const response = await fetch(sitemapUrl);
      if (response.ok) {
        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });

        $('url loc').each((i, el) => {
          const url = $(el).text().trim();
          const blogPattern = blogUrl.replace(/\/$/, '');

          if (url.startsWith(blogPattern) && url !== blogPattern && url !== `${blogPattern}/`) {
            // Extract title from URL (last segment)
            const urlParts = url.split('/').filter(Boolean);
            const slug = urlParts[urlParts.length - 1];
            const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            discoveredPosts.push({
              url,
              title,
            });
          }
        });

        console.log(`Found ${discoveredPosts.length} posts from sitemap`);
      }
    } catch (error) {
      console.log('Sitemap not available or failed');
    }

    // Strategy 2: Scrape blog index page
    if (discoveredPosts.length === 0) {
      try {
        console.log(`Scraping blog index: ${blogUrl}`);

        const response = await fetch(blogUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentCommandStudio/1.0)',
          },
        });

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          // Common blog post link patterns
          const selectors = [
            'article a[href*="/blog/"]',
            '.post a[href*="/blog/"]',
            '.blog-post a[href*="/blog/"]',
            'h2 a, h3 a',
            '.entry-title a',
            '.post-title a',
          ];

          const seenUrls = new Set<string>();

          for (const selector of selectors) {
            $(selector).each((i, el) => {
              let href = $(el).attr('href');
              if (!href) return;

              // Make absolute URL
              if (href.startsWith('/')) {
                href = `${domain}${href}`;
              } else if (!href.startsWith('http')) {
                href = `${blogUrl}/${href}`;
              }

              // Only include blog posts
              const blogPattern = blogUrl.replace(/\/$/, '');
              if (href.startsWith(blogPattern) && href !== blogPattern && !seenUrls.has(href)) {
                seenUrls.add(href);

                const title = $(el).text().trim() ||
                             $(el).attr('title') ||
                             href.split('/').pop()?.replace(/-/g, ' ') ||
                             'Untitled';

                // Try to find excerpt
                const excerpt = $(el).closest('article, .post, .blog-post')
                  .find('p, .excerpt, .summary')
                  .first()
                  .text()
                  .trim()
                  .substring(0, 150);

                discoveredPosts.push({
                  url: href,
                  title,
                  excerpt: excerpt || undefined,
                });
              }
            });

            if (discoveredPosts.length > 0) break;
          }

          console.log(`Found ${discoveredPosts.length} posts from scraping`);
        }
      } catch (error) {
        console.log('Blog index scraping failed');
      }
    }

    // Strategy 3: Try RSS feed
    if (discoveredPosts.length === 0) {
      try {
        const feedUrls = [`${blogUrl}/feed`, `${blogUrl}/rss`, `${domain}/feed`, `${domain}/rss`];

        for (const feedUrl of feedUrls) {
          console.log(`Trying RSS feed: ${feedUrl}`);

          const response = await fetch(feedUrl);
          if (response.ok) {
            const xml = await response.text();
            const $ = cheerio.load(xml, { xmlMode: true });

            $('item').each((i, el) => {
              const title = $(el).find('title').text().trim();
              const link = $(el).find('link').text().trim();
              const description = $(el).find('description').text().trim();
              const pubDate = $(el).find('pubDate').text().trim();

              if (link && title) {
                discoveredPosts.push({
                  url: link,
                  title,
                  excerpt: description?.substring(0, 150),
                  publishedDate: pubDate,
                });
              }
            });

            if (discoveredPosts.length > 0) {
              console.log(`Found ${discoveredPosts.length} posts from RSS feed`);
              break;
            }
          }
        }
      } catch (error) {
        console.log('RSS feed not available or failed');
      }
    }

    if (discoveredPosts.length === 0) {
      return NextResponse.json(
        { error: 'Could not discover any blog posts. Try entering individual post URLs.' },
        { status: 404 }
      );
    }

    // Sort by published date if available, otherwise keep order
    const sortedPosts = discoveredPosts.sort((a, b) => {
      if (a.publishedDate && b.publishedDate) {
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      }
      return 0;
    });

    // Limit results
    const limitedPosts = sortedPosts.slice(0, limit);

    console.log(`Returning ${limitedPosts.length} discovered posts`);

    return NextResponse.json({
      success: true,
      posts: limitedPosts,
      total: limitedPosts.length,
    });
  } catch (error: any) {
    console.error('Discovery error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to discover blog posts' },
      { status: 500 }
    );
  }
}
