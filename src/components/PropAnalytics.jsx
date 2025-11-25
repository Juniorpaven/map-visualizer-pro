import React, { useState, useEffect, useRef } from 'react';
import { Map as MapIcon, Share2, Download, LayoutDashboard, User, MapPin, Navigation, Coffee } from 'lucide-react';
import Sidebar from './Sidebar';
import MapComponent from './MapComponent';
import ExportOverlay from './ExportOverlay';
import html2canvas from 'html2canvas';

export default function PropAnalytics() {
    // --- STATE ---
    // 1. Agent Info
    const [agent, setAgent] = useState(() => {
        const saved = localStorage.getItem('pa_agent');
        return saved ? JSON.parse(saved) : { name: '', phone: '', logo: null };
    });

    // 2. Property (Target)
    const [property, setProperty] = useState(null); // { lat, lon, address }

    // 3. Client Destinations (Routes)
    const [destinations, setDestinations] = useState([]); // [{ id, name, lat, lon, path, distance, duration, color }]

    // 4. Amenities
    const [amenities, setAmenities] = useState({
        school: { active: false, data: [] },
        hospital: { active: false, data: [] },
        market: { active: false, data: [] },
        park: { active: false, data: [] },
    });

    // 5. UI State
    const [activeTab, setActiveTab] = useState('agent');
    const [isExporting, setIsExporting] = useState(false);
    const exportRef = useRef(null);

    // --- EFFECTS ---
    useEffect(() => {
        localStorage.setItem('pa_agent', JSON.stringify(agent));
    }, [agent]);

    // --- ACTIONS ---
    const handleExport = async () => {
        if (!property) {
            alert("Vui lòng chọn vị trí Bất động sản trước khi xuất ảnh.");
            return;
        }
        setIsExporting(true);
        // Wait for render
        setTimeout(async () => {
            if (exportRef.current) {
                try {
                    const canvas = await html2canvas(exportRef.current, {
                        useCORS: true,
                        scale: 2, // High res
                        logging: false,
                        allowTaint: true,
                        backgroundColor: '#ffffff'
                    });

                    const link = document.createElement('a');
                    link.download = `PropAnalytics-${property.lat}-${property.lon}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                } catch (err) {
                    console.error("Export failed:", err);
                    alert("Lỗi khi xuất ảnh. Vui lòng thử lại.");
                }
                setIsExporting(false);
            }
        }, 1000); // Wait for map tiles to settle (simple hack)
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-slate-800">

            {/* Sidebar */}
            <div className="w-full md:w-[400px] flex-shrink-0 bg-white border-r border-gray-200 z-20 shadow-xl flex flex-col h-full">
                <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-brand-dark text-white">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <MapIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">PROP-ANALYTICS</h1>
                        <p className="text-xs text-blue-200">Real Estate Intelligence</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    {[
                        { id: 'agent', icon: User, label: 'Agent' },
                        { id: 'property', icon: MapPin, label: 'Property' },
                        { id: 'routes', icon: Navigation, label: 'Routes' },
                        { id: 'amenities', icon: Coffee, label: 'Amenities' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-wider transition-colors
                ${activeTab === tab.id
                                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <Sidebar
                        activeTab={activeTab}
                        agent={agent} setAgent={setAgent}
                        property={property} setProperty={setProperty}
                        destinations={destinations} setDestinations={setDestinations}
                        amenities={amenities} setAmenities={setAmenities}
                    />
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="w-full py-3 bg-brand-dark text-white rounded-lg shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2 font-semibold transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isExporting ? (
                            <span className="animate-pulse">Generating Image...</span>
                        ) : (
                            <>
                                <Download className="w-5 h-5" /> Export Map Image
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Map Area */}
            <div className="flex-1 relative bg-gray-200">
                <MapComponent
                    property={property}
                    destinations={destinations}
                    amenities={amenities}
                    onMapClick={(coords) => {
                        // If in property mode, set property
                        if (activeTab === 'property') {
                            setProperty({ lat: coords.lat, lon: coords.lng });
                        }
                    }}
                />

                {/* Export Overlay (Hidden usually, visible during export) */}
                {isExporting && (
                    <div className="fixed inset-0 z-[9999] bg-gray-900/90 flex items-center justify-center">
                        <div ref={exportRef} className="w-[1200px] h-[800px] bg-white relative shadow-2xl overflow-hidden">
                            <ExportOverlay
                                agent={agent}
                                property={property}
                                destinations={destinations}
                                amenities={amenities}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
