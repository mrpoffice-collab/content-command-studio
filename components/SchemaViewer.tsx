'use client';

import { useState } from 'react';
import { ArticleSchema, FAQSchema, HowToSchema, LocalBusinessSchema } from '@/lib/schema-generator';

interface SchemaViewerProps {
  article?: ArticleSchema;
  faq?: FAQSchema;
  howTo?: HowToSchema;
  localBusiness?: LocalBusinessSchema;
}

/**
 * Schema Viewer Component
 *
 * Displays and allows copying of JSON-LD structured data schemas
 * for Article, FAQ, HowTo, and LocalBusiness
 */
export default function SchemaViewer({ article, faq, howTo, localBusiness }: SchemaViewerProps) {
  const [activeTab, setActiveTab] = useState<'article' | 'faq' | 'howto' | 'business'>('article');
  const [copied, setCopied] = useState(false);

  const schemas = {
    article,
    faq,
    howTo,
    localBusiness,
  };

  // Count available schemas
  const schemaCount = Object.values(schemas).filter(Boolean).length;

  if (schemaCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <h3 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Schema Markup
        </h3>
        <p className="text-sm text-slate-600">
          No structured data schemas available for this content.
        </p>
      </div>
    );
  }

  const getCurrentSchema = () => {
    switch (activeTab) {
      case 'article':
        return article;
      case 'faq':
        return faq;
      case 'howto':
        return howTo;
      case 'business':
        return localBusiness;
      default:
        return null;
    }
  };

  const handleCopy = () => {
    const schema = getCurrentSchema();
    if (schema) {
      const jsonString = JSON.stringify(schema, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAll = () => {
    const allSchemas = Object.values(schemas).filter(Boolean);
    if (allSchemas.length > 0) {
      const jsonString = JSON.stringify(allSchemas, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentSchema = getCurrentSchema();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Schema Markup
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              {schemaCount} {schemaCount === 1 ? 'Schema' : 'Schemas'} Available
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          JSON-LD structured data for search engines and AI answer engines
        </p>
      </div>

      {/* Schema Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {article && (
          <button
            onClick={() => setActiveTab('article')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'article'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📄 Article
          </button>
        )}
        {faq && (
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'faq'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ❓ FAQ ({faq.mainEntity.length})
          </button>
        )}
        {howTo && (
          <button
            onClick={() => setActiveTab('howto')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'howto'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📋 HowTo ({howTo.step.length} steps)
          </button>
        )}
        {localBusiness && (
          <button
            onClick={() => setActiveTab('business')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'business'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🏢 Local Business
          </button>
        )}
      </div>

      {/* Schema Content */}
      {currentSchema && (
        <>
          {/* Info Box */}
          <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 mb-1">How to use this schema:</p>
                <ol className="text-sm text-slate-700 space-y-1 ml-4 list-decimal">
                  <li>Copy the JSON-LD code below</li>
                  <li>Add it to your HTML page within {'<script type="application/ld+json">...</script>'}</li>
                  <li>Test with Google's Rich Results Test or Schema.org Validator</li>
                </ol>
              </div>
            </div>
          </div>

          {/* JSON Display */}
          <div className="relative">
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
              {JSON.stringify(currentSchema, null, 2)}
            </pre>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 px-3 py-2 rounded-lg bg-white text-slate-900 font-bold text-xs shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Schema Info */}
          <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 mb-2">About this schema type:</h4>
            <div className="text-sm text-slate-700">
              {activeTab === 'article' && (
                <p>
                  <strong>Article Schema</strong> helps search engines understand your content structure, author, and publish date.
                  This improves appearance in search results and can enable rich snippets.
                </p>
              )}
              {activeTab === 'faq' && (
                <p>
                  <strong>FAQ Schema</strong> enables your questions to appear directly in search results as expandable FAQ boxes.
                  This is critical for AI answer engines to quote your Q&A pairs.
                </p>
              )}
              {activeTab === 'howto' && (
                <p>
                  <strong>HowTo Schema</strong> structures step-by-step instructions for search engines and voice assistants.
                  Can appear as rich results with visual steps in Google Search.
                </p>
              )}
              {activeTab === 'business' && (
                <p>
                  <strong>LocalBusiness Schema</strong> helps local search engines understand your business location, hours, and services.
                  Essential for appearing in "near me" searches and Google Maps.
                </p>
              )}
            </div>
          </div>

          {/* Copy All Button */}
          {schemaCount > 1 && (
            <div className="mt-6">
              <button
                onClick={handleCopyAll}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy All {schemaCount} Schemas (as Array)
              </button>
              <p className="mt-2 text-xs text-center text-slate-600">
                This will copy all schemas as a JSON array. Add each to your page separately or combine them.
              </p>
            </div>
          )}
        </>
      )}

      {/* Benefits */}
      <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
        <h4 className="text-sm font-bold text-slate-900 mb-2">✨ Why Schema Markup Matters for AISO</h4>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>• <strong>AI Answer Engines</strong>: ChatGPT, Perplexity, and Bing Copilot read schema to quote your content</li>
          <li>• <strong>Rich Results</strong>: Stand out in Google Search with FAQ boxes, ratings, and steps</li>
          <li>• <strong>Voice Search</strong>: Helps voice assistants understand and cite your information</li>
          <li>• <strong>Local SEO</strong>: Essential for appearing in "near me" and map-based searches</li>
        </ul>
      </div>
    </div>
  );
}
