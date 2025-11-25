# Prop Analytics - Real Estate Location Intelligence Tool

## Overview

This is a specialized web application for Real Estate Agents to visualize the "Location Value" of a property. It allows agents to create professional, branded map visualizations showing commute times to key destinations and nearby amenities.

## Features

- **Agent Branding**: Customize with Name, Phone, and Logo.
- **Property Pinning**: Search or click to pin the target property.
- **Route Analysis**: Calculate driving distance and time to key client destinations (e.g., "Wife's Office", "School") using OSRM.
- **Amenity Search**: Auto-discover nearby Schools, Hospitals, Markets, and Parks using Overpass API.
- **Branded Export**: Generate a high-resolution PNG poster with map, agent info, and summary metrics.

## Tech Stack

- **Framework**: React (Vite)
- **Map**: Leaflet / React-Leaflet
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data**: OpenStreetMap (OSRM, Overpass, Nominatim)

## How to Run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open your browser at `http://localhost:5173` (or the port shown in terminal).

## Usage Flow

1. **Agent Tab**: Enter your details and upload a logo.
2. **Property Tab**: Search for an address or click on the map to set the center point.
3. **Routes Tab**: Add destinations to see routes and commute times.
4. **Amenities Tab**: Toggle nearby amenities to highlight convenience.
5. **Export**: Click the "Export Map Image" button to download the visual.
