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
import { Download, FileText, Sparkles, TrendingUp, Database, Smile, Frown, Meh } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
const NEUTRAL_PHRASES = [
  'okay', 'ok', 'fine', 'normal', 'nothing special', 'average', 'moderate', 'so-so', 'just okay', 'decent'
];

const POSITIVE_WORDS = [
  'love', 'great', 'excellent', 'wonderful', 'fantastic', 'amazing', 'best', 'awesome', 'good', 'happy', 'pleased', 'perfect', 'perfectly', 'recommend', 'highly'
];

const NEGATIVE_WORDS = [
  'worst', 'bad', 'terrible', 'disappointed', 'disappointment', 'crash', 'crashing', 'broken', 'useless', 'unusable', 'poor', 'hate', 'annoyed', 'frustrated', 'ridiculous', 'upset', 'fail', 'failed'
];

function isLinguisticallyNeutral(text) {
  if (!text) return true;
  const cleanText = text.toLowerCase().trim();
  
  // 1. If it contains explicitly neutral phrases
  for (const phrase of NEUTRAL_PHRASES) {
    if (cleanText.includes(phrase)) {
      return true;
    }
  }
  
  // 2. Check if it's a scheduling/factual statement (objective)
  const objectivePatterns = [
    /\b(schedule|scheduled|meeting|appointment|tomorrow|today|yesterday|date|time|clock|calendar)\b/i,
    /\b(file|report|document|attachment|pdf|csv)\b/i,
    /\b(status|info|information|details)\b/i,
    /\b(is attached|has been sent|is scheduled|please find)\b/i
  ];
  
  const hasObjectiveContext = objectivePatterns.some(pattern => pattern.test(cleanText));
  
  // 3. Count positive and negative words
  const words = cleanText.replace(/[^a-z\s]/g, ' ').split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (POSITIVE_WORDS.includes(word)) positiveCount++;
    if (NEGATIVE_WORDS.includes(word)) negativeCount++;
  });
  
  // If there are no positive or negative words, OR if it has objective context and very low emotion, it's Neutral
  if (positiveCount === 0 && negativeCount === 0) {
    return true;
  }
  
  if (hasObjectiveContext && positiveCount <= 1 && negativeCount === 0) {
    return true;
  }
  
  return false;
}

