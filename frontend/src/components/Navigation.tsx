'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cpu } from 'lucide-react';

const Navigation = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Protocol', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Analytics', path: '/analytics' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-3 group">
        <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg shadow-[0_0_20px_rgba(163,230,53,0.3)] group-hover:shadow-[0_0_40px_rgba(163,230,53,0.6)] transition-all">
          <Cpu className="text-black w-6 h-6" />
        </div>
        <span className="text-2xl font-black italic tracking-tighter">CRICLENS.AI</span>
      </Link>
      
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-500 mr-8">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`hover:text-primary transition-colors ${pathname === item.path ? 'text-primary' : ''}`}
            >
              {item.name}
            </Link>
          ))}
        </div>
        <button className="btn-primary py-2 px-6 text-[10px]">Get Started</button>
      </div>
    </nav>
  );
};

export default Navigation;
