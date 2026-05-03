'use client';

import React, { useState } from 'react';
import { Search, GitCompare, Database, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export default function Analytics() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ documents: string[][] } | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [compIds, setCompIds] = useState({ v1: '', v2: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setIsSearching(true);
    try {
      const res = await axios.get(`${API_BASE}/query`, { params: { q: query } });
      setSearchResults(res.data);
    } catch (err) { console.error(err); }
    finally { setIsSearching(false); }
  };

  const handleCompare = async () => {
    if (!compIds.v1 || !compIds.v2) return;
    setIsComparing(true);
    try {
      const res = await axios.post(`${API_BASE}/compare`, { 
        video_id_1: compIds.v1, 
        video_id_2: compIds.v2 
      });
      setComparison(res.data.comparison);
    } catch (err) { console.error(err); }
    finally { setIsComparing(false); }
  };

  return (
    <main className="pt-32 pb-20 px-8 max-w-[1600px] mx-auto space-y-12">
      <header className="space-y-2">
        <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">Module Beta</p>
        <h1 className="text-6xl italic">Deep <span className="text-primary">Intelligence.</span></h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* RAG Search */}
        <section className="space-y-8">
          <div className="glass-card p-10 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl">Neural Query <span className="text-gray-600">Engine</span></h2>
            </div>
            
            <div className="relative">
              <input 
                placeholder="Ask about match history, player habits, or shot patterns..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-6 text-sm outline-none focus:border-primary/50 transition-all font-medium"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="absolute right-4 top-4 p-2 bg-primary text-black rounded-xl hover:scale-105 transition-all">
                <Search className={`w-5 h-5 ${isSearching ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Vector Retrieval Results</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {searchResults?.documents[0]?.map((doc, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-5 bg-white/5 border border-white/5 rounded-2xl text-xs text-gray-400 leading-relaxed"
                  >
                    {doc}
                  </motion.div>
                ))}
                {!searchResults && (
                  <div className="py-20 text-center space-y-4 opacity-20">
                    <BrainCircuit className="w-12 h-12 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Semantic Query</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Engine */}
        <section className="space-y-8">
          <div className="glass-card p-10 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <GitCompare className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl">Signal <span className="text-gray-600">Variance</span></h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-gray-600 tracking-widest ml-1">Alpha Stream</label>
                <input placeholder="UUID A" className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-xs outline-none focus:border-primary/30" onChange={(e) => setCompIds({...compIds, v1: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-gray-600 tracking-widest ml-1">Beta Stream</label>
                <input placeholder="UUID B" className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-xs outline-none focus:border-primary/30" onChange={(e) => setCompIds({...compIds, v2: e.target.value})} />
              </div>
            </div>

            <button onClick={handleCompare} className="btn-primary w-full py-5 text-[10px]">
              {isComparing ? 'Processing Variance...' : 'Initialize Comparison'}
            </button>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Comparative Report</h3>
              <div className="p-8 bg-black/40 border border-white/5 rounded-3xl min-h-[250px]">
                {comparison ? (
                  <p className="text-sm italic leading-relaxed text-gray-400">{comparison}</p>
                ) : (
                  <div className="py-20 text-center opacity-20">
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Differential Analysis</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
