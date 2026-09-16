import React from 'react';
import { Modal } from '../ui/Modal';
import { Sparkles, RefreshCw, Info } from 'lucide-react';
import { Button } from '../ui/Button';

interface AiInsightsModalProps {
 open: boolean;
 onClose: () => void;
 loading: boolean;
 analysis: string | null;
 source: 'gemini' | 'heuristic' | null;
 error: string | null;
}

/**
 * Displays the AI-generated workforce staffing forecast. Triggered from the
 * sidebar or dashboard. Shows loading spinner while fetching, then renders
 * the markdown-formatted analysis from Gemini (or a heuristic fallback).
 */
export function AiInsightsModal({
 open,
 onClose,
 loading,
 analysis,
 source,
 error,
}: AiInsightsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gemini AI Predictive Staffing Report"
      subtitle="Logistics Freight Volume vs Staffing Curve Analysis"
      icon={<Sparkles size={20} />}
      maxWidth="max-w-2xl"
    >
      <div className="bg-ink/[0.02] dark:bg-paper/[0.04] p-4 rounded-xl border border-line max-h-80 overflow-y-auto space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <RefreshCw size={24} className="text-accent animate-spin" />
            <p className="text-xs font-semibold text-ink">
              Processing 12-Month Freight Trends with Gemini...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs text-rose-600 dark:text-rose-400">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && analysis && (
          <>
            <div className="whitespace-pre-line text-xs leading-relaxed text-ink font-mono">
              {analysis}
            </div>
            {source === 'heuristic' && (
              <div className="flex items-start gap-2 bg-accent/10 border border-accent/20 p-2.5 rounded-lg text-xs text-accent">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Note:</strong> This is a heuristic analysis. Configure{' '}
                  <code className="bg-paper px-1 rounded border border-line">GEMINI_API_KEY</code> in{' '}
                  <code className="bg-paper px-1 rounded border border-line">.env.local</code> for AI-powered
                  insights.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <Button onClick={onClose} variant="primary">
          Close Insights
        </Button>
      </div>
    </Modal>
  );
}

