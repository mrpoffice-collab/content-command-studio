import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { performFactCheck } from '@/lib/fact-check';
import { calculateAEOScore, calculateGEOScore, scoreContent } from '@/lib/content-scoring';
import * as cheerio from 'cheerio';

/**
 * Auto-detect if content is local business focused
 * Used for batch audits to automatically apply GEO scoring
 */
function detectLocalIntent(content: string, url: string, title: string): boolean {
  // Check URL for location signals
  const urlHasLocation = /\/(city|location|local|near-me|-tx-|-ca-|-ny-|-fl-|-az-|-il-|-pa-|-oh-)/i.test(url);

  // Check title for location (City, State pattern)
  const titleHasLocation = /\b(?:in|near)\s+[A-Z][a-z]+(?:,?\s+(?:TX|CA|NY|FL|AZ|IL|PA|OH|MI|NC|GA|WA|MA|VA|CO|OR|NV|TN|IN|MO|WI|AL|SC|LA|KY|OK|CT|UT|IA|NE|KS|NM|WV|ID|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|HI|DC))\b/i.test(title);

  // Check content for strong local signals
  const localSignals = [
    /\b(?:serving|located in|near me|local|in your area|close to you)\b/gi,
    /\b(?:schedule|book|appointment|call now|visit us|get directions)\b/gi,
    /\b[A-Z][a-z]+(?:,?\s+(?:TX|CA|NY|FL|AZ|IL|PA|OH|MI|NC|GA|WA|MA|VA|CO|OR|NV|TN|IN|MO|WI|AL|SC|LA|KY|OK|CT|UT|IA|NE|KS|NM|WV|ID|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|HI|DC))\b/g, // City, State
    /\b(?:neighborhood|downtown|district|suburb|community)\b/gi,
    /\b(?:best|top|trusted|licensed|certified)\s+(?:\w+\s+)?(?:in|near)\s+[A-Z][a-z]+/gi, // "best plumber in Austin"
  ];

  let signalCount = 0;
  localSignals.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches && matches.length >= 1) signalCount++;
  });

  // Return true if we have strong signals
  // URL or title location = definite local
  // 3+ content signals = likely local
  return urlHasLocation || titleHasLocation || signalCount >= 3;
}

