import React, { useEffect, useRef, useState } from 'react';
import {
  formatDistance,
  formatRelativeTime,
  getOnlinePresenceStatus,
  toBanglaDigits
} from '../lib/locationService';

interface Agent {
  id: string;
  name: string;
  role: string;
  country: string;
  flag: string;
  city: string;
  phone: string;
  lat: number;
  lng: number;
  realLat?: number;
  realLng?: number;
  accuracy?: number;
  lastUpdatedTs?: number;
  lastSeen?: string;
  isOnline?: boolean;
  img: string;
  district?: string;
  thana?: string;
  postOffice?: string;
  distanceKm?: number;
  shopMapLink?: string;
  whatsapp?: string;
}

interface LeafletActiveMapProps {
  mapType: 'world' | 'bangladesh';
  agents: any[];
  highlightedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  zoomLevel: number;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
}

const getAgentLatLng = (agent: any): { lat: number; lng: number } => {
  if (typeof agent.realLat === 'number' && typeof agent.realLng === 'number' && agent.realLat !== 0 && agent.realLng !== 0) {
    return { lat: agent.realLat, lng: agent.realLng };
  }
  if (typeof agent.lat === 'number' && typeof agent.lng === 'number' && agent.lat !== 0 && agent.lng !== 0) {
    return { lat: agent.lat, lng: agent.lng };
  }
  return { lat: 23.8103, lng: 90.4125 };
};

