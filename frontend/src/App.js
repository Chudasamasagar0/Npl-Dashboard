import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileText, Sparkles, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import './App.css';

const STOP_WORDS = [
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'was', 'are', 'but', 'not', 'too', 'just', 'they', 'their', 'them', 'when', 'your', 'you', 'will', 'our', 'can', 'all', 'its', 'been', 'about', 'more', 'some', 'would', 'also', 'what', 'which', 'there', 'therefore', 'get', 'got', 'because', 'were', 'could', 'should', 'than', 'those', 'each', 'other', 'after', 'before', 'over', 'again', 'very', 'also', 'here', 'there', 'how', 'why', 'into', 'out', 'may', 'while'
];

const EMOTION_KEYWORDS = {
  Joy: ['happy', 'amazing', 'love', 'great', 'excited', 'delight', 'pleased', 'fantastic', 'excellent', 'wonderful'],
  Anger: ['angry', 'annoyed', 'frustrated', 'disappointed', 'ridiculous', 'upset', 'hate', 'worst', 'infuriating', 'rage'],
  Sadness: ['sad', 'unhappy', 'disappointed', 'hurt', 'down', 'regret', 'tragic', 'lonely', 'mourn', 'depressed'],
  Fear: ['scared', 'worried', 'nervous', 'anxious', 'fear', 'afraid', 'concerned', 'uncertain', 'panic', 'terrified'],
  Surprise: ['surprised', 'astonished', 'shocked', 'unexpected', 'amazed', 'wow', 'incredible', 'startled', 'jolt', 'eye-opening'],
};

const sentimentMap = {
  POSITIVE: {
    label: 'Positive',
    color: '#22c55e',
    icon: '😊',
  },
  NEGATIVE: {
    label: 'Negative',
    color: '#f97316',
    icon: '😞',
  },
  NEUTRAL: {
    label: 'Neutral',
    color: '#94a3af',
    icon: '😐',
  },
};

function extractKeywords(text) {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.includes(word));

  const frequency = normalized.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));
}

function detectEmotions(text) {
  const lowercase = text.toLowerCase();
  const scores = Object.entries(EMOTION_KEYWORDS).reduce((acc, [emotion, terms]) => {
    acc[emotion] = terms.reduce((count, term) => count + (lowercase.includes(term) ? 1 : 0), 0);
    return acc;
  }, {});

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0) || 1;

  return Object.entries(scores).map(([name, value]) => ({
    name,
    value: Math.round((value / total) * 100),
  }));
}

function getSentimentMeta(label, score) {
  const key = label?.toUpperCase();
  if (sentimentMap[key]) {
    return sentimentMap[key];
  }
  if (score >= 0.55) {
    return sentimentMap.POSITIVE;
  }
  if (score <= 0.45) {
    return sentimentMap.NEGATIVE;
  }
  return sentimentMap.NEUTRAL;
}

function buildExplanation(label, keywords) {
  if (!keywords.length) {
    return `${label} sentiment has been detected based on the overall tone and model confidence of the submitted text.`;
  }
  return `${label} sentiment is driven by key phrases such as ${keywords.slice(0, 3).map((item) => item.word).join(', ')}.`;
}

function formatEntry(data, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    sentiment: data.label,
    confidence: data.confidence,
    explanation: data.explanation,
    keywords: data.keywords,
    dateTime: new Date().toLocaleString(),
    color: data.color,
    icon: data.icon,
    score: data.score,
  };
}

