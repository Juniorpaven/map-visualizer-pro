
import MapComponent from './MapComponent';
import { Phone, MapPin, Clock, Navigation } from 'lucide-react';

export default function ExportOverlay({ agent, property, destinations, amenities }) {
    // Calculate Summary Metrics
    // const totalDist = destinations.reduce((acc, d) => acc + d.distance, 0) / 1000;
    const totalTime = destinations.reduce((acc, d) => acc + d.duration, 0) / 60;
    // const amenityCount = Object.values(amenities).reduce((acc, val) => acc + (val.active ? val.data.length : 0), 0);

    return (
        <div className="w-full h-full flex flex-col bg-white">

            {/* MAP AREA (Takes up most space) */}
            <div className="flex-1 relative">
                <MapComponent
                    property={property}
                    destinations={destinations}
                    amenities={amenities}
                    staticMap={true} // Disable controls for clean look
                />

                {/* Floating "Convenience Score" Badge */}
                <div className="absolute top-8 right-8 bg-white/95 backdrop-blur shadow-xl rounded-xl p-4 z-[500] border-l-4 border-green-500">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Convenience Score</div>
                    <div className="text-3xl font-black text-slate-800">9.5<span className="text-lg text-gray-400 font-normal">/10</span></div>
                    <div className="text-xs text-green-600 font-medium mt-1">Excellent Location</div>
                </div>
            </div>

            {/* BRANDED FOOTER */}
            <div className="h-48 bg-brand-dark text-white flex">

                {/* Left: Agent Info */}
                <div className="w-1/3 p-8 border-r border-slate-700 flex flex-col justify-center gap-4">
                    {agent.logo && <img src={agent.logo} alt="Logo" className="h-12 object-contain self-start mb-2" />}
                    <div>
                        <h2 className="text-2xl font-bold">{agent.name || 'Your Agent'}</h2>
                        <div className="flex items-center gap-2 text-slate-300 mt-1">
                            <Phone className="w-4 h-4" />
                            <span>{agent.phone || '0909 000 000'}</span>
                        </div>
                    </div>
                </div>

                {/* Middle: Property Context */}
                <div className="w-1/3 p-8 border-r border-slate-700 flex flex-col justify-center">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-6 h-6 text-blue-400 mt-1" />
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold">Target Property</div>
                            <div className="text-lg font-medium leading-snug mt-1">
                                {property?.address || 'Selected Location'}
                            </div>
                            <div className="text-sm text-slate-400 mt-2">
                                {property?.lat.toFixed(4)}, {property?.lon.toFixed(4)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Summary Metrics */}
                <div className="w-1/3 p-8 flex flex-col justify-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/20 rounded-lg text-blue-400">
                            <Navigation className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{destinations.length}</div>
                            <div className="text-xs text-slate-400 uppercase">Key Routes</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-600/20 rounded-lg text-green-400">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{Math.round(totalTime)} <span className="text-sm font-normal">mins</span></div>
                            <div className="text-xs text-slate-400 uppercase">Daily Commute</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
