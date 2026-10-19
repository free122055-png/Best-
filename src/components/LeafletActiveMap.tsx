import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Compass, Store, ShieldCheck, Search, Users, ExternalLink, Phone } from 'lucide-react';

interface LeafletActiveMapProps {
  mapType: 'world' | 'bangladesh';
  agents: any[];
  highlightedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  zoomLevel: number;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  manualAddress?: string;
}

// District coordinates map for zero-API-key positioning on Bangladesh SVG map
const districtCoordinates: Record<string, { x: number; y: number; bn: string }> = {
  'ঢাকা': { x: 50, y: 52, bn: 'ঢাকা' },
  'চট্টগ্রাম': { x: 74, y: 76, bn: 'চট্টগ্রাম' },
  'সিলেট': { x: 78, y: 35, bn: 'সিলেট' },
  'রাজশাহী': { x: 26, y: 38, bn: 'রাজশাহী' },
  'খুলনা': { x: 32, y: 74, bn: 'খুলনা' },
  'বরিশাল': { x: 52, y: 82, bn: 'বরিশাল' },
  'রংপুর': { x: 25, y: 18, bn: 'রংপুর' },
  'ময়মনসিংহ': { x: 48, y: 32, bn: 'ময়মনসিংহ' },
  'কুমিল্লা': { x: 68, y: 62, bn: 'কুমিল্লা' },
  'বগুড়া': { x: 34, y: 34, bn: 'বগুড়া' },
  'যশোর': { x: 28, y: 70, bn: 'যশোর' },
  'পাবনা': { x: 35, y: 46, bn: 'পাবনা' },
  'সিরাজগঞ্জ': { x: 38, y: 44, bn: 'সিরাজগঞ্জ' },
  'ফরিদপুর': { x: 44, y: 60, bn: 'ফরিদপুর' },
  'গাজীপুর': { x: 52, y: 46, bn: 'গাজীপুর' },
  'নারায়ণগঞ্জ': { x: 54, y: 54, bn: 'নারায়ণগঞ্জ' },
  'কক্সবাজার': { x: 78, y: 92, bn: 'কক্সবাজার' },
  'সিলহেট': { x: 78, y: 35, bn: 'সিলেট' }
};

