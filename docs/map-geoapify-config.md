# Geoapify + Leaflet map configuration

VET uses Leaflet with Geoapify map tiles for the learner map at `/map`.

Create a local `.env.local` file with:

```env
VITE_MAP_PROVIDER=geoapify
VITE_GEOAPIFY_API_KEY=your_geoapify_api_key
VITE_DEFAULT_MAP_LAT=10.7769
VITE_DEFAULT_MAP_LNG=106.7009
VITE_DEFAULT_MAP_ZOOM=12
```

Do not commit `.env.local` and do not hardcode the Geoapify API key in source files.

## Endpoints

Map tiles:

```text
https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}.png?apiKey=${VITE_GEOAPIFY_API_KEY}
```

Geocoding:

```text
https://api.geoapify.com/v1/geocode/search?text=${encodedText}&limit=5&lang=vi&filter=countrycode:vn&apiKey=${VITE_GEOAPIFY_API_KEY}
```

Reverse geocoding:

```text
https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&lang=vi&apiKey=${VITE_GEOAPIFY_API_KEY}
```

Autocomplete:

```text
https://api.geoapify.com/v1/geocode/autocomplete?text=${encodedText}&limit=5&lang=vi&filter=countrycode:vn&apiKey=${VITE_GEOAPIFY_API_KEY}
```

## Dev reference page

In development only, open:

```text
/dev/map-config
```

The page shows required env names, masked API key status, endpoint templates, and a copyable `.env.local` sample. In production it redirects to `/`.
