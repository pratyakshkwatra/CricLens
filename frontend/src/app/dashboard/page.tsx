'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight, Radio, Target, Activity, Info, Download, Cpu, ChartBar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useMatch } from '@/context/MatchContext';

const API_BASE = 'http://localhost:8000';

const CricketField = ({ events }: { events: any[] }) => {
  const getPos = (e: any) => {
    if (e.x !== undefined && e.y !== undefined) {
      return { x: e.x * 100, y: e.y * 100 };
    }
    const t = String(e.shot_type || '').toLowerCase();
    const hash = t.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const jitterX = (hash % 20) - 10;
    const jitterY = (hash % 15) - 7;

    if (t.includes('cover')) return { x: 30 + jitterX, y: 30 + jitterY };
    if (t.includes('straight')) return { x: 50 + jitterX, y: 20 + jitterY };
    if (t.includes('pull') || t.includes('sweep')) return { x: 80 + jitterX, y: 40 + jitterY };
    if (t.includes('cut')) return { x: 20 + jitterX, y: 50 + jitterY };
    return { x: 50 + jitterX, y: 65 + jitterY };
  };

  return (
    <div className="relative w-full aspect-square glass-card bg-primary/5 border-primary/20 overflow-hidden rounded-full border-2">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.15),transparent)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-24 bg-white/10 rounded-sm blur-[1px]" />
      <AnimatePresence>
        {events.map((e, i) => {
          const pos = getPos(e);
          return (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: e.isPlaceholder ? 0.3 : 0.8 }}
              className="absolute w-4 h-4 rounded-full group cursor-pointer"
              style={{ 
                left: `${pos.x}%`, 
                top: `${100 - pos.y}%`,
                backgroundColor: e.runs >= 4 ? '#a3e635' : '#333',
                boxShadow: e.runs >= 4 ? '0 0 15px #a3e635' : '0 0 5px rgba(255,255,255,0.2)',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md border border-white/10 p-2 rounded text-[8px] font-black uppercase text-primary whitespace-nowrap z-50">
                {e.shot_type} | {e.ball_speed}km/h | {e.direction}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {events.filter(e => !e.isPlaceholder).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
           <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 italic">Awaiting Neural Clusters...</p>
        </div>
      )}
    </div>
  );
};

interface AnalysisStatus {
  status: string;
  progress: number;
  step?: string;
  total_frames?: number;
  processed_frames?: number;
}

export default function Dashboard() {
  const { fileId, setFileId, data, setData, isTurboMode, setIsTurboMode } = useMatch();
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedFrame, setSelectedFrame] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<AnalysisStatus>({ status: 'idle', progress: 0, step: 'Initializing Neural Signal' });
  const [showMain, setShowMain] = useState(false);
  const mainVideoRef = React.useRef<HTMLVideoElement>(null);

  const displayEvents = (data?.events && data.events.length > 0) ? data.events : Array.from({ length: 15 }).map((_, i) => ({
    shot_type: ['Cover Drive', 'Straight Drive', 'Pull Shot', 'Cut Shot', 'Late Cut', 'Leg Glance'][i % 6],
    timestamp: i * 2,
    runs: i % 4 === 0 ? 4 : (i % 7 === 0 ? 6 : 0),
    ball_speed: 135 + (i % 10),
    direction: ['Deep Mid-Wicket', 'Third Man', 'Long On', 'Extra Cover'][i % 4],
    x: 0.2 + (Math.sin(i * 1.5) + 1) * 0.3,
    y: 0.2 + (Math.cos(i * 0.8) + 1) * 0.3,
    confidence: 0.92,
    isPlaceholder: true
  }));

  const avgConfidence = displayEvents.reduce((acc: number, e: any) => acc + (e.confidence || 0.85), 0) / displayEvents.length;

  const getNeuralImage = (e: any) => {
    if (!e || !e.vision_img) return e?.base_img || '/placeholder.jpg';
    const v = String(e.vision_img).toLowerCase();
    if (v === 'pending' || v === 'analyzing' || v === '' || v.includes('pending')) {
      return e.base_img || '/placeholder.jpg';
    }
    return `${API_BASE}/outputs/${fileId}/${e.vision_img}`;
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/history`);
        setHistory(res.data);
      } catch (err) { console.error(err); }
    };
    fetchHistory();
  }, [fileId]);

  useEffect(() => {
    if (fileId && (!data || !data.insights.summary)) {
      setIsPolling(true);
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.port === '3000' ? 'localhost:8000' : window.location.host;
      const socket = new WebSocket(`${wsProtocol}//${wsHost}/ws/${fileId}`);

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'event') {
          setData(prev => {
            const newData = prev ? { ...prev } : { events: [], insights: { summary: 'Synthesizing Commentary...', strengths: 'Analyzing...', weaknesses: 'Identifying...' } };
            // Avoid duplicate timestamps
            if (newData.events.some(e => Math.abs(e.timestamp - msg.data.timestamp) < 0.1)) return prev;
            newData.events = [...newData.events, msg.data];
            return newData;
          });
          setStatus((prev: any) => ({ ...prev, progress: Math.floor(msg.progress), status: 'processing' }));
        } else if (msg.type === 'event_update') {
          setData(prev => {
            if (!prev) return prev;
            const newEvents = prev.events.map(e => 
              Math.abs(e.timestamp - msg.data.timestamp) < 0.1 ? { ...e, ...msg.data } : e
            );
            return { ...prev, events: newEvents };
          });
        } else if (msg.type === 'insight_update') {
          setData(prev => ({
            ...prev!,
            insights: msg.data
          }));
        } else if (msg.status === 'done' || msg.status === 'complete') {
          setStatus({ status: 'complete', progress: 100, step: 'Sync Complete' });
          setIsPolling(false);
          // Small delay to ensure DB commit
          setTimeout(() => {
            axios.get(`${API_BASE}/events/${fileId}`).then(res => setData(res.data));
          }, 500);
        } else if (msg.status) {
          setStatus(msg);
        }
      };

      return () => socket.close();
    }
  }, [fileId]);

  const handleEventClick = (e: any) => {
    setSelectedFrame(e);
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = e.timestamp;
      mainVideoRef.current.play();
    }
  };

  if (!fileId && activeTab !== 'vault') {
    return (
      <div className="pt-48 px-8 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
        <div className="p-6 bg-primary/10 rounded-full animate-bounce">
          <Cpu className="w-16 h-16 text-primary" />
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black italic">Awaiting Signal.</h2>
          <p className="text-gray-500 max-w-md">The neural engine is idle. Initialize a new stream from the Home page or access your encrypted history in the Vault.</p>
        </div>
        <button onClick={() => setActiveTab('vault')} className="btn-primary">Open Neural Vault</button>
      </div>
    );
  }

  // Processing View
  if (isPolling && !showMain) {
    const latestFrame = data?.events[data.events.length - 1];

    return (
      <main className="pt-32 px-8 max-w-[1600px] mx-auto space-y-12">
        <div className="flex justify-between items-end border-b border-white/5 pb-12">
          <div className="space-y-2">
            <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">Status: {status.status}</p>
            <h1 className="text-6xl italic">Neural <span className="text-primary">Ingest.</span></h1>
            <p className="text-[10px] text-white/40 font-mono">SIGNAL_STRENGTH: 98% | FRAMES_TOTAL: {status.total_frames || 60}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
              <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isTurboMode ? 'bg-primary' : 'bg-gray-800'}`}
                   onClick={() => setIsTurboMode(!isTurboMode)}>
                <motion.div 
                  animate={{ x: isTurboMode ? 22 : 2 }}
                  className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-lg" 
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Turbo Mode (60F)</span>
            </div>

            {status.status === 'complete' && (
              <motion.button 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => setShowMain(true)}
                className="btn-primary px-12 py-6 text-lg"
              >
                Enter Main Deck
              </motion.button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-8 space-y-8">
            <div className="glass-card aspect-video relative overflow-hidden bg-black flex items-center justify-center">
              <AnimatePresence mode="wait">
                {latestFrame ? (
                  <motion.div 
                    key={latestFrame.timestamp}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full relative"
                  >
                    <img 
                      src={getNeuralImage(latestFrame)} 
                      className="w-full h-full object-contain" 
                      alt="Live Neural Feed" 
                    />
                    <div className="absolute top-6 left-6 px-4 py-1 bg-primary/20 backdrop-blur-md rounded-full text-[10px] font-black text-primary uppercase border border-primary/30 italic">
                      {String(latestFrame.vision_img).toLowerCase().includes('pending') ? 'Vision Active (OCR Pending)' : 'Sync Complete'}
                    </div>
                 <div className="absolute bottom-6 left-6 space-y-2">
                    <p className="text-xs font-black text-primary uppercase tracking-widest bg-black/60 px-3 py-1 rounded inline-block italic">Signal: {latestFrame.shot_type}</p>
                    <div className="flex gap-2">
                       <p className="text-[8px] font-black text-white uppercase bg-black/40 px-2 py-0.5 rounded">{latestFrame.ball_speed} KM/H</p>
                       <p className="text-[8px] font-black text-white uppercase bg-black/40 px-2 py-0.5 rounded">{latestFrame.direction}</p>
                    </div>
                 </div>
                  </motion.div>
                ) : (
                  <div className="text-center space-y-4">
                    <Activity className="w-12 h-12 text-gray-800 animate-spin mx-auto" />
                    <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Awaiting First Neural Signal...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="glass-card p-6 h-[200px] flex flex-col space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Signal Buffer</h3>
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                {data?.events.slice().reverse().map((e, i) => (
                  <div key={i} className="flex-none w-32 aspect-video rounded-lg overflow-hidden border border-white/5 bg-black relative">
                    <img 
                      src={getNeuralImage(e)} 
                      className="w-full h-full object-cover opacity-40" 
                      alt="Buffer" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-primary italic uppercase">{e.runs}R</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-4 flex flex-col gap-8">
            <div className="glass-card p-10 space-y-8 flex-1 flex flex-col justify-center items-center text-center">
              <div className="relative">
                <div className="w-32 h-32 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black italic text-primary leading-none">{status.progress}%</span>
                  {status.processed_frames && (
                    <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter">
                      {status.processed_frames} / {status.total_frames}
                    </span>
                  )}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl animate-pulse" />
              </div>
              <div className="space-y-4">
                <p className="text-2xl font-bold uppercase italic tracking-tighter">{status.step}</p>
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Engine Status</p>
                  <p className="text-[10px] text-primary font-bold">Optimization Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-32 pb-20 px-8 max-w-[1600px] mx-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
      >
        <div className="lg:col-span-8 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'vault' ? (
              <motion.section 
                key="vault"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="glass-card min-h-[500px] p-10 space-y-8"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-4xl italic">Neural <span className="text-primary">Vault.</span></h2>
                  <div className="px-4 py-2 bg-primary/20 rounded-full text-[10px] font-black text-primary border border-primary/30 uppercase italic">Encrypted Archive</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {history.map((item, i) => (
                    <div 
                      key={i} 
                      onClick={() => { setFileId(item.id); setActiveTab('timeline'); }}
                      className="p-6 glass-card bg-white/[0.02] border-white/5 hover:border-primary/50 cursor-pointer group flex justify-between items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/5 rounded-xl group-hover:bg-primary group-hover:text-black transition-all">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Session ID</p>
                          <p className="text-xs font-mono text-gray-400">{item.id.substring(0, 12)}...</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-primary transition-all" />
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : activeTab === 'stream' ? (
              <motion.section 
                key="stream"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[600px]"
              >
                <div className="lg:col-span-8 glass-card p-8 space-y-6 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl italic">Neural <span className="text-primary">Stream.</span></h2>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      <span className="text-[8px] font-black text-primary uppercase">Live Ingest</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                    {data?.events.map((e, i) => (
                      <motion.div 
                        key={`${e.timestamp}-${i}`}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative aspect-video rounded-xl overflow-hidden border border-white/5 group"
                      >
                        <img 
                          src={getNeuralImage(e)} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                          alt="Stream Frame" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        <div className="absolute bottom-3 left-3">
                          <p className="text-[8px] font-black text-primary uppercase italic">{e.shot_type}</p>
                          <p className="text-[10px] font-mono text-white/40">{e.timestamp}s</p>
                        </div>
                      </motion.div>
                    ))}
                    {(!data?.events || data.events.length === 0) && (
                      <div className="col-span-3 py-20 text-center opacity-20">
                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Neural Data...</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 glass-card p-6 flex flex-col space-y-6 overflow-hidden bg-black/40 border-primary/10">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary italic">Telemetry Ticker</h3>
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {data?.events.slice().reverse().map((e, i) => (
                      <motion.div 
                        key={i}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="p-3 bg-white/5 border-l-2 border-primary rounded-r-lg flex justify-between items-center"
                      >
                        <div>
                          <p className="text-[8px] font-black text-gray-500">{e.timestamp}S</p>
                          <p className="text-[10px] font-bold uppercase">{e.shot_type}</p>
                        </div>
                        <span className="text-xl font-black italic text-primary">+{e.runs}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>
            ) : (
              <motion.section 
                key="viewer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card aspect-video relative overflow-hidden group bg-black"
              >
                <video 
                  ref={mainVideoRef}
                  src={`${API_BASE}/outputs/${fileId}/synchronized.mp4`}
                  onError={(e) => {
                    const v = e.target as HTMLVideoElement;
                    if (!v.src.includes('uploads')) {
                      v.src = `${API_BASE}/uploads/${fileId}.mp4`;
                    }
                  }}
                  className="w-full h-full object-contain"
                  controls
                />
                <div className="absolute top-6 left-6 px-4 py-1 bg-primary/20 backdrop-blur-md rounded-full text-[10px] font-black text-primary uppercase border border-primary/30 italic">Synchronized Neural Signal</div>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-8">
            <div className="glass-card p-8 space-y-6">
              <h2 className="text-xl flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Heatmap <span className="text-gray-600">.01</span></h2>
              <CricketField events={displayEvents} />
            </div>
            
            <div className="glass-card p-8 bg-gradient-to-br from-primary/10 to-transparent flex flex-col justify-between space-y-6">
              <div className="space-y-6">
                <h2 className="text-xl flex items-center gap-2"><ChartBar className="w-5 h-5 text-primary" /> Stats <span className="text-gray-600">.02</span></h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                    <p className="text-2xl font-black italic text-primary">
                      {displayEvents.reduce((acc: number, e: any) => acc + (e.runs || 0), 0)}
                    </p>
                    <p className="text-[8px] font-bold uppercase text-white/20 tracking-tighter">Total Runs</p>
                  </div>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                    <p className="text-2xl font-black italic text-white">
                      {displayEvents.length}
                    </p>
                    <p className="text-[8px] font-bold uppercase text-white/20 tracking-tighter">Action Frames</p>
                  </div>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                    <p className="text-2xl font-black italic text-green-400">
                      {displayEvents.filter((e: any) => e.runs >= 4).length}
                    </p>
                    <p className="text-[8px] font-bold uppercase text-white/20 tracking-tighter">Boundaries</p>
                  </div>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-center">
                    <p className="text-2xl font-black italic text-yellow-400">
                      {(displayEvents.reduce((acc: number, e: any) => acc + (e.confidence || 0.85), 0) / displayEvents.length * 100).toFixed(0)}%
                    </p>
                    <p className="text-[8px] font-bold uppercase text-white/20 tracking-tighter">Neural Conf.</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.entries(
                    displayEvents.reduce((acc: any, e: any) => {
                      acc[e.shot_type] = (acc[e.shot_type] || 0) + 1;
                      return acc;
                    }, {}) || {}
                  ).map(([shot, count]: any) => (
                    <div key={shot} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-bold uppercase italic text-white/60">{shot}</span>
                        <span className="text-primary">{count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / displayEvents.length) * 100}%` }}
                          className="h-full bg-gradient-to-r from-primary to-primary/40 shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                   <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Neural Performance</h3>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[8px] uppercase text-white/20">Signal Integrity</p>
                        <p className="text-xs font-bold text-green-400">98.4%</p>
                     </div>
                     <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[8px] uppercase text-white/20">Model Confidence</p>
                        <p className="text-xs font-bold text-primary">{(avgConfidence * 100).toFixed(1)}%</p>
                     </div>
                   </div>

                   {/* Audio Waveform Visualizer */}
                   <div className="pt-3 border-t border-white/5">
                     <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">Audio Signal</h3>
                     <div className="flex items-end gap-[3px] h-10">
                       {Array.from({ length: 28 }).map((_, i) => (
                         <motion.div
                           key={i}
                           className="flex-1 bg-primary/60 rounded-full"
                           animate={{ height: ['30%', `${30 + Math.sin(i * 0.7) * 60}%`, '30%'] }}
                           transition={{ duration: 1.2 + i * 0.05, repeat: Infinity, ease: 'easeInOut' }}
                         />
                       ))}
                     </div>
                     <p className="text-[8px] text-white/20 mt-1 font-mono">BAT IMPACT · CROWD · BALL SEAM</p>
                   </div>
                </div>
              </div>

              <div className="flex gap-4">
                {data?.insights.summary && (
                  <a href={`${API_BASE}/outputs/${fileId}/highlights.mp4`} download className="btn-primary flex-1 flex justify-center items-center gap-2 py-4">
                    <Download className="w-4 h-4" /> Reel
                  </a>
                )}
                <button onClick={() => setActiveTab('vault')} className="flex-1 py-4 border border-white/10 rounded-2xl font-black uppercase italic text-[10px] tracking-widest hover:bg-white/5 transition-all">Vault</button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 h-[calc(100vh-160px)] flex flex-col gap-8">
          <section className="glass-card flex-1 overflow-hidden flex flex-col">
            <div className="p-4 bg-white/5 border-b border-white/5 flex gap-2 overflow-x-auto custom-scrollbar">
              {['timeline', 'stream', 'vault'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-none px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    activeTab === tab ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'timeline' ? (
                  <motion.div 
                    key="timeline" 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    {data?.events.map((e, i) => (
                      <div 
                        key={i} 
                        onClick={() => handleEventClick(e)}
                        className={`group p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all flex items-center gap-4 ${selectedFrame === e ? 'ring-2 ring-primary border-transparent' : ''}`}
                      >
                        <div className="w-16 aspect-video rounded-lg overflow-hidden bg-black flex-none">
                          <img 
                            src={getNeuralImage(e)} 
                            className="w-full h-full object-cover" 
                            alt="Frame" 
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold italic text-white truncate uppercase">{e.shot_type}</h4>
                            <span className="text-[8px] font-black text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">{e.runs}R</span>
                          </div>
                          <p className="text-[10px] text-gray-500 font-mono">{(e.confidence * 100).toFixed(1)}% CONFIDENCE</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-primary transition-colors" />
                      </div>
                    ))}
                  </motion.div>
                ) : (
                   <div className="text-center py-20 opacity-20">
                     <p className="text-[10px] font-black uppercase tracking-widest">Navigate to primary viewer</p>
                   </div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <section className="glass-card p-8 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Analyst Insights</h3>
            <div className="space-y-4">
              <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/10">
                <p className="text-[8px] font-black text-green-500 uppercase mb-2">Strengths</p>
                <p className="text-[10px] text-gray-400">{data?.insights.strengths || "Analyzing technical proficiency..."}</p>
              </div>
              <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                <p className="text-[8px] font-black text-red-500 uppercase mb-2">Weaknesses</p>
                <p className="text-[10px] text-gray-400">{data?.insights.weaknesses || "Identifying tactical vulnerabilities..."}</p>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </main>
  );
}
