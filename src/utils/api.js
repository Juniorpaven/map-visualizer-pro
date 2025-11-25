// Utility functions for API calls

// OSRM Route Fetcher
export const fetchRoute = async (start, end) => {
    // start/end are [lat, lon]
    // OSRM expects lon,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === 'Ok' && data.routes?.[0]) {
            // Convert back to [lat, lon] for Leaflet
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            return {
                path: coords,
                distance: data.routes[0].distance, // meters
                duration: data.routes[0].duration // seconds
            };
        }
    } catch (e) {
        console.error("Routing Error:", e);
    }
    return null;
};

// Overpass API for Amenities
export const fetchAmenities = async (center, radiusKm, type) => {
    // type: 'school' | 'hospital' | 'marketplace'
    const radiusMeters = radiusKm * 1000;
    let queryTag = '';

    switch (type) {
        case 'school': queryTag = '["amenity"="school"]'; break;
        case 'hospital': queryTag = '["amenity"="hospital"]'; break;
        case 'market': queryTag = '["amenity"="marketplace"]'; break;
        case 'park': queryTag = '["leisure"="park"]'; break;
        default: queryTag = '["amenity"="school"]';
    }

    const query = `
    [out:json][timeout:25];
    (
      node${queryTag}(around:${radiusMeters},${center[0]},${center[1]});
      way${queryTag}(around:${radiusMeters},${center[0]},${center[1]});
    );
    out center;
  `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.elements.map(el => ({
            id: el.id,
            lat: el.lat || el.center.lat,
            lon: el.lon || el.center.lon,
            name: el.tags.name || 'Unknown',
            type: type
        })).slice(0, 20); // Limit to 20 results to avoid clutter
    } catch (e) {
        console.error("Overpass Error:", e);
        return [];
    }
};

// Nominatim Search
export const searchLocation = async (query) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.map(item => ({
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            display_name: item.display_name
        }));
    } catch (e) {
        console.error("Search Error:", e);
        return [];
    }
};
