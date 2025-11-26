import { useState } from 'react';
import { Upload, Trash2, Search, MapPin, School, Cross, ShoppingBag, TreePine, Loader2 } from 'lucide-react';
import { fetchRoute, fetchAmenities, searchLocation } from '../utils/api';

export default function Sidebar({
    activeTab,
    agent, setAgent,
    property, setProperty,
    destinations, setDestinations,
    amenities, setAmenities
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [newDestName, setNewDestName] = useState('');
    const [isAddingRoute, setIsAddingRoute] = useState(false);

    // --- HANDLERS ---

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAgent({ ...agent, logo: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        const results = await searchLocation(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
    };

    // const handleAddDestination = async () => {
    //     if (!property) {
    //         alert("Please pin the Target Property first!");
    //         return;
    //     }
    //     // For MVP, we'll just add a placeholder or ask user to click map.
    //     // Better: Allow user to search for destination or click map.
    //     // Let's implement "Click Map to Add" logic in main component, 
    //     // but here we can add via search if we had a second search box.
    //     // For now, let's assume we add a "Pending" destination that waits for a map click?
    //     // Or simpler: Just a button "Add Destination" that enables a "Pick Mode".
    //     // Let's stick to the requirements: "Agent inputs key destinations".

    //     // Let's simulate a random nearby point for demo if no input, 
    //     // OR better: use the search results to add a destination.
    // };

    const handleAddRouteFromSearch = async (res) => {
        if (!property) {
            alert("Please set Property location first.");
            return;
        }
        setIsAddingRoute(true);
        const start = [property.lat, property.lon];
        const end = [res.lat, res.lon];
        const routeData = await fetchRoute(start, end);

        if (routeData) {
            setDestinations([...destinations, {
                id: Date.now(),
                name: newDestName || res.display_name.split(',')[0],
                lat: res.lat,
                lon: res.lon,
                path: routeData.path,
                distance: routeData.distance,
                duration: routeData.duration,
                color: '#' + Math.floor(Math.random() * 16777215).toString(16)
            }]);
            setNewDestName('');
            setSearchResults([]);
            setSearchQuery('');
        }
        setIsAddingRoute(false);
    };

    const toggleAmenity = async (type) => {
        const isActive = amenities[type].active;
        if (isActive) {
            setAmenities({ ...amenities, [type]: { ...amenities[type], active: false } });
        } else {
            if (!property) {
                alert("Please set Property location first.");
                return;
            }
            // Check if data already exists to avoid re-fetching
            if (amenities[type].data.length > 0) {
                setAmenities({ ...amenities, [type]: { ...amenities[type], active: true } });
            } else {
                // Fetch
                const data = await fetchAmenities([property.lat, property.lon], 2, type); // 2km radius
                setAmenities({ ...amenities, [type]: { active: true, data: data } });
            }
        }
    };

    // --- RENDER ---

    if (activeTab === 'agent') {
        return (
            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Agent Name</label>
                    <input
                        type="text"
                        value={agent.name}
                        onChange={e => setAgent({ ...agent, name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. John Doe"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                    <input
                        type="text"
                        value={agent.phone}
                        onChange={e => setAgent({ ...agent, phone: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. 0909 123 456"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Agency Logo</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative">
                        {agent.logo ? (
                            <div className="relative inline-block">
                                <img src={agent.logo} alt="Logo" className="h-20 object-contain mx-auto" />
                                <button
                                    onClick={() => setAgent({ ...agent, logo: null })}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">Click to upload (PNG/JPG)</p>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={!!agent.logo}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'property') {
        return (
            <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800">
                    <p className="flex items-center gap-2 font-semibold"><MapPin className="w-4 h-4" /> How to set location:</p>
                    <p className="mt-1 opacity-80">Search below OR simply click anywhere on the map to pin the target property.</p>
                </div>

                <form onSubmit={handleSearch} className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Search address..."
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    {isSearching && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-blue-500" />}
                </form>

                {searchResults.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y">
                        {searchResults.map((res, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setProperty({ lat: res.lat, lon: res.lon, address: res.display_name });
                                    setSearchResults([]);
                                    setSearchQuery('');
                                }}
                                className="w-full text-left p-3 text-sm hover:bg-gray-50 transition-colors"
                            >
                                {res.display_name}
                            </button>
                        ))}
                    </div>
                )}

                {property && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                        <h3 className="text-green-800 font-bold text-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            Current Target
                        </h3>
                        <p className="text-xs text-green-700 mt-1 font-mono">{property.lat.toFixed(5)}, {property.lon.toFixed(5)}</p>
                        {property.address && <p className="text-xs text-green-600 mt-1 truncate">{property.address}</p>}
                    </div>
                )}
            </div>
        );
    }

    if (activeTab === 'routes') {
        return (
            <div className="p-6 space-y-6">
                {!property && (
                    <div className="text-center text-sm text-red-500 bg-red-50 p-3 rounded">
                        Please set Property location first!
                    </div>
                )}

                <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-700">Add New Destination</label>
                    <input
                        type="text"
                        value={newDestName}
                        onChange={e => setNewDestName(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="Name (e.g. Wife's Office)"
                    />
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded text-sm"
                            placeholder="Search location..."
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                    </div>

                    {searchResults.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y max-h-40 overflow-y-auto">
                            {searchResults.map((res, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAddRouteFromSearch(res)}
                                    disabled={isAddingRoute}
                                    className="w-full text-left p-2 text-xs hover:bg-gray-50 disabled:opacity-50 flex justify-between items-center"
                                >
                                    <span className="truncate pr-2">{res.display_name}</span>
                                    {isAddingRoute && <Loader2 className="w-3 h-3 animate-spin text-blue-500 flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleSearch}
                        disabled={!searchQuery || isSearching}
                        className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSearching ? 'Searching...' : 'Find & Add Route'}
                    </button>
                </div>

                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase">Active Routes</h3>
                    {destinations.map(dest => (
                        <div key={dest.id} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm flex justify-between items-center">
                            <div>
                                <div className="font-medium text-sm text-gray-800">{dest.name}</div>
                                <div className="text-xs text-gray-500">
                                    {(dest.distance / 1000).toFixed(1)} km • {Math.round(dest.duration / 60)} min
                                </div>
                            </div>
                            <button
                                onClick={() => setDestinations(destinations.filter(d => d.id !== dest.id))}
                                className="text-gray-400 hover:text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {destinations.length === 0 && (
                        <div className="text-center text-xs text-gray-400 py-4 italic">No routes added yet.</div>
                    )}
                </div>
            </div>
        );
    }

    if (activeTab === 'amenities') {
        return (
            <div className="p-6 space-y-6">
                {!property && (
                    <div className="text-center text-sm text-red-500 bg-red-50 p-3 rounded">
                        Please set Property location first!
                    </div>
                )}

                <p className="text-sm text-gray-600">Show nearby amenities within 2km radius.</p>

                <div className="space-y-3">
                    {[
                        { id: 'school', label: 'Schools', icon: School, color: 'text-blue-600' },
                        { id: 'hospital', label: 'Hospitals', icon: Cross, color: 'text-red-600' },
                        { id: 'market', label: 'Markets', icon: ShoppingBag, color: 'text-orange-600' },
                        { id: 'park', label: 'Parks', icon: TreePine, color: 'text-green-600' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => toggleAmenity(item.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all
                ${amenities[item.id].active
                                    ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={`w-5 h-5 ${item.color}`} />
                                <span className="font-medium text-sm">{item.label}</span>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center
                ${amenities[item.id].active ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}
                            >
                                {amenities[item.id].active && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}