/**
 * POST /api/audit/batch
 * Audit multiple blog posts from URLs
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await db.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      );
    }

    console.log(`Batch auditing ${urls.length} blog posts...`);

    const results = [];
    let totalCost = 0;

    for (const url of urls) {
      try {
        console.log(`Auditing: ${url}`);

        // Scrape content from URL
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentCommandStudio/1.0)',
          },
        });

        if (!response.ok) {
          results.push({
            url,
            error: `Failed to fetch: ${response.status}`,
            overallScore: 0,
          });
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract title and meta
        const title = $('title').text() || $('h1').first().text();
        const metaDescription = $('meta[name="description"]').attr('content');

        // Extract publish date
        let publishedDate: string | undefined;
        let daysOld: number | undefined;

        const dateSelectors = [
          'meta[property="article:published_time"]',
          'meta[name="article:published_time"]',
          'meta[property="datePublished"]',
          'meta[name="datePublished"]',
          'time[datetime]',
          '.published-date',
          '.post-date',
          '.entry-date',
        ];

        for (const selector of dateSelectors) {
          const dateStr = $(selector).attr('content') || $(selector).attr('datetime') || $(selector).text();
          if (dateStr) {
            try {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                publishedDate = date.toISOString().split('T')[0];
                daysOld = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
                break;
              }
            } catch (e) {
              // Invalid date, continue
            }
          }
        }

        // Remove scripts, styles, nav, footer
        $('script, style, nav, footer, header, .sidebar, aside, #sidebar, #comments, .comments, .comment-form').remove();

        // Try to find main content area (get HTML, not just text)
        // Try multiple selectors in order of specificity
        let contentElement = null;
        const selectors = [
          'article',
          '.post-content',
          '.entry-content',
          '.content-area',
          '.blog-post',
          '.post',
          'main',
          '#content',
          '.site-content',
          '[role="main"]',
          '.blog',
          '#main',
          '.main-content',
        ];

        for (const selector of selectors) {
          const elem = $(selector).first();
          if (elem && elem.length > 0) {
            const text = elem.text().trim();
            if (text.length >= 100) {  // Must have substantial content
              contentElement = elem;
              console.log(`Found content with selector: ${selector}`);
              break;
            }
          }
        }

        if (!contentElement || contentElement.length === 0) {
          // Last resort: try body but this will include everything
          const bodyText = $('body').text().trim();
          if (bodyText.length < 100) {
            results.push({
              url,
              title,
              error: 'Could not find article content - this may be a blog index page, not an individual post',
              overallScore: 0,
              success: false,
            });
            continue;
          }
          contentElement = $('body');
          console.log('Using body as fallback');
        }

        // Convert HTML to Markdown-like format to preserve structure
        const htmlContent = contentElement.html() || '';
        const $content = cheerio.load(htmlContent);

        // Convert headers
        $content('h1').each((i, el) => {
          $content(el).replaceWith(`\n# ${$content(el).text()}\n`);
        });
        $content('h2').each((i, el) => {
          $content(el).replaceWith(`\n## ${$content(el).text()}\n`);
        });
        $content('h3').each((i, el) => {
          $content(el).replaceWith(`\n### ${$content(el).text()}\n`);
        });

        // Convert images
        $content('img').each((i, el) => {
          const alt = $content(el).attr('alt') || 'image';
          const src = $content(el).attr('src') || '';
          $content(el).replaceWith(`![${alt}](${src})`);
        });

        // Convert links
        $content('a').each((i, el) => {
          const text = $content(el).text();
          const href = $content(el).attr('href') || '';
          if (text && href) {
            $content(el).replaceWith(`[${text}](${href})`);
          }
        });

        // Convert bold/italic
        $content('strong, b').each((i, el) => {
          $content(el).replaceWith(`**${$content(el).text()}**`);
        });
        $content('em, i').each((i, el) => {
          $content(el).replaceWith(`*${$content(el).text()}*`);
        });

        // Convert lists
        $content('ul li').each((i, el) => {
          $content(el).replaceWith(`\n- ${$content(el).text()}`);
        });
        $content('ol li').each((i, el) => {
          $content(el).replaceWith(`\n${i + 1}. ${$content(el).text()}`);
        });

        const content = $content.text().trim();

        if (!content || content.length < 100) {
          results.push({
            url,
            title,
            error: 'Content too short',
            overallScore: 0,
          });
          continue;
        }

        // Auto-detect if this is local business content
        const isLocalContent = detectLocalIntent(content, url, title);

        // Perform quick AISO scoring (skip fact-checking for batch to save cost/time)
        const contentScores = scoreContent(content, title, metaDescription);
        const aeoScores = calculateAEOScore(content);
        const geoScores = isLocalContent ? calculateGEOScore(content) : undefined;

        // AISO score without fact-checking for batch audits
        // If local: AEO 30%, GEO 10%, SEO 25%, Readability 20%, Engagement 15%
        // If national: AEO 35%, SEO 30%, Readability 20%, Engagement 15%
        const aisoScore = isLocalContent && geoScores
          ? Math.round(
              aeoScores.score * 0.30 +
              geoScores.score * 0.10 +
              contentScores.seoScore * 0.25 +
              contentScores.readabilityScore * 0.20 +
              contentScores.engagementScore * 0.15
            )
          : Math.round(
              aeoScores.score * 0.35 +
              contentScores.seoScore * 0.30 +
              contentScores.readabilityScore * 0.20 +
              contentScores.engagementScore * 0.15
            );

        // Keep legacy overallScore for backward compatibility
        const overallScore = Math.round(
          contentScores.seoScore * 0.35 +
          contentScores.readabilityScore * 0.30 +
          contentScores.engagementScore * 0.35
        );

        // Identify objective issues
        const issues = [];
        if (contentScores.seoDetails.wordCount < 800) {
          issues.push('Short content');
        }
        if (contentScores.seoDetails.imageCount === 0) {
          issues.push('No images');
        }
        if (!contentScores.seoDetails.headerStructure) {
          issues.push('Poor structure');
        }
        if (!contentScores.seoDetails.hasInternalLinks) {
          issues.push('No links');
        }
        if (contentScores.readabilityDetails.fleschScore < 50) {
          issues.push('Hard to read');
        }

        results.push({
          url,
          title,
          aisoScore, // NEW - AISO score (includes AEO + optional GEO)
          aeoScore: aeoScores.score, // NEW - Answer Engine Optimization
          geoScore: geoScores?.score, // NEW - Local Intent Optimization (if detected)
          isLocalContent, // NEW - Was this detected as local business content?
          overallScore, // Legacy score for backward compatibility
          seoScore: contentScores.seoScore,
          readabilityScore: contentScores.readabilityScore,
          engagementScore: contentScores.engagementScore,
          wordCount: contentScores.seoDetails.wordCount,
          publishedDate,
          daysOld,
          issues,
          imageCount: contentScores.seoDetails.imageCount,
          headerCount: contentScores.seoDetails.h2Count + contentScores.seoDetails.h3Count,
          hasFAQ: aeoScores.details.hasFAQSection, // NEW - AEO metric
          hasDirectAnswer: aeoScores.details.hasDirectAnswer, // NEW - AEO metric
          hasGBPOptimization: geoScores?.details.hasGBPOptimization, // NEW - GBP optimization detected
          hasBookingCTA: geoScores?.details.hasBookingCTA, // NEW - Booking CTA detected
          fleschScore: contentScores.readabilityDetails.fleschScore,
          success: true,
        });

        // Cost: $0.01 per post for batch audit (no fact-checking)
        totalCost += 0.01;

      } catch (error: any) {
        console.error(`Error auditing ${url}:`, error.message, error.stack);
        results.push({
          url,
          title: title || url,
          error: error.message || 'Unknown error',
          overallScore: 0,
          success: false,
        });
      }
    }

    // Log usage
    await db.logUsage({
      user_id: user.id,
      operation_type: 'content_audit',
      cost_usd: totalCost,
      tokens_used: urls.length * 500,
      metadata: {
        batch: true,
        post_count: urls.length,
        successful: results.filter(r => r.success).length,
      },
    });

    // Calculate summary statistics
    const successfulResults = results.filter(r => r.success);

    // Calculate average AISO score (NEW)
    const avgAisoScore = successfulResults.length > 0
      ? Math.round(successfulResults.reduce((sum, r) => sum + (r.aisoScore || 0), 0) / successfulResults.length)
      : 0;

    // Calculate average AEO score (NEW)
    const avgAeoScore = successfulResults.length > 0
      ? Math.round(successfulResults.reduce((sum, r) => sum + (r.aeoScore || 0), 0) / successfulResults.length)
      : 0;

    // Legacy average score (for backward compatibility)
    const avgScore = successfulResults.length > 0
      ? Math.round(successfulResults.reduce((sum, r) => sum + r.overallScore, 0) / successfulResults.length)
      : 0;

    // AISO score distribution (NEW)
    const aisoDistribution = {
      excellent: successfulResults.filter(r => (r.aisoScore || 0) >= 85).length,
      good: successfulResults.filter(r => (r.aisoScore || 0) >= 75 && (r.aisoScore || 0) < 85).length,
      needsImprovement: successfulResults.filter(r => (r.aisoScore || 0) < 75).length,
    };

    // Legacy score distribution (for backward compatibility)
    const scoreDistribution = {
      excellent: successfulResults.filter(r => r.overallScore >= 85).length,
      good: successfulResults.filter(r => r.overallScore >= 75 && r.overallScore < 85).length,
      needsImprovement: successfulResults.filter(r => r.overallScore < 75).length,
    };

    // AEO metrics (NEW)
    const aeoMetrics = {
      withFAQ: successfulResults.filter(r => r.hasFAQ).length,
      withDirectAnswer: successfulResults.filter(r => r.hasDirectAnswer).length,
      avgAeoScore,
    };

    // GEO metrics (NEW)
    const localResults = successfulResults.filter(r => r.isLocalContent);
    const avgGeoScore = localResults.length > 0
      ? Math.round(localResults.reduce((sum, r) => sum + (r.geoScore || 0), 0) / localResults.length)
      : undefined;

    const geoMetrics = {
      localContentCount: localResults.length,
      nationalContentCount: successfulResults.length - localResults.length,
      avgGeoScore,
      withGBPOptimization: localResults.filter(r => r.hasGBPOptimization).length,
      withBookingCTA: localResults.filter(r => r.hasBookingCTA).length,
    };

    console.log(`Batch AISO audit complete: ${successfulResults.length}/${urls.length} successful`);
    console.log(`Average AISO Score: ${avgAisoScore}, Average AEO Score: ${avgAeoScore}`);
    console.log(`Local content detected: ${localResults.length}/${successfulResults.length}`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: urls.length,
        successful: successfulResults.length,
        failed: urls.length - successfulResults.length,
        avgAisoScore, // NEW - Primary score
        avgAeoScore, // NEW - AEO average
        avgScore, // Legacy score for backward compatibility
        aisoDistribution, // NEW - AISO distribution
        scoreDistribution, // Legacy distribution
        aeoMetrics, // NEW - AEO-specific metrics
        geoMetrics, // NEW - GEO-specific metrics (auto-detected local content)
        totalCost,
      },
    });
  } catch (error: any) {
    console.error('Batch audit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to batch audit' },
      { status: 500 }
    );
  }
}
