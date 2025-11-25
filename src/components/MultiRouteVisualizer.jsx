import React, { useState, useEffect, useRef } from 'react';
import {
    Trash2, Plus, Map as MapIcon, Navigation, Target,
    Loader2, Clipboard, ArrowDown, RotateCcw, Copy, Check,
    Circle as CircleIcon, FileUp, Layers, MousePointer2,
    Search, MapPin
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import JSZip from 'jszip';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MultiRouteVisualizer() {
    // --- STATE QUẢN LÝ DỮ LIỆU ---
    const [routes, setRoutes] = useState([]);
    const [circles, setCircles] = useState([]);
    const [importedLayers, setImportedLayers] = useState([]);

    // --- STATE UI & FORM ---
    const [activeTab, setActiveTab] = useState('route');

    // Form Đường
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3B82F6');
    const [startLat, setStartLat] = useState('10.771414111523464');
    const [startLon, setStartLon] = useState('106.69337060872975');
    const [endLat, setEndLat] = useState('10.7745');
    const [endLon, setEndLon] = useState('106.7020');

    // Form Bán kính
    const [circleLat, setCircleLat] = useState('');
    const [circleLon, setCircleLon] = useState('');
    const [radiusKm, setRadiusKm] = useState(1);
    const [circleColor, setCircleColor] = useState('#EF4444');

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // System State
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState(false);

    const [isMapReady, setIsMapReady] = useState(true);
    const [isZipReady, setIsZipReady] = useState(true);

    const [mapZoom, setMapZoom] = useState(13);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);

    // 2. Khởi tạo Map
    useEffect(() => {
        if (isMapReady && !mapInstanceRef.current && mapRef.current) {
            const map = L.map(mapRef.current).setView([10.7769, 106.7009], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            map.getContainer().addEventListener('contextmenu', (e) => e.preventDefault());
            map.on('contextmenu', (e) => {
                setContextMenu({
                    x: e.originalEvent.pageX,
                    y: e.originalEvent.pageY,
                    lat: e.latlng.lat,
                    lon: e.latlng.lng
                });
                setCopyFeedback(false);
            });

            map.on('click', () => {
                setContextMenu(null);
                setSearchResults([]); // Close search results on map click
            });
            map.on('movestart', () => setContextMenu(null));

            map.on('zoomend', () => {
                setMapZoom(map.getZoom());
            });

            layerGroupRef.current = L.layerGroup().addTo(map);
            mapInstanceRef.current = map;
        }
    }, [isMapReady]);

    // 3. RENDER LỚP BẢN ĐỒ
    useEffect(() => {
        if (!mapInstanceRef.current || !layerGroupRef.current) return;

        const map = mapInstanceRef.current;
        const layerGroup = layerGroupRef.current;

        layerGroup.clearLayers();
        const allBounds = [];

        // A. VẼ ĐƯỜNG
        routes.forEach((route, index) => {
            L.polyline(route.path, {
                color: route.color,
                weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round'
            })
                .bindPopup(`
        <div class="text-center font-sans">
          <b class="text-blue-600">${route.name}</b><br/>
          <span class="text-gray-500 text-xs">Dài: ${(route.distance / 1000).toFixed(2)} km</span>
        </div>
      `)
                .addTo(layerGroup);

            const startIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${route.color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: bold;">${index + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            L.marker(route.start, { icon: startIcon }).addTo(layerGroup);

            const endIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${route.color}; width: 10px; height: 10px; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            });
            L.marker(route.end, { icon: endIcon }).addTo(layerGroup);

            route.path.forEach(p => allBounds.push(p));
        });

        // B. VẼ VÒNG TRÒN
        circles.forEach(circle => {
            const radiusMeters = circle.radius * 1000;

            L.circle(circle.center, {
                color: circle.color,
                fill: false,
                weight: 2,
                radius: radiusMeters
            })
                .addTo(layerGroup);

            const centerLatLng = L.latLng(circle.center);
            const northLatLng = L.latLng([circle.center[0] + (circle.radius / 111.32), circle.center[1]]);

            const centerPoint = map.latLngToLayerPoint(centerLatLng);
            const northPoint = map.latLngToLayerPoint(northLatLng);

            const rPx = Math.abs(centerPoint.y - northPoint.y);
            const diameter = rPx * 2;

            const fontSize = Math.max(14, Math.min(40, 12 + rPx / 15));

            const svgIcon = L.divIcon({
                className: 'radius-text-path',
                html: `
          <svg width="${diameter + 100}" height="${diameter + 100}" viewBox="-50 -50 ${diameter + 100} ${diameter + 100}" style="pointer-events: none; overflow: visible;">
            <defs>
              <path id="circlePath-${circle.id}" d="
                M 0, ${rPx}
                a ${rPx},${rPx} 0 1,1 ${diameter},0
                a ${rPx},${rPx} 0 1,1 -${diameter},0
              " />
            </defs>
            <text fill="${circle.color}" font-weight="bold" font-size="${fontSize}px" font-family="Arial, sans-serif" style="text-shadow: 0 0 4px white;">
              <textPath xlink:href="#circlePath-${circle.id}" startOffset="50%" text-anchor="middle" side="right">
                ${circle.radius} km
              </textPath>
            </text>
          </svg>
        `,
                iconSize: [diameter + 100, diameter + 100],
                iconAnchor: [(diameter + 100) / 2, (diameter + 100) / 2]
            });

            L.marker(circle.center, {
                icon: svgIcon,
                interactive: false,
                zIndexOffset: 100
            }).addTo(layerGroup);

            L.circleMarker(circle.center, {
                radius: 3,
                color: circle.color,
                fillColor: 'white',
                fillOpacity: 1,
                weight: 2
            }).addTo(layerGroup);

            allBounds.push(circle.center);
        });

        // C. VẼ FILE IMPORT
        importedLayers.forEach(layer => {
            layer.data.forEach(item => {
                if (item.type === 'LineString') {
                    L.polyline(item.coordinates, { color: '#8B5CF6', weight: 4, dashArray: '5, 10' })
                        .bindPopup(`<b class="text-purple-600">Imported Path</b><br/><span class="text-xs">${layer.fileName}</span>`)
                        .addTo(layerGroup);
                    item.coordinates.forEach(p => allBounds.push(p));
                } else if (item.type === 'Point') {
                    L.circleMarker(item.coordinates, { radius: 6, color: '#8B5CF6', fillColor: '#fff', fillOpacity: 1 })
                        .bindPopup(`<b class="text-purple-600">Imported Point</b><br/><span class="text-xs">${layer.fileName}</span>`)
                        .addTo(layerGroup);
                    allBounds.push(item.coordinates);
                }
            });
        });

    }, [routes, circles, importedLayers, isMapReady, mapZoom]);

    // --- LOGIC: Context Menu ---
    const handleSetStartFromMenu = () => {
        if (contextMenu) {
            setStartLat(contextMenu.lat.toString());
            setStartLon(contextMenu.lon.toString());
            setActiveTab('route');
            setContextMenu(null);
        }
    };
    const handleSetEndFromMenu = () => {
        if (contextMenu) {
            setEndLat(contextMenu.lat.toString());
            setEndLon(contextMenu.lon.toString());
            setActiveTab('route');
            setContextMenu(null);
        }
    };
    const handleAddCircleFromMenu = () => {
        if (contextMenu) {
            setCircleLat(contextMenu.lat.toString());
            setCircleLon(contextMenu.lon.toString());
            setActiveTab('circle');
            setContextMenu(null);
        }
    };
    const handleCopyCoords = () => {
        if (contextMenu) {
            navigator.clipboard.writeText(`${contextMenu.lat}, ${contextMenu.lon}`);
            setCopyFeedback(true);
            setTimeout(() => setContextMenu(null), 600);
        }
    };

    // --- LOGIC: Search ---
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        setIsSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            setSearchResults(data);
        } catch (err) {
            console.error("Search error", err);
        }
        setIsSearching(false);
    };

    const handleSelectLocation = (item) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lon], 16);
            L.popup()
                .setLatLng([lat, lon])
                .setContent(`<div class="font-sans text-sm"><b>${item.display_name.split(',')[0]}</b><br/><span class="text-xs text-gray-500">${item.display_name}</span></div>`)
                .openOn(mapInstanceRef.current);
        }
        setSearchResults([]);
        setSearchQuery(item.display_name);
    };

    // --- LOGIC: Routes ---
    const fetchRouteGeometry = async (startCoords, endCoords) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.code === 'Ok' && data.routes?.[0]) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                return { path: coords, distance: data.routes[0].distance };
            }
        } catch (e) { }
        return { path: [startCoords, endCoords], distance: 0 };
    };

    const handleAddRoute = async (e) => {
        e.preventDefault();
        if (!startLat || !endLat) return;
        setIsLoading(true);
        const s = [parseFloat(startLat), parseFloat(startLon)];
        const eC = [parseFloat(endLat), parseFloat(endLon)];
        const data = await fetchRouteGeometry(s, eC);

        setRoutes([...routes, {
            id: Date.now(), name: name || `Đoạn ${routes.length + 1}`, color,
            start: s, end: eC, path: data.path, distance: data.distance
        }]);
        setColor('#' + Math.floor(Math.random() * 16777215).toString(16));
        setIsLoading(false);
    };

    // --- LOGIC: Circles ---
    const handleAddCircle = (e) => {
        e.preventDefault();
        if (!circleLat || !circleLon) return;
        setCircles([...circles, {
            id: Date.now(),
            center: [parseFloat(circleLat), parseFloat(circleLon)],
            radius: parseFloat(radiusKm),
            color: circleColor
        }]);
        setCircleColor('#' + Math.floor(Math.random() * 16777215).toString(16));
    };

    // --- LOGIC: KMZ/KML Import ---
    const parseKMLCoords = (xmlDoc) => {
        const result = [];
        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const lineString = pm.getElementsByTagName("LineString")[0];
            if (lineString) {
                const coordsText = lineString.getElementsByTagName("coordinates")[0]?.textContent;
                if (coordsText) {
                    const coords = coordsText.trim().split(/\s+/).map(pair => {
                        const [lon, lat] = pair.split(',');
                        return [parseFloat(lat), parseFloat(lon)];
                    });
                    result.push({ type: 'LineString', coordinates: coords });
                }
            }
            const point = pm.getElementsByTagName("Point")[0];
            if (point) {
                const coordsText = point.getElementsByTagName("coordinates")[0]?.textContent;
                if (coordsText) {
                    const [lon, lat] = coordsText.trim().split(',');
                    result.push({ type: 'Point', coordinates: [parseFloat(lat), parseFloat(lon)] });
                }
            }
        }
        return result;
    };

    const handleImportKMZ = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessingFile(true);
        try {
            let kmlText = "";
            if (file.name.endsWith('.kmz')) {
                const zip = new JSZip();
                const content = await zip.loadAsync(file);
                const kmlFileName = Object.keys(content.files).find(n => n.endsWith('.kml'));
                if (kmlFileName) {
                    kmlText = await content.file(kmlFileName).async("string");
                }
            } else if (file.name.endsWith('.kml')) {
                kmlText = await file.text();
            }

            if (kmlText) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(kmlText, "text/xml");
                const features = parseKMLCoords(xmlDoc);

                if (features.length > 0) {
                    setImportedLayers([...importedLayers, {
                        id: Date.now(),
                        fileName: file.name,
                        data: features
                    }]);
                } else {
                    alert("Không tìm thấy dữ liệu đường đi/điểm hợp lệ trong file này.");
                }
            }
        } catch (err) {
            console.error(err);
            alert("Lỗi khi đọc file. Đảm bảo file đúng định dạng KMZ/KML.");
        }
        setIsProcessingFile(false);
        e.target.value = null;
    };

    const handleSmartPaste = (e, setLat, setLon) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        if (text.includes(',')) {
            const [lat, lon] = text.split(',');
            if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) {
                setLat(lat.trim()); setLon(lon.trim());
            }
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 text-slate-800 font-sans relative" onClick={() => contextMenu && setContextMenu(null)}>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-56 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-[10px] text-gray-500 font-mono">
                        {contextMenu.lat.toFixed(5)}, {contextMenu.lon.toFixed(5)}
                    </div>
                    <button onClick={handleSetStartFromMenu} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"><Navigation className="w-4 h-4" /> Đặt điểm Bắt đầu</button>
                    <button onClick={handleSetEndFromMenu} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"><Target className="w-4 h-4" /> Đặt điểm Kết thúc</button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button onClick={handleCopyCoords} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                        {copyFeedback ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copyFeedback ? 'Đã copy!' : 'Copy tọa độ'}
                    </button>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 gap-6">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <MapIcon className="w-6 h-6 text-blue-600" />
                    <h1 className="text-xl font-bold text-gray-800 tracking-tight hidden md:block">Map Visualizer Pro</h1>
                </div>

                {/* SEARCH BAR */}
                <div className="flex-1 max-w-xl relative">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm địa điểm (Nominatim)..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-gray-50 focus:bg-white transition-colors"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        {isSearching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-blue-500" />}
                    </form>

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 max-h-96 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.map((item) => (
                                <div
                                    key={item.place_id}
                                    onClick={() => handleSelectLocation(item)}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 text-sm text-gray-700 flex items-start gap-3 transition-colors"
                                >
                                    <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{item.display_name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-4 text-sm font-medium text-gray-500 flex-shrink-0 hidden md:flex">
                    <span>Routes: <b className="text-blue-600">{routes.length}</b></span>
                    <span>Circles: <b className="text-red-500">{circles.length}</b></span>
                    <span>Files: <b className="text-purple-600">{importedLayers.length}</b></span>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* Sidebar */}
                <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg z-20 h-full overflow-hidden">

                    {/* Tabs Navigation */}
                    <div className="flex border-b border-gray-200">
                        <button onClick={() => setActiveTab('route')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'route' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Navigation className="w-4 h-4" /> Đường đi
                        </button>
                        <button onClick={() => setActiveTab('circle')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'circle' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <CircleIcon className="w-4 h-4" /> Bán kính
                        </button>
                        <button onClick={() => setActiveTab('file')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'file' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <FileUp className="w-4 h-4" /> KMZ
                        </button>
                    </div>

                    <div className="p-5 border-b border-gray-200 overflow-y-auto flex-1 custom-scrollbar">

                        {/* TAB: ROUTE */}
                        {activeTab === 'route' && (
                            <form onSubmit={handleAddRoute} className="space-y-4">
                                <div className="flex gap-2 mb-2">
                                    <button type="button" onClick={() => { if (routes.length) { setStartLat(routes[routes.length - 1].end[0]); setStartLon(routes[routes.length - 1].end[1]); setEndLat(''); setEndLon(''); setColor('#' + Math.floor(Math.random() * 16777215).toString(16)); } }} disabled={!routes.length} className="flex-1 text-xs py-2 bg-blue-50 text-blue-700 rounded border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 font-medium"><ArrowDown className="w-3 h-3" /> Nối tiếp</button>
                                    <button type="button" onClick={() => { setStartLat(''); setStartLon(''); setEndLat(''); setEndLon(''); setName(''); }} className="px-3 bg-gray-100 rounded border border-gray-200 text-gray-600 hover:bg-gray-200 transition-colors"><RotateCcw className="w-3 h-3" /></button>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-700 block mb-1">Tên đoạn đường</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm" placeholder="VD: Đường Nguyễn Huệ" />
                                </div>

                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <label className="text-xs font-bold text-green-800 flex justify-between items-center mb-1">
                                        Điểm Bắt đầu
                                        <span className="font-normal bg-white px-1.5 py-0.5 rounded text-[10px] text-green-600 border border-green-100 shadow-sm">Paste Lat,Lon</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input value={startLat} onChange={e => setStartLat(e.target.value)} onPaste={e => handleSmartPaste(e, setStartLat, setStartLon)} className="w-1/2 px-2 py-1.5 text-sm border border-green-200 rounded bg-white focus:ring-1 focus:ring-green-500 outline-none" placeholder="Lat" required />
                                        <input value={startLon} onChange={e => setStartLon(e.target.value)} onPaste={e => handleSmartPaste(e, setStartLat, setStartLon)} className="w-1/2 px-2 py-1.5 text-sm border border-green-200 rounded bg-white focus:ring-1 focus:ring-green-500 outline-none" placeholder="Lon" required />
                                    </div>
                                </div>

                                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                    <label className="text-xs font-bold text-red-800 flex justify-between items-center mb-1">
                                        Điểm Kết thúc
                                        <span className="font-normal bg-white px-1.5 py-0.5 rounded text-[10px] text-red-600 border border-red-100 shadow-sm">Paste Lat,Lon</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input value={endLat} onChange={e => setEndLat(e.target.value)} onPaste={e => handleSmartPaste(e, setEndLat, setEndLon)} className="w-1/2 px-2 py-1.5 text-sm border border-red-200 rounded bg-white focus:ring-1 focus:ring-red-500 outline-none" placeholder="Lat" required />
                                        <input value={endLon} onChange={e => setEndLon(e.target.value)} onPaste={e => handleSmartPaste(e, setEndLat, setEndLon)} className="w-1/2 px-2 py-1.5 text-sm border border-red-200 rounded bg-white focus:ring-1 focus:ring-red-500 outline-none" placeholder="Lon" required />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative overflow-hidden w-10 h-8 rounded border border-gray-300 shadow-sm">
                                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">Màu hiển thị</span>
                                </div>

                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2.5 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors flex justify-center items-center gap-2 font-medium shadow-sm">
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />} Vẽ lộ trình
                                </button>

                                {/* List Routes */}
                                <div className="mt-6 space-y-2">
                                    {routes.map((r, i) => (
                                        <div key={r.id} className="flex justify-between items-center bg-white p-2.5 rounded border border-gray-200 shadow-sm text-sm hover:border-blue-300 transition-colors group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm" style={{ background: r.color }}>{i + 1}</div>
                                                <div className="truncate w-32 font-medium text-gray-700">{r.name}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{(r.distance / 1000).toFixed(1)}km</span>
                                                <button onClick={() => setRoutes(routes.filter(x => x.id !== r.id))} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        )}

                        {/* TAB: CIRCLE */}
                        {activeTab === 'circle' && (
                            <form onSubmit={handleAddCircle} className="space-y-4">
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                    <label className="text-xs font-bold text-yellow-800 flex justify-between items-center mb-1">
                                        Tâm vòng tròn
                                        <span className="font-normal bg-white px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-help border border-yellow-100 shadow-sm text-yellow-700" title="Chuột phải lên bản đồ để lấy nhanh"><MousePointer2 className="w-3 h-3" /> Click map</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input value={circleLat} onChange={e => setCircleLat(e.target.value)} onPaste={e => handleSmartPaste(e, setCircleLat, setCircleLon)} className="w-1/2 px-2 py-1.5 text-sm border border-yellow-200 rounded bg-white focus:ring-1 focus:ring-yellow-500 outline-none" placeholder="Lat" required />
                                        <input value={circleLon} onChange={e => setCircleLon(e.target.value)} onPaste={e => handleSmartPaste(e, setCircleLat, setCircleLon)} className="w-1/2 px-2 py-1.5 text-sm border border-yellow-200 rounded bg-white focus:ring-1 focus:ring-yellow-500 outline-none" placeholder="Lon" required />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-700 block mb-1">Bán kính (km)</label>
                                    <input type="number" step="0.1" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none shadow-sm" required />
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative overflow-hidden w-10 h-8 rounded border border-gray-300 shadow-sm">
                                        <input type="color" value={circleColor} onChange={e => setCircleColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-600">Màu viền & nền</span>
                                </div>

                                <button type="submit" className="w-full bg-yellow-600 text-white py-2.5 rounded-md hover:bg-yellow-700 active:bg-yellow-800 transition-colors flex justify-center items-center gap-2 font-medium shadow-sm">
                                    <CircleIcon className="w-4 h-4" /> Thêm bán kính
                                </button>

                                {/* List Circles */}
                                <div className="mt-6 space-y-2">
                                    {circles.map((c, i) => (
                                        <div key={c.id} className="flex justify-between items-center bg-white p-2.5 rounded border border-gray-200 shadow-sm text-sm hover:border-yellow-300 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded-full border-2" style={{ background: c.color, borderColor: c.color }}></div>
                                                <div className="font-medium text-gray-700">{c.radius} km</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{c.center[0].toFixed(2)}, {c.center[1].toFixed(2)}</span>
                                                <button type="button" onClick={() => setCircles(circles.filter(x => x.id !== c.id))} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {circles.length === 0 && <div className="text-center text-xs text-gray-400 py-8 border-2 border-dashed border-gray-100 rounded-lg">Chưa có vòng tròn nào</div>}
                                </div>
                            </form>
                        )}

                        {/* TAB: FILE KMZ */}
                        {activeTab === 'file' && (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center hover:bg-purple-50 transition-colors cursor-pointer group" onClick={() => document.getElementById('file-upload').click()}>
                                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                        <FileUp className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-700">Tải lên file KMZ hoặc KML</p>
                                    <p className="text-xs text-gray-400 mt-1">Hỗ trợ hiển thị đường (LineString) và điểm (Point)</p>

                                    <input
                                        type="file"
                                        accept=".kmz,.kml"
                                        onChange={handleImportKMZ}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                </div>

                                {/* List Imported */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">File đã thêm</h3>
                                    {importedLayers.map(l => (
                                        <div key={l.id} className="flex justify-between items-center bg-white p-2.5 rounded border border-gray-200 shadow-sm text-sm hover:border-purple-300 transition-colors group">
                                            <div className="flex items-center gap-3 truncate">
                                                <Layers className="w-4 h-4 text-purple-500" />
                                                <span className="truncate w-40 font-medium text-gray-700" title={l.fileName}>{l.fileName}</span>
                                            </div>
                                            <button onClick={() => setImportedLayers(importedLayers.filter(x => x.id !== l.id))} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                    {importedLayers.length === 0 && <div className="text-center text-xs text-gray-400 italic py-4">Chưa import file nào.</div>}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-gray-100">
                    {(!isMapReady || !isZipReady) && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10 bg-gray-50/80 backdrop-blur-sm flex-col gap-3">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                            <span className="text-sm font-medium text-gray-600">Đang khởi tạo bản đồ...</span>
                        </div>
                    )}
                    <div ref={mapRef} className="w-full h-full z-0 outline-none" />

                    <div className="absolute bottom-4 right-4 bg-white/90 px-4 py-2.5 text-xs text-gray-600 rounded-lg shadow-lg backdrop-blur-md z-[1000] pointer-events-none border border-white/50 flex items-center gap-2">
                        <MousePointer2 className="w-3.5 h-3.5 text-blue-500" />
                        <span><b>Mẹo:</b> Chuột phải để mở menu thao tác nhanh</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