function normalizeLabel(label) {
  if (!label) return 'Neutral';
  const key = label.trim().toUpperCase();
  if (key === 'POSITIVE') return 'Positive';
  if (key === 'NEGATIVE') return 'Negative';
  return 'Neutral';
}

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
  if (typeof score === 'number' && score < 0.60) {
    return sentimentMap.NEUTRAL;
  }
  const key = label?.toUpperCase();
  if (sentimentMap[key]) {
    return sentimentMap[key];
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
  const [uploadSummary, setUploadSummary] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const previewRef = useRef(null);

  const analyzeText = async (inputText) => {
    const keywords = extractKeywords(inputText);
    const response = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: inputText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Unable to connect to backend API');
    }

    const data = await response.json();
    const modelOutput = Array.isArray(data) ? data[0] : data;
    let sentimentLabel = normalizeLabel(modelOutput?.label);
    let score = typeof modelOutput?.score === 'number' ? modelOutput.score : 0.5;

    if (isLinguisticallyNeutral(inputText)) {
      sentimentLabel = 'Neutral';
      score = 0.50;
    }

    const meta = getSentimentMeta(sentimentLabel, score);

    return {
      label: meta.label,
      score,
      confidence: sentimentLabel === 'Neutral' ? 65 : Math.round(Math.max(45, Math.min(98, score * 100 + 12))),
      color: meta.color,
      icon: meta.icon,
      explanation: buildExplanation(meta.label, keywords),
      keywords,
      emotions: detectEmotions(inputText),
    };
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileUploading(true);
    setUploadSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:5000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'CSV upload failed');
      }

      const data = await response.json();
      setUploadSummary(data);

      if (data.results && Array.isArray(data.results)) {
        const formattedResults = data.results.map((res) => {
          const normalizedLabel = normalizeLabel(res.label);
          const score = typeof res.score === 'number' ? res.score : 0.5;
          const keywords = extractKeywords(res.text);
          const meta = getSentimentMeta(normalizedLabel, score);

          const analysis = {
            label: meta.label,
            score,
            confidence: Math.round(Math.max(45, Math.min(98, score * 100 + 12))),
            color: meta.color,
            icon: meta.icon,
            explanation: buildExplanation(meta.label, keywords),
            keywords,
            emotions: detectEmotions(res.text),
          };

          return formatEntry(analysis, res.text);
        });

        setHistory((prev) => [...formattedResults, ...prev]);

        if (formattedResults.length > 0) {
          setCurrent(formattedResults[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'CSV upload failed');
    } finally {
      setFileUploading(false);
      event.target.value = '';
    }
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
      return;
    }

    previewRef.current = window.setTimeout(async () => {
      try {
        const analysis = await analyzeText(text);
        setPreview(analysis);
      } catch {
        setPreview(null);
      } finally {
        
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

    // Page styling & Theme colors
    const primaryColor = [15, 23, 42]; // Slate 900

    // Title Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Sentiment Analytics Report', 14, 20);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    const timestampStr = new Date().toLocaleString();
    doc.text(`Generated: ${timestampStr} | Filter: ${filter} | Search: "${search || 'None'}"`, 14, 26);

    // Divider Line
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.5);
    doc.line(14, 30, doc.internal.pageSize.width - 14, 30);

    // Compute metrics
    const total = filteredHistory.length;
    const positive = filteredHistory.filter((entry) => entry.sentiment === 'Positive').length;
    const negative = filteredHistory.filter((entry) => entry.sentiment === 'Negative').length;
    const neutral = filteredHistory.filter((entry) => entry.sentiment === 'Neutral').length;

    // Metrics Cards
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // Slate 600

    // Card 1: Total
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(14, 35, 60, 16, 'F');
    doc.text('TOTAL ANALYSES', 18, 41);
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(total.toString(), 18, 48);

    // Card 2: Positive
    doc.setFillColor(240, 253, 244); // Emerald 50
    doc.rect(80, 35, 60, 16, 'F');
    doc.setFontSize(9);
    doc.setTextColor(21, 128, 61); // Emerald 700
    doc.text('POSITIVE SENTIMENT', 84, 41);
    doc.setFontSize(12);
    doc.text(positive.toString(), 84, 48);

    // Card 3: Negative
    doc.setFillColor(255, 247, 237); // Orange 50
    doc.rect(146, 35, 60, 16, 'F');
    doc.setFontSize(9);
    doc.setTextColor(194, 65, 12); // Orange 700
    doc.text('NEGATIVE SENTIMENT', 150, 41);
    doc.setFontSize(12);
    doc.text(negative.toString(), 150, 48);

    // Card 4: Neutral
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(212, 35, doc.internal.pageSize.width - 212 - 14, 16, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text('NEUTRAL SENTIMENT', 216, 41);
    doc.setFontSize(12);
    doc.text(neutral.toString(), 216, 48);

    // Table Headers & Rows (using standard simple arrays)
    const tableHeaders = [['Feedback Review Text', 'Sentiment', 'Confidence', 'Timestamp']];

    const tableRows = filteredHistory.map((entry) => [
      entry.text,
      entry.sentiment,
      `${entry.confidence}%`,
      entry.dateTime
    ]);

    // Generate AutoTable
    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 57,
      margin: { left: 14, right: 14, bottom: 20 },
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [51, 65, 85], // Slate 700
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 32, fontStyle: 'bold' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 48 }
      },
      didParseCell: (data) => {
        // Color code sentiment column text (index 1) for premium feel
        if (data.column.index === 1 && data.cell.section === 'body') {
          const val = data.cell.raw;
          if (val === 'Positive') {
            data.cell.styles.textColor = [34, 197, 94]; // Emerald 500
          } else if (val === 'Negative') {
            data.cell.styles.textColor = [249, 115, 22]; // Orange 500
          } else {
            data.cell.styles.textColor = [148, 163, 184]; // Slate 400
          }
        }
      },
      didDrawPage: (data) => {
        // Footer: Page Number & Branding
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate 400
        
        // Bottom left branding
        doc.text(
          'NLP Sentiment Analytics Dashboard - Enterprise Report',
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
        
        // Bottom right page numbering
        doc.text(
          `Page ${data.pageNumber}`,
          doc.internal.pageSize.width - data.settings.margin.right - 10,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save('sentiment-analytics-report.pdf');
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

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Sentiment distribution</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">Engagement chart overview</h2>
                  <p className="mt-4 max-w-2xl text-slate-400">Monitor sentiment trends and customer feedback performance across your dataset.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:flex xl:flex-col xl:gap-4 items-center xl:items-end flex-wrap justify-end">
                  <div className="rounded-[1.25rem] border border-slate-700/80 bg-slate-950/90 w-24 h-24 flex flex-col items-center justify-center">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Analyses</p>
                    <p className="mt-2 text-2xl font-bold text-white">{history.length}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-700/80 bg-slate-950/90 w-24 h-24 flex flex-col items-center justify-center">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Positive</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-400">{distribution[0].value}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-700/80 bg-slate-950/90 w-24 h-24 flex flex-col items-center justify-center">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Negative</p>
                    <p className="mt-2 text-2xl font-bold text-orange-400">{distribution[1].value}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-slate-700/80 bg-slate-950/90 w-24 h-24 flex flex-col items-center justify-center">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Neutral</p>
                    <p className="mt-2 text-2xl font-bold text-slate-400">{distribution[2].value}</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-2">
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

          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  className="min-h-[220px] w-full rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 px-6 py-5 text-base leading-7 text-slate-100 outline-none ring-1 ring-slate-700/40 transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-5">
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Live Preview</p>
                    <p className="mt-4 text-xl font-semibold text-white">{preview ? preview.label : 'Ready'}</p>
                    <p className="mt-2 text-sm text-slate-400">Auto-updates while typing</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-5">
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">CSV Batch Upload</p>
                    <p className="mt-4 text-sm text-slate-400">Upload a CSV with a <code className="rounded bg-slate-900 px-1 py-0.5 text-xs">text</code> column.</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleUploadFile}
                      disabled={fileUploading}
                      className="mt-4 w-full rounded-3xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>

                {uploadSummary && (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Rows */}
                    <div className="rounded-[1.75rem] border border-slate-700/70 bg-slate-950/90 p-5 shadow-xl shadow-slate-950/20">
                      <div className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-content-center rounded-2xl bg-sky-400/10 text-sky-300">
                          <Database className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Rows</p>
                          <p className="mt-2 text-3xl font-bold text-white">{uploadSummary.total_records}</p>
                        </div>
                      </div>
                    </div>

                    {/* Positive */}
                    <div className="rounded-[1.75rem] border border-slate-700/70 bg-slate-950/90 p-5 shadow-xl shadow-slate-950/20">
                      <div className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-content-center rounded-2xl bg-emerald-400/10 text-emerald-400">
                          <Smile className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Positive</p>
                          <p className="mt-2 text-3xl font-bold text-emerald-400">{uploadSummary.positive}</p>
                        </div>
                      </div>
                    </div>

                    {/* Negative */}
                    <div className="rounded-[1.75rem] border border-slate-700/70 bg-slate-950/90 p-5 shadow-xl shadow-slate-950/20">
                      <div className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-content-center rounded-2xl bg-orange-400/10 text-orange-400">
                          <Frown className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Negative</p>
                          <p className="mt-2 text-3xl font-bold text-orange-400">{uploadSummary.negative}</p>
                        </div>
                      </div>
                    </div>

                    {/* Neutral */}
                    <div className="rounded-[1.75rem] border border-slate-700/70 bg-slate-950/90 p-5 shadow-xl shadow-slate-950/20">
                      <div className="flex items-center gap-4">
                        <span className="grid h-12 w-12 place-content-center rounded-2xl bg-slate-400/10 text-slate-400">
                          <Meh className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Neutral</p>
                          <p className="mt-2 text-3xl font-bold text-slate-300">{uploadSummary.neutral || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Insights</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Preview & keywords</h3>
                  </div>
                  <span className="text-sm text-slate-400">Fast feedback summary</span>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-5">
                    <div className="flex items-center gap-4">
                      <div
                        className="grid h-14 w-14 place-content-center rounded-3xl text-2xl"
                        style={{ background: `${preview?.color || '#94a3af'}20`, color: preview?.color || '#94a3af' }}
                      >
                        {preview?.icon || '🔍'}
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-white">{preview ? preview.label : 'Awaiting input'}</p>
                        <p className="text-sm text-slate-400">{preview ? `Confidence ${preview.confidence}%` : 'Type in the feedback box to preview results.'}</p>
                      </div>
                    </div>
                    {preview && (
                      <div className="mt-4 space-y-3">
                        <p className="text-slate-300">{preview.explanation}</p>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${preview.confidence}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 p-5">
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Keywords</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {(preview?.keywords || current?.keywords || []).length ? (
                        (preview?.keywords || current?.keywords || []).map((keyword) => (
                          <span
                            key={keyword.word}
                            className="rounded-full border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-sm shadow-slate-950/20"
                          >
                            {keyword.word}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Keywords will appear here after analysis.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
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
