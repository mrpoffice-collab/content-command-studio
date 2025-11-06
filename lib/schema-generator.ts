/**
 * Schema Markup Generator for AISO Stack
 * Generates JSON-LD structured data for Article, FAQ, HowTo, and LocalBusiness
 */

export interface ArticleSchema {
  '@context': 'https://schema.org';
  '@type': 'Article';
  headline: string;
  description?: string;
  author?: {
    '@type': 'Person' | 'Organization';
    name: string;
  };
  datePublished?: string;
  dateModified?: string;
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
    };
  };
}

export interface FAQSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

export interface HowToSchema {
  '@context': 'https://schema.org';
  '@type': 'HowTo';
  name: string;
  description?: string;
  step: Array<{
    '@type': 'HowToStep';
    name: string;
    text: string;
  }>;
}

export interface LocalBusinessSchema {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  name: string;
  description?: string;
  address?: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude?: string;
    longitude?: string;
  };
  telephone?: string;
  priceRange?: string;
}

/**
 * Extract FAQ pairs from markdown content
 */
export function extractFAQs(content: string): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];

  // Match FAQ section
  const faqSectionMatch = content.match(/##\s*(?:Frequently Asked Questions|FAQ|FAQs|Common Questions)([\s\S]*?)(?=##|$)/i);
  if (!faqSectionMatch) return faqs;

  const faqSection = faqSectionMatch[1];

  // Match individual Q&A pairs
  // Format: ### Question? \n\n Answer paragraph
  const qaPairs = faqSection.split(/###\s*/);

  for (const pair of qaPairs) {
    if (!pair.trim()) continue;

    // Split on first paragraph break
    const parts = pair.split(/\n\n+/);
    if (parts.length < 2) continue;

    const question = parts[0].trim();
    const answer = parts.slice(1).join('\n\n').trim();

    if (question && answer && question.includes('?')) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}

/**
 * Extract how-to steps from markdown content
 */
export function extractHowToSteps(content: string): Array<{ name: string; text: string }> {
  const steps: Array<{ name: string; text: string }> = [];

  // Look for numbered lists (1. , 2. , etc.)
  const numberedSteps = content.match(/^\d+\.\s+(.+?)(?=\n\d+\.|\n\n|$)/gm);

  if (numberedSteps && numberedSteps.length >= 3) {
    numberedSteps.forEach(step => {
      const cleanStep = step.replace(/^\d+\.\s+/, '').trim();
      const [name, ...rest] = cleanStep.split('\n');
      steps.push({
        name: name.trim(),
        text: rest.join('\n').trim() || name.trim(),
      });
    });
  }

  // Alternative: Look for "Step 1", "Step 2" pattern
  if (steps.length === 0) {
    const stepPattern = /###+\s*Step\s+\d+[:\s]+(.+?)\n\n([\s\S]*?)(?=###+\s*Step|\n##[^#]|$)/gi;
    let match;

    while ((match = stepPattern.exec(content)) !== null) {
      steps.push({
        name: match[1].trim(),
        text: match[2].trim(),
      });
    }
  }

  return steps;
}

/**
 * Generate Article schema from blog post
 */
export function generateArticleSchema(
  title: string,
  description?: string,
  author?: string,
  organizationName?: string,
  organizationLogo?: string,
  publishedDate?: string,
  modifiedDate?: string
): ArticleSchema {
  const schema: ArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
  };

  if (description) schema.description = description;

  if (author) {
    schema.author = {
      '@type': 'Person',
      name: author,
    };
  }

  if (organizationName) {
    schema.publisher = {
      '@type': 'Organization',
      name: organizationName,
    };

    if (organizationLogo) {
      schema.publisher.logo = {
        '@type': 'ImageObject',
        url: organizationLogo,
      };
    }
  }

  if (publishedDate) schema.datePublished = publishedDate;
  if (modifiedDate) schema.dateModified = modifiedDate;

  return schema;
}

/**
 * Generate FAQ schema from Q&A pairs
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): FAQSchema | null {
  if (faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate HowTo schema from steps
 */
export function generateHowToSchema(
  title: string,
  steps: Array<{ name: string; text: string }>,
  description?: string
): HowToSchema | null {
  if (steps.length < 2) return null;

  const schema: HowToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    step: steps.map(step => ({
      '@type': 'HowToStep',
      name: step.name,
      text: step.text,
    })),
  };

  if (description) schema.description = description;

  return schema;
}

/**
 * Generate LocalBusiness schema
 */
export function generateLocalBusinessSchema(
  businessName: string,
  options?: {
    description?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    priceRange?: string;
  }
): LocalBusinessSchema {
  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessName,
  };

  if (options?.description) schema.description = options.description;

  if (options?.city || options?.state || options?.postalCode) {
    schema.address = {
      '@type': 'PostalAddress',
    };

    if (options.city) schema.address.addressLocality = options.city;
    if (options.state) schema.address.addressRegion = options.state;
    if (options.postalCode) schema.address.postalCode = options.postalCode;
    if (options.country) schema.address.addressCountry = options.country;
  }

  if (options?.phone) schema.telephone = options.phone;
  if (options?.priceRange) schema.priceRange = options.priceRange;

  return schema;
}

/**
 * Auto-generate all applicable schemas from blog post content
 */
export function generateAllSchemas(
  content: string,
  title: string,
  metaDescription?: string,
  author?: string,
  organizationName?: string,
  localContext?: { city?: string; state?: string; businessName?: string }
): {
  article: ArticleSchema;
  faq?: FAQSchema;
  howTo?: HowToSchema;
  localBusiness?: LocalBusinessSchema;
} {
  const result: {
    article: ArticleSchema;
    faq?: FAQSchema;
    howTo?: HowToSchema;
    localBusiness?: LocalBusinessSchema;
  } = {
    article: generateArticleSchema(
      title,
      metaDescription,
      author,
      organizationName || localContext?.businessName
    ),
  };

  // Extract and generate FAQ schema
  const faqs = extractFAQs(content);
  if (faqs.length > 0) {
    result.faq = generateFAQSchema(faqs);
  }

  // Extract and generate HowTo schema
  const steps = extractHowToSteps(content);
  if (steps.length >= 2) {
    result.howTo = generateHowToSchema(title, steps, metaDescription);
  }

  // Generate LocalBusiness schema if local context provided
  if (localContext?.businessName) {
    result.localBusiness = generateLocalBusinessSchema(
      localContext.businessName,
      {
        description: metaDescription,
        city: localContext.city,
        state: localContext.state,
      }
    );
  }

  return result;
}

/**
 * Convert schema objects to JSON-LD script tags for HTML
 */
export function schemaToScriptTag(schema: ArticleSchema | FAQSchema | HowToSchema | LocalBusinessSchema): string {
  return `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;
}

/**
 * Generate all schema script tags from content
 */
export function generateSchemaScriptTags(
  content: string,
  title: string,
  metaDescription?: string,
  author?: string,
  organizationName?: string,
  localContext?: { city?: string; state?: string; businessName?: string }
): string {
  const schemas = generateAllSchemas(
    content,
    title,
    metaDescription,
    author,
    organizationName,
    localContext
  );

  const scriptTags: string[] = [];

  scriptTags.push(schemaToScriptTag(schemas.article));

  if (schemas.faq) {
    scriptTags.push(schemaToScriptTag(schemas.faq));
  }

  if (schemas.howTo) {
    scriptTags.push(schemaToScriptTag(schemas.howTo));
  }

  if (schemas.localBusiness) {
    scriptTags.push(schemaToScriptTag(schemas.localBusiness));
  }

  return scriptTags.join('\n\n');
}
