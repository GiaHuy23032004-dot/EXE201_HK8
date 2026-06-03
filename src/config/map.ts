export const MAP_PROVIDER = import.meta.env.VITE_MAP_PROVIDER || "geoapify";
export const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY || "";

const defaultLat = Number(import.meta.env.VITE_DEFAULT_MAP_LAT ?? 10.7769);
const defaultLng = Number(import.meta.env.VITE_DEFAULT_MAP_LNG ?? 106.7009);

export const DEFAULT_MAP_CENTER: [number, number] = [
  Number.isFinite(defaultLat) ? defaultLat : 10.7769,
  Number.isFinite(defaultLng) ? defaultLng : 106.7009,
];

const defaultZoom = Number(import.meta.env.VITE_DEFAULT_MAP_ZOOM ?? 12);
export const DEFAULT_MAP_ZOOM = Number.isFinite(defaultZoom) ? defaultZoom : 12;

export const GEOAPIFY_TILE_URL =
  "https://maps.geoapify.com/v1/tile/carto/{z}/{x}/{y}.png?apiKey=" + GEOAPIFY_API_KEY;

const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1/geocode";

export function buildGeocodeUrl(text: string) {
  const encodedText = encodeURIComponent(text.trim());
  return `${GEOAPIFY_BASE_URL}/search?text=${encodedText}&limit=5&lang=vi&filter=countrycode:vn&apiKey=${GEOAPIFY_API_KEY}`;
}

export function buildReverseGeocodeUrl(lat: number, lon: number) {
  return `${GEOAPIFY_BASE_URL}/reverse?lat=${lat}&lon=${lon}&lang=vi&apiKey=${GEOAPIFY_API_KEY}`;
}

export function buildAutocompleteUrl(text: string) {
  const encodedText = encodeURIComponent(text.trim());
  return `${GEOAPIFY_BASE_URL}/autocomplete?text=${encodedText}&limit=5&lang=vi&filter=countrycode:vn&apiKey=${GEOAPIFY_API_KEY}`;
}

export function maskGeoapifyKey(key = GEOAPIFY_API_KEY) {
  if (!key) return "";
  if (key.length <= 10) return `${key.slice(0, 2)}••••${key.slice(-2)}`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}
