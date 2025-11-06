import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generateOpportunityReportPDF } from '@/lib/opportunity-pdf-generator';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/leads/opportunity-report
 * Generate a sales-ready opportunity report PDF for a lead
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
    const {
      domain,
      businessName,
      city,
      state,
      overallScore,
      technicalSEO,
      onPageSEO,
      contentMarketing,
      localSEO,
      seoIssues = [],
      hasBlog,
      blogPostCount,
      industry
    } = body;

    if (!domain || !businessName) {
      return NextResponse.json(
        { error: 'Domain and business name are required' },
        { status: 400 }
      );
    }

    console.log(`Generating opportunity report for ${domain}...`);

    // Analyze gaps and opportunities based on SEO fundamentals
    const gaps = [];
    const strengths = [];
    const opportunities = [];

    // Identify strengths (scores > 75)
    if (technicalSEO >= 75) strengths.push({ area: 'Technical SEO', score: technicalSEO, description: 'Strong technical foundation with proper meta tags and schema' });
    if (onPageSEO >= 75) strengths.push({ area: 'On-Page SEO', score: onPageSEO, description: 'Well-structured content with good header hierarchy' });
    if (contentMarketing >= 75) strengths.push({ area: 'Content Marketing', score: contentMarketing, description: 'Active blog with quality content' });
    if (localSEO >= 75) strengths.push({ area: 'Local SEO', score: localSEO, description: 'Strong local presence with NAP consistency' });

    // Identify gaps (scores < 75) and pull from seoIssues for specific details
    if (technicalSEO < 75) {
      const technicalIssues = seoIssues.filter((issue: any) => issue.category === 'Technical SEO');
      gaps.push({
        area: 'Technical SEO',
        score: technicalSEO,
        severity: technicalSEO < 50 ? 'Critical' : technicalSEO < 65 ? 'High' : 'Medium',
        description: technicalIssues.length > 0
          ? `${technicalIssues.length} technical issues found (${technicalIssues.slice(0, 2).map((i: any) => i.issue).join(', ')})`
          : 'Technical SEO needs improvement'
      });
    }
    if (onPageSEO < 75) {
      const onPageIssues = seoIssues.filter((issue: any) => issue.category === 'On-Page SEO');
      gaps.push({
        area: 'On-Page SEO',
        score: onPageSEO,
        severity: onPageSEO < 50 ? 'Critical' : onPageSEO < 65 ? 'High' : 'Medium',
        description: onPageIssues.length > 0
          ? `${onPageIssues.length} on-page issues found (${onPageIssues.slice(0, 2).map((i: any) => i.issue).join(', ')})`
          : 'On-page optimization needed'
      });
    }
    if (contentMarketing < 75) {
      gaps.push({
        area: 'Content Marketing',
        score: contentMarketing,
        severity: contentMarketing < 50 ? 'Critical' : contentMarketing < 65 ? 'High' : 'Medium',
        description: hasBlog
          ? `Blog needs optimization (${blogPostCount || 0} posts found)`
          : 'No blog or content marketing strategy detected'
      });
    }
    if (localSEO < 75) {
      const localIssues = seoIssues.filter((issue: any) => issue.category === 'Local SEO');
      gaps.push({
        area: 'Local SEO',
        score: localSEO,
        severity: localSEO < 50 ? 'Critical' : localSEO < 65 ? 'High' : 'Medium',
        description: localIssues.length > 0
          ? `${localIssues.length} local SEO issues (${localIssues.slice(0, 2).map((i: any) => i.issue).join(', ')})`
          : 'Local SEO needs improvement'
      });
    }

    // Generate specific recommended actions based on SEO gaps
    // Focus on WHAT needs to be done, not pricing/timeline
    if (!hasBlog || contentMarketing < 75) {
      opportunities.push({
        title: 'Content Marketing Strategy',
        description: hasBlog
          ? 'Optimize and expand your existing blog to capture more organic traffic and establish thought leadership'
          : 'Launch a blog to capture organic search traffic, establish authority, and generate qualified leads',
        impact: 'High',
        estimatedValue: '', // Removed pricing
        timeline: '', // Removed timeline
        investment: '', // Removed investment
        actions: hasBlog
          ? [
              'Audit existing blog posts for SEO performance',
              'Rewrite underperforming content with target keywords',
              'Develop editorial calendar targeting high-value keywords',
              'Optimize posts for conversions with clear CTAs',
              'Build internal linking between related posts',
              'Monitor traffic and lead generation metrics'
            ]
          : [
              'Develop comprehensive content strategy',
              'Research and target high-value local keywords',
              'Create SEO-optimized blog structure',
              'Publish regular content targeting buyer intent',
              'Build thought leadership and authority',
              'Track organic traffic growth and conversions'
            ]
      });
    }

    if (technicalSEO < 75) {
      opportunities.push({
        title: 'Technical SEO Foundation',
        description: 'Fix critical technical issues preventing search engines from properly crawling, indexing, and ranking your website',
        impact: technicalSEO < 50 ? 'Critical' : 'High',
        estimatedValue: '',
        timeline: '',
        investment: '',
        actions: [
          'Audit and optimize title tags (50-60 characters with keywords)',
          'Write compelling meta descriptions (150-160 characters)',
          'Implement structured data markup (schema.org)',
          'Ensure mobile-responsive design across all devices',
          'Add descriptive alt text to all images',
          'Verify site speed and Core Web Vitals',
          'Fix broken links and 404 errors'
        ]
      });
    }

    if (onPageSEO < 75) {
      opportunities.push({
        title: 'On-Page SEO Optimization',
        description: 'Improve content structure and keyword optimization to help search engines understand and rank your pages',
        impact: onPageSEO < 50 ? 'High' : 'Medium',
        estimatedValue: '',
        timeline: '',
        investment: '',
        actions: [
          'Add H1 tags to all pages with primary keywords',
          'Create logical header hierarchy (H1 > H2 > H3)',
          'Develop internal linking strategy between related pages',
          'Optimize keyword placement and density (1-2%)',
          'Improve content depth and comprehensiveness',
          'Add FAQ sections targeting question keywords',
          'Optimize images with descriptive filenames and captions'
        ]
      });
    }

    if (localSEO < 75) {
      opportunities.push({
        title: 'Local SEO Enhancement',
        description: 'Optimize for local search to capture customers in your service area who are actively searching for your services',
        impact: 'High',
        estimatedValue: '',
        timeline: '',
        investment: '',
        actions: [
          'Ensure NAP (Name, Address, Phone) consistency everywhere',
          'Claim and optimize Google Business Profile',
          'Add location keywords to title tags and headers',
          'Create location-specific service pages',
          'Build local citations on directories (Yelp, BBB, etc.)',
          'Encourage and respond to customer reviews',
          'Add location schema markup to contact pages'
        ]
      });
    }

    // Sort opportunities by impact
    const impactOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    opportunities.sort((a, b) => impactOrder[a.impact as keyof typeof impactOrder] - impactOrder[b.impact as keyof typeof impactOrder]);

    // Generate AI-powered market opportunity summary
    console.log('Generating AI market opportunity summary...');
    const marketSummaryPrompt = `You are an expert digital marketing analyst. Generate a fact-based market opportunity summary for a sales proposal.

**Business Details:**
- Business: ${businessName}
- Industry: ${industry || 'Local service business'}
- Location: ${city}, ${state}
- Domain: ${domain}

**Current SEO Performance:**
- Overall Score: ${overallScore}/100
- Technical SEO: ${technicalSEO}/100 (Meta tags, schema, mobile optimization)
- On-Page SEO: ${onPageSEO}/100 (Headers, internal linking, content structure)
- Content Marketing: ${contentMarketing}/100 (Blog presence and quality)
- Local SEO: ${localSEO}/100 (NAP consistency, location keywords)
- Has Blog: ${hasBlog ? 'Yes' : 'No'}${hasBlog ? ` (${blogPostCount} posts)` : ''}

**Key Issues Found:**
${gaps.slice(0, 3).map(g => `- ${g.area}: ${g.description} (Score: ${g.score}/100)`).join('\n')}

**Task:** Create a 3-paragraph market opportunity summary following this structure:

**Paragraph 1 - Industry Context:**
Provide realistic traffic benchmarks for this industry and location. Use ranges (e.g., "200-800 monthly visitors") not precise numbers. Base estimates on:
- Industry type (service businesses typically get X visitors)
- Location market size
- Current SEO state suggests they likely receive Y visitors now

**Paragraph 2 - Traffic Gap Analysis:**
Compare their estimated current traffic to industry benchmarks. Show the gap between where they are and where they should be. Use conservative estimates.

**Paragraph 3 - Revenue Opportunity:**
Calculate potential revenue impact using:
- Typical conversion rates for this industry (2-5% for service businesses)
- Estimated average transaction value for this industry
- Show current vs. optimized lead generation potential
- Provide monthly revenue range (not annual)

**CRITICAL FACT-CHECKING REQUIREMENTS:**
1. Only use general industry knowledge about traffic and conversion rates
2. Use RANGES not specific numbers (e.g., "200-800" not "500")
3. Include qualifier phrases: "typically," "estimated," "industry average," "based on benchmarks"
4. DO NOT make up specific statistics
5. Acknowledge uncertainty with phrases like "likely receives" or "estimated at"
6. Keep estimates conservative and realistic

**OUTPUT FORMAT:**
Return a JSON object with this structure:
{
  "industryContext": "Paragraph about industry traffic benchmarks...",
  "trafficGap": "Paragraph comparing their current vs potential traffic...",
  "revenueOpportunity": "Paragraph showing revenue impact...",
  "confidenceLevel": "Medium - Based on industry benchmarks and current SEO gaps. Actual results depend on local competition and implementation quality."
}

Write professionally but conversationally. This goes in a sales proposal.`;

    let marketSummary;
    try {
      const summaryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{ role: 'user', content: marketSummaryPrompt }],
      });

      const summaryText = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : '';
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        marketSummary = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if parsing fails
        marketSummary = {
          industryContext: `Businesses in the ${industry || 'service'} industry in ${city}, ${state} typically receive varying levels of organic traffic depending on their SEO optimization.`,
          trafficGap: `Based on the current SEO score of ${overallScore}/100, there is significant room for improvement in organic visibility.`,
          revenueOpportunity: `With proper SEO optimization, increased organic traffic can lead to substantial growth in lead generation and revenue.`,
          confidenceLevel: 'Estimates based on industry benchmarks and current SEO analysis.'
        };
      }
    } catch (error) {
      console.error('Failed to generate market summary:', error);
      // Fallback summary
      marketSummary = {
        industryContext: `Businesses in the ${industry || 'service'} industry typically benefit from strong organic search presence in their local market.`,
        trafficGap: `Current SEO performance indicates opportunities for improvement across technical, content, and local search optimization.`,
        revenueOpportunity: `Implementing recommended SEO improvements can lead to increased organic visibility and qualified lead generation.`,
        confidenceLevel: 'Analysis based on current SEO audit findings.'
      };
    }

    // Generate the PDF
    const pdfBuffer = await generateOpportunityReportPDF({
      businessName,
      domain,
      city,
      state,
      industry,
      overallScore,
      scores: {
        technicalSEO,
        onPageSEO,
        contentMarketing,
        localSEO,
      },
      hasBlog,
      blogPostCount,
      seoIssues,
      marketSummary,
      strengths,
      gaps,
      opportunities,
      generatedBy: user.email || 'Content Command Studio',
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
    });

    // Save lead to pipeline if it doesn't exist
    // Map new SEO-focused scores to legacy database fields
    const lead = await db.createLead({
      user_id: user.id,
      domain,
      business_name: businessName,
      city,
      state,
      industry,
      overall_score: overallScore,
      content_score: contentMarketing, // Content Marketing score
      seo_score: Math.round((technicalSEO + onPageSEO) / 2), // Average of Technical + On-Page
      design_score: technicalSEO, // Use Technical SEO for design (closest proxy)
      speed_score: localSEO, // Use Local SEO for speed (placeholder)
      has_blog: hasBlog,
      blog_post_count: blogPostCount,
      status: 'report_generated',
      opportunity_rating: overallScore >= 45 && overallScore <= 70 ? 'high' : overallScore < 45 ? 'medium' : 'low',
    });

    // Update lead with report timestamp
    await db.updateLead(lead.id, {
      report_generated_at: new Date(),
    });

    // Log activity
    await db.createLeadActivity({
      lead_id: lead.id,
      user_id: user.id,
      activity_type: 'report_generated',
      description: `Sales opportunity report generated with ${opportunities.length} recommendations`,
    });

    // Log usage
    const estimatedCost = 0.02; // $0.02 per report
    await db.logUsage({
      user_id: user.id,
      operation_type: 'lead_discovery',
      cost_usd: estimatedCost,
      tokens_used: 0,
      metadata: {
        operation: 'opportunity_report',
        domain,
        business_name: businessName,
        overall_score: overallScore,
        opportunities_count: opportunities.length,
        lead_id: lead.id,
      },
    });

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Opportunity-Report-${businessName.replace(/[^a-z0-9]/gi, '-')}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('Opportunity report error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate opportunity report' },
      { status: 500 }
    );
  }
}
