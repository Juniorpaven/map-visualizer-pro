import { useState, useEffect, useRef } from 'react';
import {
    Trash2, Plus, Map as MapIcon, Navigation, Target,
    Loader2, ArrowDown, RotateCcw, Copy, Check,
    Circle as CircleIcon, FileUp, Layers, MousePointer2,
    Search, MapPin, Globe, Home, Presentation, FileDown, Printer, Camera, ChevronRight, ChevronLeft
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import JSZip from 'jszip';
import { mockProperties } from '../mockProperties';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

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
    const [properties, setProperties] = useState(mockProperties);
    const [routes, setRoutes] = useState([]);
    const [circles, setCircles] = useState([]);
    const [importedLayers, setImportedLayers] = useState([]);

    // --- STATE UI & FORM ---
    const [activeTab, setActiveTab] = useState('property');

    // Property Filters
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

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

    // Home & Amenities State
    const [homeLocation, setHomeLocation] = useState(null); // { lat, lon }
    const [amenities, setAmenities] = useState([]);
    const [isFetchingAmenities, setIsFetchingAmenities] = useState(false);

    // Map Layer State
    const [mapType, setMapType] = useState('standard'); // 'standard' | 'satellite'

    // System State
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [storySteps, setStorySteps] = useState([
        { id: 1, title: 'Tổng quan khu vực', desc: 'Vị trí trung tâm Quận 1, kết nối thuận tiện.', lat: 10.7769, lon: 106.7009, zoom: 14 },
        { id: 2, title: 'Tiện ích giáo dục', desc: 'Hệ thống trường học quốc tế trong bán kính 2km.', lat: 10.7800, lon: 106.6980, zoom: 15 },
        { id: 3, title: 'Hạ tầng giao thông', desc: 'Tuyến Metro số 1 sắp đi vào hoạt động.', lat: 10.7720, lon: 106.7050, zoom: 16 }
    ]);
    const [currentStoryStep, setCurrentStoryStep] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [generatedQR, setGeneratedQR] = useState('');

    const [mapZoom, setMapZoom] = useState(13);

    // Derived State for Filtering
    const filteredProperties = properties.filter(p => {
        if (filterType !== 'all' && p.type !== filterType) return false;
        if (filterStatus !== 'all' && p.status !== filterStatus) return false;
        return true;
    });

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);
    const tileLayerRef = useRef(null);
    const labelLayerRef = useRef(null);

    // 2. Khởi tạo Map
    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const map = L.map(mapRef.current).setView([10.7769, 106.7009], 13);

            // Default to standard layer initially
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            tileLayerRef.current = tileLayer;

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
    }, []);

    // Handle Map Layer Switch
    useEffect(() => {
        if (tileLayerRef.current) {
            if (mapType === 'satellite') {
                tileLayerRef.current.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
                tileLayerRef.current.options.attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

                // Add labels layer if not present
                if (mapInstanceRef.current) {
                    if (!labelLayerRef.current) {
                        labelLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                            zIndex: 1000 // Ensure labels are on top
                        });
                    }
                    if (!mapInstanceRef.current.hasLayer(labelLayerRef.current)) {
                        labelLayerRef.current.addTo(mapInstanceRef.current);
                    }
                }
            } else {
                tileLayerRef.current.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
                tileLayerRef.current.options.attribution = '&copy; OpenStreetMap contributors';

                // Remove labels layer if present
                if (mapInstanceRef.current && labelLayerRef.current && mapInstanceRef.current.hasLayer(labelLayerRef.current)) {
                    mapInstanceRef.current.removeLayer(labelLayerRef.current);
                }
            }
        }
    }, [mapType]);

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

        // D. VẼ HOME & AMENITIES
        if (homeLocation) {
            const homeIcon = L.divIcon({
                className: 'custom-home-marker',
                html: `<div style="background-color: #EF4444; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                       </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            L.marker([homeLocation.lat, homeLocation.lon], { icon: homeIcon, zIndexOffset: 1000 })
                .bindPopup('<b class="text-red-600">Vị trí Nhà / Đầu tư</b>')
                .addTo(layerGroup);

            // Vẽ vòng tròn 2km
            L.circle([homeLocation.lat, homeLocation.lon], {
                radius: 2000,
                color: '#EF4444',
                weight: 1,
                dashArray: '5, 5',
                fillOpacity: 0.05
            }).addTo(layerGroup);

            allBounds.push([homeLocation.lat, homeLocation.lon]);
        }

        amenities.forEach(item => {
            let color = '#3B82F6';
            let iconSvg = '';

            if (item.type === 'school') {
                color = '#F59E0B'; // Amber
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/></svg>';
            } else if (item.type === 'hospital') {
                color = '#EF4444'; // Red
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h-4"/><path d="M6 12h4"/><path d="M3 22h18"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/></svg>';
            } else if (item.type === 'market') {
                color = '#10B981'; // Green
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="m4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/></svg>';
            } else if (item.type === 'park') {
                color = '#22C55E'; // Green
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 5.3-2.1"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .9-1.7l-3.5-6a1 1 0 0 0-1.7 0l-3.5 6a1 1 0 0 0 .9 1.7"/></svg>';
            }

            const amenityIcon = L.divIcon({
                className: 'custom-amenity-marker',
                html: `<div style="background-color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; color: ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        ${iconSvg}
                       </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            L.marker([item.lat, item.lon], { icon: amenityIcon })
                .bindPopup(`<div class="text-center"><b style="color:${color}">${item.name || 'Tiện ích'}</b><br/><span class="text-xs text-gray-500 capitalize">${item.type}</span></div>`)
                .addTo(layerGroup);
        });

        // E. VẼ BẤT ĐỘNG SẢN (PROPERTIES)
        filteredProperties.forEach(prop => {
            const marker = L.marker([prop.lat, prop.lon], {
                icon: getPropertyIcon(prop.type, prop.status)
            }).addTo(layerGroup);

            // Rich Card Popup Content
            const popupContent = `
            <div class="font-sans min-w-[240px] max-w-xs">
                <div class="relative h-32 w-full bg-gray-200 rounded-t-lg overflow-hidden mb-2">
                    <img src="${prop.image_url}" alt="${prop.title}" class="w-full h-full object-cover" />
                    <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-xs font-bold text-gray-800 shadow-sm">
                        ${prop.price}
                    </div>
                    <div class="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-0.5 rounded text-[10px] uppercase">
                        ${prop.type}
                    </div>
                </div>
                <div class="px-1">
                    <h3 class="font-bold text-gray-800 text-sm leading-tight mb-1">${prop.title}</h3>
                    <p class="text-xs text-gray-500 flex items-center gap-1 mb-2">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        ${prop.address}
                    </p>
                    <div class="flex flex-wrap gap-1 mb-3">
                        ${prop.tags.map(tag => `<span class="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] border border-gray-200">${tag}</span>`).join('')}
                    </div>
                    <div class="flex gap-2">
                        <button class="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 font-medium transition-colors">Liên hệ</button>
                        <button class="flex-1 bg-white border border-gray-300 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-50 font-medium transition-colors">Chi tiết</button>
                    </div>
                </div>
            </div>
        `;
            marker.bindPopup(popupContent, { closeButton: false, className: 'rich-popup' });
        });

    }, [routes, circles, importedLayers, homeLocation, amenities, mapZoom, properties, filterType, filterStatus]);

    // --- LOGIC: Properties ---
    const getPropertyIcon = (type, status) => {
        let iconSvg = '';
        let color = '#3B82F6';

        switch (type) {
            case 'apartment':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>'; // Building
                color = '#3B82F6'; // Blue
                break;
            case 'house':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'; // Home
                color = '#F59E0B'; // Amber
                break;
            case 'land':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h18"/><path d="M14 22V8a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="m3 22 2-9.6c.1-.6.7-1 1.3-1H11"/></svg>'; // Map/Landish
                color = '#10B981'; // Green
                break;
            case 'villa':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8 9 5 5 8"/><path d="M19.33 21.68 16 9"/><path d="m7.38 22 1.94-3.32"/><path d="m14 2 2.76 5.56"/><path d="m9.06 2 2.94 5.5"/><path d="M16.14 22 18 15"/><path d="M3 21.84 5.5 12"/><path d="M12.44 22 10 15"/></svg>'; // Palm/Villa
                color = '#8B5CF6'; // Purple
                break;
            default:
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';
        }

        const isSold = status === 'sold';
        const bgColor = isSold ? '#9CA3AF' : color; // Gray if sold

        return L.divIcon({
            className: 'custom-property-marker',
            html: `<div style="
                background-color: ${bgColor}; 
                width: 36px; height: 36px; 
                border-radius: 50% 50% 0 50%; 
                transform: rotate(-45deg);
                border: 2px solid white; 
                box-shadow: 0 3px 6px rgba(0,0,0,0.3); 
                display: flex; align-items: center; justify-content: center;
                position: relative;
            ">
                <div style="transform: rotate(45deg); color: white;">${iconSvg}</div>
                ${isSold ? '<div style="position:absolute; top:-5px; right:-10px; background:red; color:white; font-size:9px; padding:1px 4px; border-radius:4px; transform: rotate(45deg);">SOLD</div>' : ''}
            </div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 34],
            popupAnchor: [0, -30]
        });
    }



    // --- LOGIC: Context Menu ---
    const handleSetHomeFromMenu = () => {
        if (contextMenu) {
            const lat = contextMenu.lat;
            const lon = contextMenu.lon;
            setHomeLocation({ lat, lon });
            setContextMenu(null);
            fetchAmenities(lat, lon);
        }
    };

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

    // --- LOGIC: Amenities ---
    const fetchAmenities = async (lat, lon) => {
        setIsFetchingAmenities(true);
        setAmenities([]);
        // Overpass API query
        const query = `
            [out:json][timeout:25];
            (
              node["amenity"~"school|hospital|marketplace"](around:2000,${lat},${lon});
              way["amenity"~"school|hospital|marketplace"](around:2000,${lat},${lon});
              node["leisure"="park"](around:2000,${lat},${lon});
              way["leisure"="park"](around:2000,${lat},${lon});
            );
            out center;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });
            const data = await response.json();

            const items = data.elements.map(el => {
                const type = el.tags.amenity || el.tags.leisure;
                const name = el.tags.name || 'Không tên';
                const l = el.lat || el.center?.lat;
                const ln = el.lon || el.center?.lon;

                let simpleType = 'other';
                if (type === 'school' || type === 'university' || type === 'kindergarten') simpleType = 'school';
                else if (type === 'hospital' || type === 'clinic') simpleType = 'hospital';
                else if (type === 'marketplace') simpleType = 'market';
                else if (type === 'park') simpleType = 'park';

                return {
                    id: el.id,
                    type: simpleType,
                    name: name,
                    lat: l,
                    lon: ln
                };
            }).filter(i => i.lat && i.lon);

            setAmenities(items);
        } catch (err) {
            console.error("Error fetching amenities:", err);
            alert("Không thể tải dữ liệu tiện ích. Vui lòng thử lại sau.");
        }
        setIsFetchingAmenities(false);
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
        } catch (e) { console.error(e); }
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

                    // Auto-zoom to the imported features
                    if (mapInstanceRef.current) {
                        const bounds = L.latLngBounds();
                        features.forEach(f => {
                            if (f.type === 'LineString') {
                                f.coordinates.forEach(c => bounds.extend(c));
                            } else if (f.type === 'Point') {
                                bounds.extend(f.coordinates);
                            }
                        });
                        if (bounds.isValid()) {
                            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
                        }
                    }

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

    // --- LOGIC: Story Mode ---
    const handleNextStep = () => {
        if (currentStoryStep < storySteps.length - 1) {
            const nextStep = currentStoryStep + 1;
            setCurrentStoryStep(nextStep);
            const step = storySteps[nextStep];
            if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([step.lat, step.lon], step.zoom, { duration: 1.5 });
            }
        }
    };

    const handlePrevStep = () => {
        if (currentStoryStep > 0) {
            const prevStep = currentStoryStep - 1;
            setCurrentStoryStep(prevStep);
            const step = storySteps[prevStep];
            if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([step.lat, step.lon], step.zoom, { duration: 1.5 });
            }
        }
    };

    const handlePlayStory = (index) => {
        setCurrentStoryStep(index);
        const step = storySteps[index];
        if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([step.lat, step.lon], step.zoom, { duration: 1.5 });
        }
    }

    // --- LOGIC: Export ---
    const handleExport = async () => {
        setIsExporting(true);
        // Generate QR Code first
        try {
            const url = window.location.href; // In real app, this would be a specific deep link
            const qrData = await QRCode.toDataURL(url);
            setGeneratedQR(qrData);

            // Wait a bit for render
            setTimeout(async () => {
                const element = document.body; // Capture full body essentially
                const canvas = await html2canvas(element, { useCORS: true });
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `RealEstate_Report_${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                setIsExporting(false);
            }, 1000); // Wait for Overlay to render
        } catch (err) {
            console.error(err);
            setIsExporting(false);
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
                    <button onClick={handleSetHomeFromMenu} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2"><Home className="w-4 h-4" /> Đặt Nhà (Quét tiện ích)</button>
                    <button onClick={handleAddCircleFromMenu} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 flex items-center gap-2"><CircleIcon className="w-4 h-4" /> Vẽ bán kính tại đây</button>
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

                <div className="flex items-center gap-4">
                    {/* Layer Switcher */}
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setMapType('standard')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${mapType === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <MapIcon className="w-3.5 h-3.5" /> Bản đồ
                        </button>
                        <button
                            onClick={() => setMapType('satellite')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${mapType === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Globe className="w-3.5 h-3.5" /> Vệ tinh
                        </button>
                    </div>

                    <div className="flex gap-4 text-sm font-medium text-gray-500 flex-shrink-0 hidden lg:flex">
                        <span>Routes: <b className="text-blue-600">{routes.length}</b></span>
                        <span>Circles: <b className="text-red-500">{circles.length}</b></span>
                        <span>Files: <b className="text-purple-600">{importedLayers.length}</b></span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* Sidebar */}
                <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg z-20 h-full overflow-hidden">

                    {/* Tabs Navigation */}
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        <button onClick={() => setActiveTab('property')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'property' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Home className="w-4 h-4" /> Tài sản
                        </button>
                        <button onClick={() => setActiveTab('route')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'route' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Navigation className="w-4 h-4" /> Đường đi
                        </button>
                        <button onClick={() => setActiveTab('circle')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'circle' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <CircleIcon className="w-4 h-4" /> Bán kính
                        </button>
                        <button onClick={() => setActiveTab('file')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'file' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <FileUp className="w-4 h-4" /> KMZ
                        </button>
                        <button onClick={() => setActiveTab('amenity')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'amenity' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Target className="w-4 h-4" /> Tiện ích
                        </button>
                        <button onClick={() => setActiveTab('presentation')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'presentation' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Presentation className="w-4 h-4" /> Trình bày
                        </button>
                        <button onClick={() => setActiveTab('export')} className={`px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'export' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Printer className="w-4 h-4" /> Xuất bản
                        </button>
                    </div>

                    <div className="p-5 border-b border-gray-200 overflow-y-auto flex-1 custom-scrollbar">

                        {/* TAB: PROPERTY */}
                        {activeTab === 'property' && (
                            <div className="space-y-4">
                                <form className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 block mb-1">Loại Bất Động Sản</label>
                                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500">
                                            <option value="all">Tất cả</option>
                                            <option value="apartment">Chung cư</option>
                                            <option value="house">Nhà phố</option>
                                            <option value="land">Đất nền</option>
                                            <option value="villa">Biệt thự</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 block mb-1">Trạng thái</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setFilterStatus('all')} className={`flex-1 py-1.5 text-xs rounded border ${filterStatus === 'all' ? 'bg-blue-100 border-blue-200 text-blue-700 font-bold' : 'bg-white border-gray-300 text-gray-600'}`}>Tất cả</button>
                                            <button type="button" onClick={() => setFilterStatus('selling')} className={`flex-1 py-1.5 text-xs rounded border ${filterStatus === 'selling' ? 'bg-green-100 border-green-200 text-green-700 font-bold' : 'bg-white border-gray-300 text-gray-600'}`}>Đang bán</button>
                                            <button type="button" onClick={() => setFilterStatus('sold')} className={`flex-1 py-1.5 text-xs rounded border ${filterStatus === 'sold' ? 'bg-gray-100 border-gray-300 text-gray-700 font-bold' : 'bg-white border-gray-300 text-gray-600'}`}>Đã bán</button>
                                        </div>
                                    </div>
                                </form>

                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Danh sách ({filteredProperties.length})</h3>
                                    {filteredProperties.map(prop => (
                                        <div key={prop.id}
                                            className="flex gap-3 bg-white p-2 rounded border border-gray-200 hover:border-blue-400 cursor-pointer shadow-sm transition-all"
                                            onClick={() => {
                                                if (mapInstanceRef.current) {
                                                    mapInstanceRef.current.flyTo([prop.lat, prop.lon], 16);
                                                }
                                            }}
                                        >
                                            <img src={prop.image_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0 bg-gray-200" />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-800 text-sm truncate">{prop.title}</h4>
                                                <div className="text-xs text-blue-600 font-bold mb-0.5">{prop.price} <span className="text-gray-400 font-normal">• {prop.area}</span></div>
                                                <div className="text-[10px] text-gray-500 truncate">{prop.address}</div>
                                                <div className="mt-1 flex gap-1">
                                                    <span className={`px-1.5 rounded text-[10px] uppercase font-bold ${prop.status === 'sold' ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'}`}>{prop.status === 'sold' ? 'Sold' : 'Active'}</span>
                                                    <span className="px-1.5 bg-blue-50 text-blue-600 rounded text-[10px] uppercase font-bold">{prop.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredProperties.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-sm">Không tìm thấy bất động sản nào</div>
                                    )}
                                </div>
                            </div>
                        )}
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
                                    {circles.map((c) => (
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
                                {isProcessingFile ? (
                                    <div className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 bg-purple-50">
                                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                                        <span className="text-sm text-purple-600 font-medium">Đang xử lý file...</span>
                                    </div>
                                ) : (
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
                                )}

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

                        {/* TAB: AMENITY */}
                        {/* TAB: PRESENTATION (Story Mode) */}
                        {activeTab === 'presentation' && (
                            <div className="space-y-4">
                                <div className="bg-teal-50 p-4 rounded-lg border border-teal-100 mb-4">
                                    <h3 className="font-bold text-teal-800 text-sm mb-2 flex items-center gap-2">
                                        <Presentation className="w-4 h-4" /> Chế độ Trình chiếu
                                    </h3>
                                    <p className="text-xs text-teal-600 mb-3">Dẫn dắt khách hàng qua các điểm nhấn quan trọng theo kịch bản.</p>

                                    <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-teal-200">
                                        <button onClick={handlePrevStep} disabled={currentStoryStep === 0} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors">
                                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                                        </button>
                                        <div className="text-center">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bước {currentStoryStep + 1} / {storySteps.length}</div>
                                            <div className="font-bold text-gray-800">{storySteps[currentStoryStep].title}</div>
                                        </div>
                                        <button onClick={handleNextStep} disabled={currentStoryStep === storySteps.length - 1} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors">
                                            <ChevronRight className="w-5 h-5 text-gray-600" />
                                        </button>
                                    </div>

                                    <div className="mt-3 bg-white p-3 rounded text-sm text-gray-700 italic border-l-4 border-teal-400">
                                        "{storySteps[currentStoryStep].desc}"
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Danh sách điểm nhấn</h4>
                                    {storySteps.map((step, idx) => (
                                        <div key={step.id}
                                            onClick={() => handlePlayStory(idx)}
                                            className={`p-3 rounded border cursor-pointer transition-all flex items-center gap-3 ${currentStoryStep === idx ? 'bg-teal-50 border-teal-500 shadow-sm' : 'bg-white border-gray-200 hover:border-teal-300'}`}
                                        >
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStoryStep === idx ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-medium ${currentStoryStep === idx ? 'text-teal-900' : 'text-gray-700'}`}>{step.title}</div>
                                                <div className="text-xs text-gray-500 truncate w-48">{step.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB: EXPORT */}
                        {activeTab === 'export' && (
                            <div className="space-y-6">
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-center">
                                    <Printer className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                                    <h3 className="font-bold text-indigo-800 text-sm">Xuất bản Báo cáo</h3>
                                    <p className="text-xs text-indigo-600 mt-1">Tạo hình ảnh chuyên nghiệp gửi khách hàng.</p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-gray-700 block">Tùy chọn xuất</label>

                                    <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">
                                        <input type="checkbox" checked readOnly className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        <span className="flex-1">Logo thương hiệu</span>
                                        <span className="text-xs text-indigo-600 font-medium">Bắt buộc</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">
                                        <input type="checkbox" checked readOnly className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        <span className="flex-1">Mã QR truy cập nhanh</span>
                                        <span className="text-xs text-indigo-600 font-medium">Auto</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">
                                        <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500" />
                                        <span>Bao gồm chú thích bản đồ</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {isExporting ? <Loader2 className="animate-spin w-5 h-5" /> : <Camera className="w-5 h-5" />}
                                    {isExporting ? 'Đang xử lý...' : 'Chụp ảnh báo cáo (PNG)'}
                                </button>

                                <p className="text-[10px] text-center text-gray-400">
                                    *Hệ thống sẽ tự động chèn Watermark và QR Code vào ảnh xuất ra.
                                </p>
                            </div>
                        )}

                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-gray-100">
                    <div ref={mapRef} className="w-full h-full z-0 outline-none" />

                    {/* Export Overlay (Visible only during export) */}
                    {isExporting && (
                        <div className="absolute inset-0 z-[9999] pointer-events-none flex flex-col justify-between p-6 border-[20px] border-white/50 animate-in fade-in duration-300">
                            <div className="flex justify-between items-start">
                                <div className="bg-blue-900 text-white px-6 py-4 rounded-xl shadow-2xl">
                                    <h1 className="text-2xl font-bold uppercase tracking-widest">Báo cáo Tư vấn</h1>
                                    <div className="text-sm opacity-80 font-light">Bất Động Sản Chiến Lược</div>
                                </div>
                                <div className="bg-white p-2 rounded-lg shadow-xl">
                                    {generatedQR && <img src={generatedQR} className="w-24 h-24" alt="QR Code" />}
                                    <div className="text-[9px] text-center font-mono mt-1 text-gray-500">Scan Me</div>
                                </div>
                            </div>

                            <div className="bg-white/90 backdrop-blur p-4 rounded-xl shadow-xl max-w-sm self-end">
                                <h3 className="font-bold text-gray-800 mb-1 border-b border-gray-300 pb-1">Chú thích</h3>
                                <div className="space-y-1 text-xs text-gray-600">
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Vị trí quan tâm</div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Tiện ích (Trường học, Chợ)</div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Công viên cây xanh</div>
                                </div>
                                <div className="mt-3 text-[10px] text-gray-400 italic">
                                    Được tạo bởi Map Visualizer Pro
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-4 right-4 bg-white/90 px-4 py-2.5 text-xs text-gray-600 rounded-lg shadow-lg backdrop-blur-md z-[1000] pointer-events-none border border-white/50 flex items-center gap-2">
                        <MousePointer2 className="w-3.5 h-3.5 text-blue-500" />
                        <span><b>Mẹo:</b> Chuột phải để mở menu thao tác nhanh</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
