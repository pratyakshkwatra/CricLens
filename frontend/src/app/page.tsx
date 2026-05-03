'use client';

import React, { useState } from 'react';
import { Upload, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useMatch } from '../context/MatchContext';

const API_BASE = 'http://localhost:8000';

export default function Home() {
  const { setFileId, isTurboMode, setIsTurboMode } = useMatch();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trim, setTrim] = useState({ start: 0, end: 10 });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        params: { start: trim.start, end: trim.end, is_turbo: isTurboMode }
      });
      setFileId(res.data.id);
      router.push('/dashboard');
    } catch (err) { 
      console.error(err); 
      setIsUploading(false); 
    }
  };

  const updateTrim = (key: 'start' | 'end', val: number) => {
    setTrim(prev => ({ ...prev, [key]: val }));
    if (videoRef.current) videoRef.current.currentTime = val;
  };

  return (
    <main className="pt-32 pb-20 px-8 max-w-[1600px] mx-auto min-h-screen flex items-center justify-center">
      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.section 
            key="hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center text-center space-y-12"
          >
            <div className="px-4 py-2 bg-black border border-primary/20 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#a3e635]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Neural Engine Active</span>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-7xl md:text-[9rem] leading-none">
                FORGE <span className="text-primary italic">VICTORY.</span><br />
                SHATTER <span className="text-white">LIMITS.</span>
              </h1>
              <p className="text-gray-500 max-w-2xl mx-auto text-lg font-medium leading-relaxed">
                The definitive cricket intelligence ecosystem. High-fidelity telemetry, 
                autonomous shot classification, and the global vanguard of performance analytics.
              </p>
            </div>

            <label className="btn-primary cursor-pointer inline-flex items-center gap-3">
              <Upload className="w-5 h-5" />
              Enter Analysis Pipeline
              <input type="file" className="hidden" onChange={handleFileSelect} accept="video/*" />
            </label>
          </motion.section>
        ) : (
          <motion.section 
            key="trim"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12"
          >
            <div className="glass-card aspect-video relative overflow-hidden bg-black flex items-center justify-center">
               {videoUrl && (
                 <video 
                   ref={videoRef} 
                   src={videoUrl} 
                   className="w-full h-full object-contain"
                   controls={false}
                 />
               )}
               <div className="absolute top-6 left-6 px-4 py-1 bg-primary/20 backdrop-blur-md rounded-full text-[10px] font-black text-primary uppercase border border-primary/30 italic">Preview Stream</div>
            </div>

            <div className="glass-card p-12 space-y-12 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-2">Configuration Mode</p>
                  <h2 className="text-5xl">Trim Analysis <span className="italic text-primary">Window.</span></h2>
                </div>
                <Scissors className="w-12 h-12 text-primary/20" />
              </div>

              <div className="space-y-8">
                <div className="flex justify-between text-xs font-black uppercase text-gray-500">
                  <span>Signal Start: {trim.start}s</span>
                  <span>Signal End: {trim.end}s</span>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[8px] font-black uppercase text-gray-600 tracking-widest ml-1">Alpha Point (Start)</p>
                    <input type="range" min="0" max={videoRef.current?.duration || 120} className="w-full accent-primary" value={trim.start} onChange={(e) => updateTrim('start', parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[8px] font-black uppercase text-gray-600 tracking-widest ml-1">Omega Point (End)</p>
                    <input type="range" min="0" max={videoRef.current?.duration || 120} className="w-full accent-primary" value={trim.end} onChange={(e) => updateTrim('end', parseInt(e.target.value))} />
                  </div>
                  
                  <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isTurboMode ? 'bg-primary' : 'bg-gray-800'}`}
                         onClick={() => setIsTurboMode(!isTurboMode)}>
                      <motion.div 
                        animate={{ x: isTurboMode ? 22 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-lg" 
                      />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Turbo Mode (60 Frame Cap)</span>
                  </div>
                </div>
                <div className="flex gap-4 pt-8">
                  <button onClick={() => setSelectedFile(null)} className="flex-1 py-5 border border-white/10 rounded-2xl font-black uppercase italic tracking-widest hover:bg-white/5 transition-all">Abort</button>
                  <button onClick={handleUpload} className="btn-primary flex-1">
                    {isUploading ? 'Initializing...' : 'Initialize Pipeline'}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
