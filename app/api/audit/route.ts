import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { performFactCheck } from '@/lib/fact-check';
import { calculateAISOScore } from '@/lib/content-scoring';
import * as cheerio from 'cheerio';

/**
 * POST /api/audit
 * Audit existing blog post content for quality
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
    let { content, url, title, metaDescription } = body;

    // Normalize URL if provided
    if (url) {
      url = url.trim();

      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Add www. if it's just a domain name without subdomain
      // e.g., "facebook.com" -> "https://www.facebook.com"
      // but "blog.facebook.com" stays as-is
      try {
        const urlObj = new URL(url);
        const parts = urlObj.hostname.split('.');

        // If it's just domain.tld (2 parts), add www.
        if (parts.length === 2) {
          urlObj.hostname = 'www.' + urlObj.hostname;
          url = urlObj.toString();
        }
      } catch (e) {
        // If URL parsing fails, we'll let the fetch fail naturally below
      }
    }

    // If URL provided, scrape the content
    if (url && !content) {
      console.log(`Scraping content from URL: ${url}`);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentCommandStudio/1.0)',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

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
          '.kv-ee-post-content',
          '.kv-ee-content-inner',
          '.kv-ee-blog-container',
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
          throw new Error('Could not automatically extract content from this page. This site may use JavaScript to load content. Try copying the article text and pasting it into the "Content" field instead of using the URL.');
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

        content = $content.text().trim();

        if (!content || content.length < 100) {
          throw new Error('Could not extract meaningful content from URL');
        }

        console.log(`Scraped ${content.length} characters from URL`);
      } catch (error: any) {
        return NextResponse.json(
          { error: `Failed to scrape URL: ${error.message}` },
          { status: 400 }
        );
      }
    }

    if (!content || content.trim().length < 100) {
      return NextResponse.json(
        { error: 'Please provide content (min 100 characters) or a valid URL' },
        { status: 400 }
      );
    }

    console.log(`Auditing content (${content.length} characters)`);

    // Extract title and meta description from URL if not provided and URL exists
    if (url) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentCommandStudio/1.0)',
          },
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        // Only extract from HTML if not already provided
        if (!title) {
          title = $('title').text() || $('h1').first().text();
        }
        if (!metaDescription) {
          metaDescription = $('meta[name="description"]').attr('content');
        }
      } catch (error) {
        console.log('Could not extract title/meta from URL');
      }
    }

    // Use empty string if still not provided (for manual content audits without title/meta)
    title = title || '';
    metaDescription = metaDescription || '';

    // Perform comprehensive scoring
    console.log('Running comprehensive AISO analysis...');

    // Fact-checking (KEY DIFFERENTIATOR - 30% weight!)
    const factCheckResult = await performFactCheck(content);

    // AISO scoring (AEO, GEO, SEO, Readability, Engagement + Fact-check)
    // Note: No local context here since audit doesn't have strategy context
    const aisoScores = calculateAISOScore(
      content,
      title,
      metaDescription,
      factCheckResult.overallScore // Fact-check gets 30% weight in national content
    );

    // Log usage
    const estimatedCost = 0.03; // $0.03 per audit
    await db.logUsage({
      user_id: user.id,
      operation_type: 'content_audit',
      cost_usd: estimatedCost,
      tokens_used: 1000,
      metadata: {
        content_length: content.length,
        fact_check_score: factCheckResult.overallScore,
        aeo_score: aisoScores.aeoScore,
        aiso_score: aisoScores.aisoScore,
        url: url || null,
      },
    });

    return NextResponse.json({
      success: true,
      content,
      url: url || undefined,
      title,
      metaDescription,

      // AISO Stack Scores (NEW)
      aisoScore: aisoScores.aisoScore, // Overall AISO score with fact-checking (30% weight)
      aeoScore: aisoScores.aeoScore, // Answer Engine Optimization

      // Legacy scores (kept for backward compatibility)
      overallScore: aisoScores.overallScore, // Base score without fact-check
      factCheckScore: factCheckResult.overallScore,
      seoScore: aisoScores.seoScore,
      readabilityScore: aisoScores.readabilityScore,
      engagementScore: aisoScores.engagementScore,

      // Fact-check details
      verifiedClaims: factCheckResult.verifiedClaims,
      uncertainClaims: factCheckResult.uncertainClaims,
      unverifiedClaims: factCheckResult.unverifiedClaims,
      totalClaims: factCheckResult.totalClaims,
      factChecks: factCheckResult.factChecks,

      // Score details
      seoDetails: aisoScores.seoDetails,
      readabilityDetails: aisoScores.readabilityDetails,
      engagementDetails: aisoScores.engagementDetails,
      aeoDetails: aisoScores.aeoDetails, // NEW - AEO breakdown
    });
  } catch (error: any) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to audit content' },
      { status: 500 }
    );
  }
}