export default function LeafletActiveMap({
  mapType,
  agents,
  highlightedAgentId,
  onSelectAgent,
  zoomLevel,
  userLocation,
  manualAddress = ''
}: LeafletActiveMapProps) {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [activePinPos, setActivePinPos] = useState({ x: 50, y: 52, label: 'আপনার দোকান / কোম্পানির লোকেশন' });

  // Update position based on manual address text or district matching
  useEffect(() => {
    if (manualAddress && manualAddress.trim().length > 0) {
      const lowerAddr = manualAddress.toLowerCase();
      let foundKey = Object.keys(districtCoordinates).find(k => lowerAddr.includes(k));
      if (foundKey) {
        const coord = districtCoordinates[foundKey];
        setActivePinPos({
          x: coord.x + (Math.random() * 4 - 2),
          y: coord.y + (Math.random() * 4 - 2),
          label: manualAddress
        });
      } else {
        // Default custom offset if address doesn't match standard district name
        setActivePinPos({
          x: 52 + (Math.sin(manualAddress.length) * 12),
          y: 50 + (Math.cos(manualAddress.length) * 10),
          label: manualAddress
        });
      }
    }
  }, [manualAddress]);

  const visibleAgents = agents.filter(a => {
    if (mapType === 'bangladesh') {
      return a.country && a.country.toLowerCase() === 'bangladesh';
    }
    return true;
  });

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-slate-900 via-teal-950 to-slate-950 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center p-3 select-none font-sans">
      {/* Background Decorative Radar Waves & Grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-teal-500/30 animate-ping" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-teal-400/40"></div>
      </div>

      {/* Top Map Status Banner */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between bg-slate-900/80 backdrop-blur-md border border-teal-500/30 px-3 py-2 rounded-xl text-white shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-[11px] font-black tracking-tight text-teal-300">
            {manualAddress ? '📍 ম্যানুয়াল শপ লোকেশন সক্রিয়' : 'জিপিএস ও ম্যানুয়াল ম্যাপ (API-Key-Free)'}
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-300 bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-800/50">
          {mapType === 'bangladesh' ? 'বাংলাদেশ নেটওয়ার্ক' : 'গ্লোবাল নেটওয়ার্ক'}
        </span>
      </div>

      {/* Interactive SVG Map Canvas */}
      <div className="relative w-full h-[280px] sm:h-[340px] flex items-center justify-center my-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl overflow-visible">
          {/* Stylized Bangladesh Map Path / Region Base */}
          <path
            d="M 35,15 Q 50,10 65,20 Q 80,25 85,40 Q 90,60 75,75 Q 60,90 45,85 Q 25,80 20,60 Q 15,40 35,15 Z"
            fill="#0f292a"
            stroke="#14b8a6"
            strokeWidth="0.8"
            strokeDasharray="2,2"
            className="opacity-70"
          />

          {/* District Pins & Connections */}
          {Object.entries(districtCoordinates).map(([name, coord]) => (
            <g key={name} className="cursor-pointer group">
              <circle cx={coord.x} cy={coord.y} r="1.2" fill="#2dd4bf" className="animate-pulse" />
              <text x={coord.x} y={coord.y - 2.5} fontSize="3" fill="#99f6e4" fontWeight="bold" textAnchor="middle" className="select-none opacity-80 group-hover:opacity-100">
                {coord.bn}
              </text>
            </g>
          ))}

          {/* Render Active Manual Shop Location Pin */}
          <g className="transition-all duration-500 cursor-pointer" transform={`translate(${activePinPos.x}, ${activePinPos.y})`}>
            <circle cx="0" cy="0" r="8" fill="#14b8a6" className="opacity-30 animate-ping" style={{ animationDuration: '2s' }} />
            <circle cx="0" cy="0" r="4" fill="#0d9488" stroke="#ffffff" strokeWidth="1" />
            <path d="M 0,0 L 0,-8" stroke="#ffffff" strokeWidth="1" />
            <circle cx="0" cy="-8" r="2.5" fill="#f43f5e" />
            
            {/* Floating Label */}
            <foreignObject x="-30" y="-22" width="60" height="14">
              <div className="bg-emerald-600 text-white text-[5px] font-black px-1.5 py-0.5 rounded text-center shadow-md truncate border border-emerald-400">
                শপ লোকেশন
              </div>
            </foreignObject>
          </g>

          {/* Render Agents */}
          {visibleAgents.slice(0, 12).map((agent, idx) => {
            const posX = 20 + (idx * 7) % 65;
            const posY = 20 + ((idx * 13) % 60);
            const isSelected = highlightedAgentId === agent.id;

            return (
              <g 
                key={agent.id || idx}
                onClick={() => onSelectAgent(agent.id)}
                className="cursor-pointer group transition-transform"
                transform={`translate(${posX}, ${posY})`}
              >
                <circle cx="0" cy="0" r={isSelected ? "5" : "3"} fill={isSelected ? "#f59e0b" : "#06b6d4"} className="transition-all group-hover:scale-125" />
                <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
                <foreignObject x="-18" y="-14" width="36" height="10">
                  <div className="bg-slate-900/95 text-teal-300 text-[4.5px] font-extrabold px-1 py-0.5 rounded text-center border border-teal-500/40 truncate shadow">
                    {agent.name.split(' ')[0]}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Interactive Address Card */}
      <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-900/90 backdrop-blur-md border border-teal-500/40 p-3 rounded-2xl text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-teal-600/30 border border-teal-400/50 flex items-center justify-center text-teal-300 shrink-0">
            <Store className="w-5 h-5 text-teal-400" />
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-[10px] font-bold text-teal-300 uppercase tracking-tight">আপনার টাইপকৃত ম্যানুয়াল ঠিকানাঃ</p>
            <p className="text-xs font-black text-white truncate font-sans">
              {manualAddress || 'ফরমের উপরে আপনার দোকানের ঠিকানা বা এরিয়া লিখুন...'}
            </p>
          </div>
        </div>
        <div className="shrink-0 bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-xl">
          ✓ লাইভ আপডেট
        </div>
      </div>
    </div>
  );
}
