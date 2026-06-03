import { Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  GEOAPIFY_API_KEY,
  GEOAPIFY_TILE_URL,
  MAP_PROVIDER,
  buildAutocompleteUrl,
  buildGeocodeUrl,
  buildReverseGeocodeUrl,
  maskGeoapifyKey,
} from "@/config/map";

const sampleEnv = `VITE_MAP_PROVIDER=geoapify
VITE_GEOAPIFY_API_KEY=your_geoapify_api_key
VITE_DEFAULT_MAP_LAT=10.7769
VITE_DEFAULT_MAP_LNG=106.7009
VITE_DEFAULT_MAP_ZOOM=12`;

export default function MapConfigPage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  const apiKeyConfigured = Boolean(GEOAPIFY_API_KEY);

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Map Integration Config</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dev-only reference for Geoapify + Leaflet environment values.
            </p>
          </div>

          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Environment status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <InfoRow label="Provider" value={MAP_PROVIDER} />
              <InfoRow label="Default center" value={`${DEFAULT_MAP_CENTER[0]}, ${DEFAULT_MAP_CENTER[1]}`} />
              <InfoRow label="Default zoom" value={String(DEFAULT_MAP_ZOOM)} />
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">API key configured</p>
                <Badge className={apiKeyConfigured ? "mt-1 bg-success/10 text-success" : "mt-1 bg-destructive/10 text-destructive"}>
                  {apiKeyConfigured ? "Yes" : "No"}
                </Badge>
              </div>
              <InfoRow label="API key masked" value={apiKeyConfigured ? maskGeoapifyKey() : "Not configured"} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Required env values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                {[
                  "VITE_MAP_PROVIDER",
                  "VITE_GEOAPIFY_API_KEY",
                  "VITE_DEFAULT_MAP_LAT",
                  "VITE_DEFAULT_MAP_LNG",
                  "VITE_DEFAULT_MAP_ZOOM",
                ].map((key) => (
                  <code key={key} className="rounded-lg border bg-muted px-3 py-2 text-xs">
                    {key}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Endpoint templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Endpoint label="Map Tiles" value={GEOAPIFY_TILE_URL.replace(GEOAPIFY_API_KEY, "<apiKey>")} />
              <Endpoint label="Geocoding" value={buildGeocodeUrl("Quận 1, TP.HCM").replace(GEOAPIFY_API_KEY, "<apiKey>")} />
              <Endpoint label="Reverse Geocoding" value={buildReverseGeocodeUrl(10.7769, 106.7009).replace(GEOAPIFY_API_KEY, "<apiKey>")} />
              <Endpoint label="Autocomplete" value={buildAutocompleteUrl("Nguyễn Huệ").replace(GEOAPIFY_API_KEY, "<apiKey>")} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">.env.local sample</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs text-foreground">
                <code>{sampleEnv}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}

function Endpoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-1 text-sm font-medium text-foreground">{label}</p>
      <code className="block break-all rounded-lg bg-muted p-2 text-xs text-muted-foreground">{value}</code>
    </div>
  );
}
