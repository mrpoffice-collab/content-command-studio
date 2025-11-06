'use client';

import { useState } from 'react';

interface EditTopicModalProps {
  topic: any;
  strategyFleschScore: number;
  onClose: () => void;
  onSave: (updates: {
    title?: string;
    keyword?: string;
    outline?: string[];
    target_flesch_score?: number | null;
  }) => Promise<void>;
}

export default function EditTopicModal({
  topic,
  strategyFleschScore,
  onClose,
  onSave,
}: EditTopicModalProps) {
  const [title, setTitle] = useState(topic.title || '');
  const [keyword, setKeyword] = useState(topic.keyword || '');
  const [outlineText, setOutlineText] = useState(
    Array.isArray(topic.outline) ? topic.outline.join('\n') : topic.outline || ''
  );
  const [useCustomFlesch, setUseCustomFlesch] = useState(!!topic.target_flesch_score);
  const [customFlesch, setCustomFlesch] = useState(topic.target_flesch_score || strategyFleschScore);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const outline = outlineText.split('\n').map(line => line.trim()).filter(Boolean);
      await onSave({
        title,
        keyword,
        outline,
        target_flesch_score: useCustomFlesch ? customFlesch : null,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save topic:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getReadingLevelDesc = (flesch: number) => {
    if (flesch >= 70) return '7th grade (general public)';
    if (flesch >= 60) return '8th-9th grade (standard)';
    if (flesch >= 50) return '10th grade (educated adults)';
    if (flesch >= 40) return 'College level (professionals)';
    return 'Graduate level (technical experts)';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-deep-indigo to-blue-600 text-white p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold">Edit Topic</h2>
          <p className="text-blue-100 text-sm mt-1">Adjust this topic to improve generation success</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Topic Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-900 font-semibold focus:border-deep-indigo focus:outline-none focus:ring-2 focus:ring-deep-indigo/20"
              placeholder="Enter topic title"
            />
            <p className="text-xs text-slate-500 mt-1">
              💡 Tip: Simpler titles work better for lower reading levels
            </p>
          </div>

          {/* Keyword */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Target Keyword
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-900 font-semibold focus:border-deep-indigo focus:outline-none focus:ring-2 focus:ring-deep-indigo/20"
              placeholder="Enter target keyword"
            />
          </div>

          {/* Outline */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Outline (one section per line)
            </label>
            <textarea
              value={outlineText}
              onChange={(e) => setOutlineText(e.target.value)}
              rows={6}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-900 font-semibold focus:border-deep-indigo focus:outline-none focus:ring-2 focus:ring-deep-indigo/20"
              placeholder="Introduction&#10;Main points&#10;Conclusion"
            />
            <p className="text-xs text-slate-500 mt-1">
              💡 Tip: Simpler section names work better for lower reading levels
            </p>
          </div>

          {/* Reading Level Override */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="useCustomFlesch"
                checked={useCustomFlesch}
                onChange={(e) => setUseCustomFlesch(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-2 border-blue-400 text-deep-indigo focus:ring-2 focus:ring-deep-indigo/20"
              />
              <div className="flex-1">
                <label htmlFor="useCustomFlesch" className="block text-sm font-bold text-slate-900 cursor-pointer">
                  Override reading level for this topic only
                </label>
                <p className="text-xs text-slate-600 mt-1">
                  Strategy default: Flesch {strategyFleschScore} ({getReadingLevelDesc(strategyFleschScore)})
                </p>
              </div>
            </div>

            {useCustomFlesch && (
              <div className="mt-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Custom Reading Level for This Topic
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="30"
                    max="80"
                    step="5"
                    value={customFlesch}
                    onChange={(e) => setCustomFlesch(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-deep-indigo min-w-[3rem] text-center">
                    {customFlesch}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-semibold mt-2">
                  {getReadingLevelDesc(customFlesch)}
                </p>
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-300">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {customFlesch > strategyFleschScore
                      ? '📖 Higher score = simpler content. Use this if the topic is too complex for your main audience.'
                      : customFlesch < strategyFleschScore
                      ? '🎓 Lower score = more complex content. Use this if the topic requires technical depth.'
                      : '✓ Same as strategy default'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 p-6 rounded-b-2xl border-t-2 border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-6 py-3 text-sm font-bold text-slate-700 border-2 border-slate-300 hover:border-slate-400 hover:bg-white transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-deep-indigo to-blue-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
