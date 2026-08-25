import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Sparkles, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
 <div className="bg-pink-50/70 p-4 rounded-xl border border-pink-100 max-h-80 overflow-y-auto space-y-3">
 {loading && (
 <div className="flex flex-col items-center justify-center py-8 space-y-3">
 <RefreshCw size={24} className="text-pink-600 animate-spin" />
 <p className="text-xs font-bold text-pink-800">
 Processing 12-Month Freight Trends with Gemini...
 </p>
 </div>
 )}

 {error && (
 <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-800">
 <p className="font-bold">Error</p>
 <p>{error}</p>
 </div>
 )}

 {!loading && !error && analysis && (
 <>
 <div className="whitespace-pre-line text-[11px] leading-relaxed text-pink-950 font-mono">
 {analysis}
 </div>
 {source === 'heuristic' && (
 <div className="flex items-start gap-2 bg-pink-100 border border-pink-200 p-2 rounded-lg text-[10px] text-pink-700">
 <Info size={14} className="flex-shrink-0 mt-0.5" />
 <p>
 <strong>Note:</strong> This is a heuristic analysis. Configure{' '}
 <code className="bg-white px-1 rounded">GEMINI_API_KEY</code> in{' '}
 <code className="bg-white px-1 rounded">.env.local</code> for AI-powered
 insights.
 </p>
 </div>
 )}
 </>
 )}
 </div>

 <div className="flex justify-end gap-2 pt-2 border-t border-pink-100">
 <Button onClick={onClose} variant="primary">
 Close Insights
 </Button>
 </div>
 </Modal>
 );
}