export default function LeafletActiveMap({
  mapType,
  agents,
  highlightedAgentId,
  onSelectAgent,
  zoomLevel,
  userLocation
}: LeafletActiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // 1. Load Leaflet CSS and JS Dynamically
  useEffect(() => {
    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js-cdn')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js-cdn';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      if (typeof window !== 'undefined' && (window as any).L) {
        setLeafletLoaded(true);
      } else {
        const interval = setInterval(() => {
          if ((window as any).L) {
            setLeafletLoaded(true);
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, []);

  // 2. Setup Map Instance
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const centerWorld = [24.0, 50.0];
    const centerBD = [23.85, 90.35];

    const targetCenter = mapType === 'world' ? centerWorld : centerBD;
    const targetZoom = mapType === 'world' ? (zoomLevel > 1 ? 3.5 : 2.2) : (zoomLevel > 1 ? 9 : 7.2);

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        maxZoom: 19,
        minZoom: 2,
      }).setView(targetCenter, targetZoom);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: 1.2
      });
    }
  }, [leafletLoaded, mapType, zoomLevel]);

  // 3. Draw High Precision Agent & User Markers
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear old markers
    Object.keys(markersRef.current).forEach((key) => {
      mapInstanceRef.current.removeLayer(markersRef.current[key]);
    });
    markersRef.current = {};

    // Draw User Location Marker
    if (userLocation && userLocation.lat && userLocation.lng) {
      const accText = userLocation.accuracy ? `± ${toBanglaDigits(userLocation.accuracy.toFixed(0))} মিটার` : 'GPS সক্রিয়';
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        html: `
          <div class="relative w-10 h-10 flex items-center justify-center cursor-pointer">
            <div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping" style="animation-duration: 2s"></div>
            <div class="relative w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
              <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
            </div>
          </div>
        `
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(mapInstanceRef.current);

      userMarker.bindPopup(`
        <div class="font-sans text-xs p-1.5 text-slate-800 font-extrabold text-center">
          <p class="text-blue-600 font-black text-xs mb-0.5">📍 আপনার অবস্থান</p>
          <p class="text-[9px] text-slate-500 font-mono">${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}</p>
          <p class="text-[9px] text-emerald-600 font-bold mt-0.5">নির্ভুলতা: ${accText}</p>
        </div>
      `, { closeButton: false });

      markersRef.current['_user_location_'] = userMarker;
    }

    // Filter agents shown based on mapType
    const visibleAgents = agents.filter((agent) => {
      if (mapType === 'bangladesh') {
        return agent.country && agent.country.toLowerCase() === 'bangladesh';
      }
      return true;
    });

    // Draw Agent Markers
    visibleAgents.forEach((agent) => {
      const pos = getAgentLatLng(agent);
      const isHighlighted = highlightedAgentId === agent.id;

      const lastTs = agent.lastUpdatedTs || (agent.lastSeen ? Date.now() : 0);
      const presence = getOnlinePresenceStatus(lastTs, 'bn');

      let statusDotBg = 'bg-emerald-500';
      let ringBorder = 'border-emerald-500';
      if (presence.status === 'recent') {
        statusDotBg = 'bg-amber-500';
        ringBorder = 'border-amber-500';
      } else if (presence.status === 'offline') {
        statusDotBg = 'bg-slate-400';
        ringBorder = 'border-slate-300';
      }

      const customIcon = L.divIcon({
        className: 'custom-leaflet-agent-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: `
          <div class="relative w-11 h-11 flex items-center justify-center cursor-pointer">
            ${
              presence.status === 'active'
                ? '<div class="absolute -inset-1.5 rounded-full bg-emerald-500/35 animate-ping" style="animation-duration: 2s"></div>'
                : ''
            }
            <div class="relative rounded-full bg-white border-2 ${ringBorder} shadow-md flex items-center justify-center overflow-hidden transition-all duration-300 ${
              isHighlighted ? 'ring-4 ring-emerald-500 scale-125 z-30' : 'hover:scale-110'
            }" style="width: 38px; height: 38px;">
              <img src="${agent.img}" style="width: 100%; height: 100%; object-fit: cover;" referrerPolicy="no-referrer" />
              <span class="absolute right-0.5 bottom-0.5 w-2.5 h-2.5 rounded-full border border-white ${statusDotBg} shadow-xs"></span>
            </div>
          </div>
        `
      });

      const marker = L.marker([pos.lat, pos.lng], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .on('click', () => {
          onSelectAgent(agent.id);
          mapInstanceRef.current.flyTo([pos.lat, pos.lng], mapType === 'world' ? 11 : 13, {
            animate: true,
            duration: 1.0
          });
        });

      const formattedDist =
        typeof agent.distanceKm === 'number'
          ? formatDistance(agent.distanceKm, 'bn')
          : null;

      const relativeTime = lastTs ? formatRelativeTime(lastTs, 'bn') : (agent.lastSeen || 'অজানা');
      const accVal = agent.accuracy ? `± ${toBanglaDigits(agent.accuracy.toFixed(0))} মি.` : null;

      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}`;

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 4px; min-width: 180px; color: #1e293b;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <img src="${agent.img}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid #0d9488;" />
            <div>
              <div style="font-weight: 900; color: #0f172a; font-size: 12px; line-height: 1.2;">${agent.name}</div>
              <div style="font-size: 9.5px; font-weight: 700; color: #0d9488;">${agent.role || 'অফিসিয়াল এজেন্ট'}</div>
            </div>
          </div>

          <div style="display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 8.5px; font-weight: 800; margin-bottom: 6px;" class="${presence.badgeClass}">
            ${presence.label} (${relativeTime})
          </div>

          ${
            formattedDist
              ? `
            <div style="margin-bottom: 5px; padding: 4px 6px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 9px; font-weight: 800; color: #166534; display: flex; justify-content: space-between; align-items: center;">
              <span>📏 আপনার থেকে দূরত্বঃ</span>
              <span style="font-size: 10px; font-weight: 900; color: #15803d;">${formattedDist}</span>
            </div>
          `
              : ''
          }

          <div style="font-size: 9.5px; color: #475569; margin-bottom: 4px; line-height: 1.3;">
            <p style="margin: 0;">📍 ${agent.city}${agent.district ? `, ${agent.district}` : ''}</p>
            <p style="margin: 0; font-family: monospace; color: #64748b; font-size: 8.5px;">GPS: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</p>
            ${accVal ? `<p style="margin: 0; color: #059669; font-size: 8.5px; font-weight: 700;">GPS নির্ভুলতা: ${accVal}</p>` : ''}
          </div>

          <div style="display: flex; gap: 4px; margin-top: 6px;">
            <a href="${directionsUrl}" target="_blank" rel="noreferrer" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 2px; background-color: #0d9488; color: white; padding: 5px 6px; border-radius: 6px; font-size: 9px; font-weight: 800; text-decoration: none; text-align: center;">
              🗺️ ডিরেকশন
            </a>
            ${
              agent.phone
                ? `
              <a href="tel:${agent.phone}" style="display: flex; align-items: center; justify-content: center; background-color: #0284c7; color: white; padding: 5px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; text-decoration: none;">
                📞 কল
              </a>
            `
                : ''
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: false,
        offset: [0, -10]
      });

      if (isHighlighted) {
        marker.openPopup();
      }

      markersRef.current[agent.id] = marker;
    });

    if (highlightedAgentId) {
      const selectedAgent = agents.find((a) => a.id === highlightedAgentId);
      if (selectedAgent) {
        const pos = getAgentLatLng(selectedAgent);
        mapInstanceRef.current.flyTo([pos.lat, pos.lng], mapType === 'world' ? 11 : 13, {
          animate: true,
          duration: 1.2
        });
        setTimeout(() => {
          if (markersRef.current[selectedAgent.id]) {
            markersRef.current[selectedAgent.id].openPopup();
          }
        }, 1200);
      }
    }
  }, [leafletLoaded, mapType, highlightedAgentId, agents, userLocation]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-[#E8F0F2]">
      {!leafletLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white z-20 space-y-3 font-sans">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 animate-pulse">উচ্চ-নির্ভুল জিপিএস ম্যাপ লোড হচ্ছে...</p>
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', outline: 'none' }}
        className="z-10"
      />
    </div>
  );
}
