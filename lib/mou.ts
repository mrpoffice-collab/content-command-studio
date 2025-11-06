import { anthropic } from './claude';

export interface MOUData {
  clientName: string;
  industry: string;
  targetAudience: string;
  brandVoice: string;
  frequency: string;
  contentLength: string;
  selectedTopics: Array<{
    title: string;
    keyword: string;
    wordCount: number;
  }>;
  totalWordCount: number;
  pricePerWord: number;
  totalPrice: number;
  deliveryTimeframe: string;
}

export async function generateMOU(data: MOUData): Promise<string> {
  const prompt = `You are a professional proposal writer for a content marketing agency. Generate a professional, legally-sound Memorandum of Understanding (MOU) document based on the following details:

CLIENT INFORMATION:
- Client Name: ${data.clientName}
- Industry: ${data.industry}
- Target Audience: ${data.targetAudience}
- Brand Voice: ${data.brandVoice}

SCOPE OF WORK:
- Number of Blog Posts: ${data.selectedTopics.length}
- Publishing Frequency: ${data.frequency}
- Content Length: ${data.contentLength}
- Total Word Count: ${data.totalWordCount.toLocaleString()} words

TOPICS TO BE COVERED:
${data.selectedTopics.map((topic, idx) => `${idx + 1}. "${topic.title}" (~${topic.wordCount} words, targeting keyword: "${topic.keyword}")`).join('\n')}

PRICING:
- Rate: $${data.pricePerWord.toFixed(3)} per word
- Total Project Cost: $${data.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Payment Terms: 50% upfront, 50% upon completion
- Delivery Timeframe: ${data.deliveryTimeframe}

Generate a professional 1-page MOU that includes:

1. HEADER with "MEMORANDUM OF UNDERSTANDING" and date
2. PARTIES section identifying the agency and client
3. PURPOSE section describing the content marketing services
4. SCOPE OF WORK section with:
   - Detailed deliverables (${data.selectedTopics.length} blog posts)
   - Content specifications (word counts, SEO optimization, brand voice)
   - Timeline and delivery schedule
5. COMPENSATION section with:
   - Total project cost
   - Payment schedule (50% upfront, 50% on completion)
   - Payment terms (net 15 days)
6. RESPONSIBILITIES section outlining:
   - Agency responsibilities (research, writing, SEO optimization, revisions)
   - Client responsibilities (timely feedback, brand assets, approvals)
7. REVISIONS section (up to 2 rounds of revisions per post)
8. INTELLECTUAL PROPERTY section (all content becomes client property upon full payment)
9. TERMINATION clause
10. SIGNATURE BLOCKS for both parties with date lines

Format the MOU professionally with clear sections and appropriate legal language. Keep it concise but comprehensive. Use formal business tone.

Return the MOU as clean, formatted text that can be easily converted to PDF.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return content.text;
}

export function calculatePricing(
  selectedTopics: Array<{ wordCount: number }>,
  pricePerWord: number = 0.10 // Default $0.10 per word
): {
  totalWordCount: number;
  totalPrice: number;
  pricePerWord: number;
} {
  const totalWordCount = selectedTopics.reduce(
    (sum, topic) => sum + (topic.wordCount || 0),
    0
  );
  const totalPrice = totalWordCount * pricePerWord;

  return {
    totalWordCount,
    totalPrice,
    pricePerWord,
  };
}

export function getDeliveryTimeframe(topicCount: number, frequency: string): string {
  const weeklyMap: { [key: string]: number } = {
    daily: 7,
    '2x-week': 3.5,
    weekly: 1,
    'bi-weekly': 0.5,
    monthly: 0.25,
  };

  const postsPerWeek = weeklyMap[frequency] || 1;
  const weeksNeeded = Math.ceil(topicCount / postsPerWeek);

  if (weeksNeeded <= 4) {
    return `${weeksNeeded} weeks`;
  } else if (weeksNeeded <= 12) {
    const months = Math.ceil(weeksNeeded / 4);
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    const months = Math.ceil(weeksNeeded / 4);
    return `${months} months`;
  }
}
