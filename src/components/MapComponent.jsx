import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { School, Cross, ShoppingBag, TreePine } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// --- ICONS ---
const createIcon = (iconNode, colorClass, size = 30) => {
    const html = renderToStaticMarkup(
        <div className={`w-full h-full flex items-center justify-center rounded-full border-2 border-white shadow-lg ${colorClass}`}>
            {iconNode}
        </div>
    );
    return L.divIcon({
        html: html,
        className: 'custom-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
};

const targetIcon = L.divIcon({
    html: renderToStaticMarkup(
        <div className="relative">
            <div className="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg z-10 relative"></div>
            <div className="absolute -inset-2 bg-red-500/30 rounded-full animate-ping"></div>
        </div>
    ),
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const destIcon = (index) => L.divIcon({
    html: `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">${index + 1}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const amenityIcons = {
    school: createIcon(<School size={16} color="white" />, 'bg-blue-500', 28),
    hospital: createIcon(<Cross size={16} color="white" />, 'bg-red-500', 28),
    market: createIcon(<ShoppingBag size={16} color="white" />, 'bg-orange-500', 28),
    park: createIcon(<TreePine size={16} color="white" />, 'bg-green-500', 28),
};

// --- CONTROLLER ---
function MapController({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom || 14, { duration: 1.5 });
        }
    }, [center, zoom, map]);
    return null;
}

function ClickHandler({ onMapClick }) {
    useMapEvents({
        click(e) {
            onMapClick && onMapClick(e.latlng);
        },
    });
    return null;
}

// --- MAIN COMPONENT ---
export default function MapComponent({ property, destinations, amenities, onMapClick, staticMap = false }) {
    const defaultCenter = [10.7769, 106.7009]; // HCMC Default
    const center = property ? [property.lat, property.lon] : defaultCenter;

    return (
        <MapContainer
            center={center}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={!staticMap}
            attributionControl={!staticMap}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            <MapController center={center} zoom={property ? 15 : 13} />
            {!staticMap && <ClickHandler onMapClick={onMapClick} />}

            {/* 1. Target Property */}
            {property && (
                <>
                    <Marker position={[property.lat, property.lon]} icon={targetIcon}>
                        <Popup>
                            <div className="text-center">
                                <b className="text-red-600">Target Property</b>
                                <p className="text-xs text-gray-500">{property.address}</p>
                            </div>
                        </Popup>
                    </Marker>
                    {/* 2km Radius Circle */}
                    <Circle
                        center={[property.lat, property.lon]}
                        radius={2000}
                        pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.05, dashArray: '5, 10', weight: 1 }}
                    />
                </>
            )}

            {/* 2. Destinations & Routes */}
            {destinations.map((dest, i) => (
                <React.Fragment key={dest.id}>
                    <Marker position={[dest.lat, dest.lon]} icon={destIcon(i)}>
                        <Popup>
                            <b>{dest.name}</b>
                            <br />
                            <span className="text-xs">{(dest.distance / 1000).toFixed(1)} km</span>
                        </Popup>
                    </Marker>
                    {dest.path && (
                        <Polyline
                            positions={dest.path}
                            pathOptions={{ color: dest.color || '#3B82F6', weight: 4, opacity: 0.7, lineCap: 'round' }}
                        />
                    )}
                </React.Fragment>
            ))}

            {/* 3. Amenities */}
            {Object.entries(amenities).map(([type, { active, data }]) => (
                active && data.map(item => (
                    <Marker key={`${type}-${item.id}`} position={[item.lat, item.lon]} icon={amenityIcons[type] || amenityIcons.school}>
                        <Popup>
                            <b className="capitalize">{type}</b>: {item.name}
                        </Popup>
                    </Marker>
                ))
            ))}

        </MapContainer>
    );
}