function App() {
  const [text, setText] = useState('');
  const [current, setCurrent] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const previewRef = useRef(null);

  const analyzeText = async (inputText) => {
    const words = inputText
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const positiveTerms = ['amazing', 'excellent', 'love', 'great', 'happy', 'pleased', 'smooth', 'fast', 'delight', 'optimal', 'reliable', 'secure'];
    const negativeTerms = ['bad', 'slow', 'frustrating', 'poor', 'hate', 'error', 'issue', 'delay', 'bug', 'confusing', 'broken', 'unreliable'];

    const positiveCount = words.filter((word) => positiveTerms.includes(word)).length;
    const negativeCount = words.filter((word) => negativeTerms.includes(word)).length;
    const score = Math.max(0, Math.min(1, (positiveCount + 1 - negativeCount) / (words.length * 0.25 + 1)));
    const sentimentLabel = score >= 0.6 ? 'Positive' : score <= 0.4 ? 'Negative' : 'Neutral';
    const keywords = extractKeywords(inputText);
    const meta = getSentimentMeta(sentimentLabel, score);

    return {
      label: meta.label,
      score,
      confidence: Math.round(Math.max(45, Math.min(98, score * 100 + 12))),
      color: meta.color,
      icon: meta.icon,
      explanation: buildExplanation(meta.label, keywords),
      keywords,
      emotions: detectEmotions(inputText),
    };
  };

  const handleAnalyze = async () => {
    if (!text.trim()) {
      setError('Enter text before running analysis.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeText(text);
      setCurrent(analysis);
      setHistory((prev) => [formatEntry(analysis, text), ...prev]);
      setText('');
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (previewRef.current) {
      clearTimeout(previewRef.current);
    }

    if (!text.trim()) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    previewRef.current = window.setTimeout(async () => {
      try {
        const analysis = await analyzeText(text);
        setPreview(analysis);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 700);

    return () => {
      if (previewRef.current) {
        clearTimeout(previewRef.current);
      }
    };
  }, [text]);

  const filteredHistory = useMemo(() => {
    const term = search.toLowerCase();
    return history.filter((entry) => {
      const matchesSearch =
        entry.text.toLowerCase().includes(term) ||
        entry.sentiment.toLowerCase().includes(term) ||
        entry.explanation.toLowerCase().includes(term);
      const matchesFilter = filter === 'All' || entry.sentiment === filter;
      return matchesSearch && matchesFilter;
    });
  }, [history, search, filter]);

  const distribution = useMemo(() => {
    const counts = { Positive: 0, Negative: 0, Neutral: 0 };
    history.forEach((entry) => {
      counts[entry.sentiment] += 1;
    });
    return [
      { name: 'Positive', value: counts.Positive, fill: sentimentMap.POSITIVE.color },
      { name: 'Negative', value: counts.Negative, fill: sentimentMap.NEGATIVE.color },
      { name: 'Neutral', value: counts.Neutral, fill: sentimentMap.NEUTRAL.color },
    ];
  }, [history]);

  const trendData = useMemo(() => {
    const days = history.reduce((acc, entry) => {
      const day = new Date(entry.dateTime).toLocaleDateString();
      if (!acc[day]) {
        acc[day] = { date: day, Positive: 0, Negative: 0, Neutral: 0 };
      }
      acc[day][entry.sentiment] += 1;
      return acc;
    }, {});
    return Object.values(days).slice(0, 10);
  }, [history]);

  const wordCloud = useMemo(() => {
    const keywords = (current || preview)?.keywords || [];
    return keywords.map((item, index) => ({
      ...item,
      size: 14 + item.count * 7,
      rotation: index % 2 === 0 ? '-1deg' : '1deg',
    }));
  }, [current, preview]);

  const exportCSV = () => {
    const headers = ['Text', 'Sentiment', 'Confidence', 'Explanation', 'Timestamp'];
    const rows = filteredHistory.map((entry) => [
      `"${entry.text.replace(/"/g, '""')}"`,
      entry.sentiment,
      `${entry.confidence}%`,
      `"${entry.explanation.replace(/"/g, '""')}"`,
      entry.dateTime,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sentiment-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(20);
    doc.text('Sentiment Analytics History', 14, 22);
    doc.setFontSize(10);
    filteredHistory.slice(0, 10).forEach((entry, index) => {
      const y = 32 + index * 10;
      doc.text(entry.text.substring(0, 80), 14, y);
      doc.text(entry.sentiment, 100, y);
      doc.text(`${entry.confidence}%`, 136, y);
      doc.text(entry.dateTime, 170, y);
    });
    doc.save('sentiment-history.pdf');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="mb-8 overflow-hidden rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
        >
          <div className="grid gap-8 xl:grid-cols-[1.7fr_0.9fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full bg-sky-400/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
                Enterprise AI Analytics
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                NLP Sentiment Analytics for Customer Experience Teams
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-300">
                Turn customer reviews and support feedback into actionable sentiment intelligence with premium charts, keyword extraction, emotion detection, and audit-ready history.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-slate-700/70 bg-slate-950/90 p-6 shadow-xl shadow-slate-950/20">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-content-center rounded-2xl bg-sky-400/10 text-sky-300">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Total Analyses</p>
                    <p className="mt-4 text-4xl font-semibold text-white">{history.length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-slate-700/70 bg-slate-950/90 p-6 shadow-xl shadow-slate-950/20">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-content-center rounded-2xl bg-violet-400/10 text-violet-300">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Live Preview</p>
                    <p className="mt-4 text-4xl font-semibold text-white">{preview ? preview.label : 'Ready'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="rounded-[1.75rem] border border-rose-500/30 bg-rose-500/10 px-6 py-5 text-sm text-rose-100 shadow-sm shadow-rose-500/10">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Sentiment distribution</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Engagement chart overview</h2>
                </div>
                <p className="text-sm text-slate-400">Interactive analytics for fast stakeholder reporting.</p>
              </div>
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-6">
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={distribution} dataKey="value" innerRadius={72} outerRadius={110} paddingAngle={4}>
                        {distribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} formatter={(value) => `${value} analyses`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-6">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                      <Line type="monotone" dataKey="Positive" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Negative" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Neutral" stroke="#94a3af" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Word cloud</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Key topic visualization</h2>
                </div>
                <p className="text-sm text-slate-400">Word size corresponds to frequency and relevance.</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                {wordCloud.length ? (
                  wordCloud.map((item) => (
                    <span
                      key={item.word}
                      className="word-cloud-item inline-flex items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-slate-100 shadow-sm shadow-slate-950/20"
                      style={{ fontSize: `${item.size}px`, transform: `rotate(${item.rotation})` }}
                    >
                      {item.word}
                    </span>
                  ))
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-700/80 p-12 text-center text-slate-500">
                    Submit an analysis to generate a word cloud preview.
                  </div>
                )}
              </div>
            </motion.section>
          </div>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Feedback Analyzer</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Enterprise sentiment workflows</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="rounded-full border border-slate-700/80 bg-slate-950/90 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-400/50 hover:bg-slate-800"
                >
                  Clear Input
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="rounded-full bg-gradient-to-r from-sky-400 to-violet-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Analyzing...' : 'Analyze Sentiment'}
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste customer review, survey feedback, or support comment..."
                className="min-h-[280px] w-full rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 px-6 py-5 text-base leading-7 text-slate-100 outline-none ring-1 ring-slate-700/40 transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
              />
              <p className="text-sm text-slate-400">
                Live typing preview helps you validate sentiment before submitting the final analysis.
              </p>
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Real-time preview</p>
                  <span className="text-sm text-slate-400">{previewLoading ? 'Analyzing...' : 'Auto-updates while typing'}</span>
                </div>
                {preview ? (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="grid h-14 w-14 place-content-center rounded-3xl text-2xl"
                        style={{ background: `${preview.color}20`, color: preview.color }}
                      >
                        {preview.icon}
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-white">{preview.label}</p>
                        <p className="text-sm text-slate-400">Confidence {preview.confidence}%</p>
                      </div>
                    </div>
                    <p className="text-slate-300">{preview.explanation}</p>
                    <div className="rounded-full bg-slate-800/80 p-1">
                      <div
                        className="h-3 rounded-full"
                        style={{ width: `${preview.confidence}%`, background: preview.color }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-700/80 p-8 text-center text-slate-500">
                    Start typing text to receive sentiment predictions and insights instantly.
                  </div>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Keyword extraction</p>
                  <p className="text-sm text-slate-400">Top insights</p>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  {(preview?.keywords || current?.keywords || []).map((keyword) => (
                    <span
                      key={keyword.word}
                      className="rounded-full border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-sm shadow-slate-950/20"
                    >
                      {keyword.word}
                    </span>
                  ))}
                </div>
                <div className="mt-6 space-y-4">
                  {(preview?.emotions || current?.emotions || []).map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>{item.name}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl mt-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Analysis history</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Search, filter and export sentiment insights</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportCSV}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-800/90 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                <FileText className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={exportPDF}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search feedback or sentiment..."
              className="rounded-3xl border border-slate-700/80 bg-slate-950/90 px-5 py-4 text-slate-100 outline-none ring-1 ring-slate-700/40 transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-3xl border border-slate-700/80 bg-slate-950/90 px-5 py-4 text-slate-100 outline-none ring-1 ring-slate-700/40 transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
            >
              <option>All</option>
              <option>Positive</option>
              <option>Negative</option>
              <option>Neutral</option>
            </select>
            <div className="rounded-3xl bg-slate-950/90 px-5 py-4 text-slate-200 ring-1 ring-slate-700/60">
              <p className="text-sm text-slate-400">Records</p>
              <p className="mt-2 text-xl font-semibold text-white">{filteredHistory.length}</p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90">
            <table className="min-w-full divide-y divide-slate-700 text-left">
              <thead className="bg-slate-900/90">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Feedback</th>
                  <th className="px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Sentiment</th>
                  <th className="px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Confidence</th>
                  <th className="px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      No history yet. Submit an analysis to populate the dashboard.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((entry) => (
                    <tr key={entry.id} className="transition hover:bg-slate-900/70">
                      <td className="px-6 py-5 text-sm leading-6 text-slate-300">{entry.text}</td>
                      <td className="px-6 py-5">
                        <span
                          className="inline-flex rounded-full px-4 py-2 text-sm font-semibold"
                          style={{ backgroundColor: `${entry.color}20`, color: entry.color }}
                        >
                          {entry.icon} {entry.sentiment}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-300">{entry.confidence}%</td>
                      <td className="px-6 py-5 text-sm text-slate-400">{entry.dateTime}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default App;
