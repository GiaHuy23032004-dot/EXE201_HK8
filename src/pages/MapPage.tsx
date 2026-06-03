import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Crosshair,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type Course, useCourses } from "@/hooks/use-courses";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  GEOAPIFY_API_KEY,
  GEOAPIFY_TILE_URL,
  buildAutocompleteUrl,
  buildGeocodeUrl,
  buildReverseGeocodeUrl,
} from "@/config/map";
import { getDistanceKm } from "@/lib/distance";

const FOCUS_ZOOM = 15;
const RADIUS_FILTERS = [
  { label: "Tất cả", value: "all" },
  { label: "Trong 3km", value: "3" },
  { label: "Trong 5km", value: "5" },
  { label: "Trong 10km", value: "10" },
] as const;

type RadiusFilter = (typeof RADIUS_FILTERS)[number]["value"];
type LocationSource = "current" | "address";
type ActiveLocation = { lat: number; lng: number; label: string; source: LocationSource };
type CourseWithDistance = Course & { distanceKm?: number };
type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    lat?: number;
    lon?: number;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

const courseIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:999px;background:linear-gradient(135deg,#0ea5e9,#14b8a6);box-shadow:0 12px 30px rgba(14,165,233,.35);border:3px solid white;color:white;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

const selectedCourseIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;height:42px;width:42px;align-items:center;justify-content:center;border-radius:999px;background:linear-gradient(135deg,#f59e0b,#ef4444);box-shadow:0 14px 34px rgba(239,68,68,.35);border:4px solid white;color:white;">
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42],
});

const userIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;height:28px;width:28px;">
    <div style="position:absolute;inset:0;border-radius:999px;background:rgba(20,184,166,.18);"></div>
    <div style="position:absolute;left:6px;top:6px;height:16px;width:16px;border-radius:999px;background:#14b8a6;border:3px solid white;box-shadow:0 8px 22px rgba(20,184,166,.45);"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const searchIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:999px;background:#f59e0b;box-shadow:0 10px 24px rgba(245,158,11,.35);border:3px solid white;color:white;">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

function hasCoordinates<T extends Course>(course: T): course is T & { latitude: number; longitude: number } {
  return typeof course.latitude === "number" && typeof course.longitude === "number";
}

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function courseMatchesSearch(course: Course, term: string) {
  if (!term) return true;
  const haystack = [course.title, course.location, course.category, course.mentor?.name].map(normalize).join(" ");
  return haystack.includes(normalize(term));
}

function formatPrice(value: number) {
  return `${value.toLocaleString("vi-VN")}đ/buổi`;
}

function getFeatureLabel(feature: GeoapifyFeature) {
  return (
    feature.properties?.formatted ||
    [feature.properties?.address_line1, feature.properties?.address_line2].filter(Boolean).join(", ") ||
    "Vị trí đã chọn"
  );
}

function getFeaturePoint(feature: GeoapifyFeature): Omit<ActiveLocation, "source"> | null {
  const lat = feature.properties?.lat;
  const lon = feature.properties?.lon;
  if (typeof lat === "number" && typeof lon === "number") {
    return { lat, lng: lon, label: getFeatureLabel(feature) };
  }

  const [lngFromGeometry, latFromGeometry] = feature.geometry?.coordinates ?? [];
  if (typeof latFromGeometry === "number" && typeof lngFromGeometry === "number") {
    return { lat: latFromGeometry, lng: lngFromGeometry, label: getFeatureLabel(feature) };
  }

  return null;
}

async function fetchGeoapifyFeatures(url: string, signal?: AbortSignal): Promise<GeoapifyFeature[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Geoapify request failed");
  const data = (await response.json()) as { features?: GeoapifyFeature[] };
  return data.features ?? [];
}

function getLocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Bạn đã từ chối quyền vị trí. Hãy nhập khu vực thủ công để tìm lớp học gần bạn.";
  }
  if (error.code === error.TIMEOUT) {
    return "Không thể lấy vị trí trong thời gian cho phép. Bạn có thể nhập khu vực thủ công để tiếp tục.";
  }
  return "Vị trí hiện tại chưa sẵn sàng. Bạn có thể nhập khu vực thủ công để tìm lớp học gần bạn.";
}

function MapFocusController({
  activeLocation,
  visibleCourses,
  focusedCourse,
}: {
  activeLocation: ActiveLocation | null;
  visibleCourses: CourseWithDistance[];
  focusedCourse: CourseWithDistance | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusedCourse && hasCoordinates(focusedCourse)) {
      map.flyTo([focusedCourse.latitude, focusedCourse.longitude], FOCUS_ZOOM, { duration: 0.7 });
      return;
    }

    if (!activeLocation) return;

    const boundsPoints: [number, number][] = [
      [activeLocation.lat, activeLocation.lng],
      ...visibleCourses
        .filter(hasCoordinates)
        .map((course): [number, number] => [course.latitude, course.longitude]),
    ];

    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), {
        padding: [60, 60],
        maxZoom: FOCUS_ZOOM,
      });
      return;
    }

    map.flyTo([activeLocation.lat, activeLocation.lng], 14, { duration: 0.7 });
  }, [activeLocation, focusedCourse, map, visibleCourses]);

  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialLocation = searchParams.get("location") ?? "";
  const { data: allCourses = [], isLoading, isError, error } = useCourses({ format: "offline" });
  const [searchInput, setSearchInput] = useState(initialLocation);
  const [fallbackSearchTerm, setFallbackSearchTerm] = useState("");
  const [radius, setRadius] = useState<RadiusFilter>("all");
  const [userLocation, setUserLocation] = useState<ActiveLocation | null>(null);
  const [activeSearchLocation, setActiveSearchLocation] = useState<ActiveLocation | null>(null);
  const [isLocationConsentOpen, setIsLocationConsentOpen] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<GeoapifyFeature[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const initialSearchHandledRef = useRef(false);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const hasGeoapifyKey = Boolean(GEOAPIFY_API_KEY);
  const isFallbackTextSearch = Boolean(fallbackSearchTerm.trim());
  const activeOrigin = isFallbackTextSearch ? null : activeSearchLocation ?? userLocation;
  const activeLocationSource = activeOrigin?.source ?? null;

  useEffect(() => {
    if (initialSearchHandledRef.current || !initialLocation.trim()) return;
    initialSearchHandledRef.current = true;
    void geocodeText(initialLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocation]);

  useEffect(() => {
    const term = searchInput.trim();
    autocompleteAbortRef.current?.abort();

    if (!hasGeoapifyKey || term.length < 3) {
      setAutocompleteOptions([]);
      setAutocompleteLoading(false);
      return;
    }

    const controller = new AbortController();
    autocompleteAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const features = await fetchGeoapifyFeatures(buildAutocompleteUrl(term), controller.signal);
        setAutocompleteOptions(features);
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
          setAutocompleteOptions([]);
        }
      } finally {
        setAutocompleteLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [hasGeoapifyKey, searchInput]);

  const coursesWithDistance = useMemo<CourseWithDistance[]>(() => {
    return allCourses
      .filter((course) => course.format === "offline")
      .map((course) => {
        if (!activeOrigin || !hasCoordinates(course)) return course;
        return {
          ...course,
          distanceKm: getDistanceKm(activeOrigin.lat, activeOrigin.lng, course.latitude, course.longitude),
        };
      });
  }, [activeOrigin, allCourses]);

  const filteredCourses = useMemo(() => {
    const radiusNumber = radius === "all" ? null : Number(radius);

    return coursesWithDistance
      .filter((course) => {
        if (fallbackSearchTerm) return courseMatchesSearch(course, fallbackSearchTerm);
        if (activeOrigin) return hasCoordinates(course);
        return true;
      })
      .filter((course) => {
        if (!radiusNumber || !activeOrigin) return true;
        return typeof course.distanceKm === "number" && course.distanceKm <= radiusNumber;
      })
      .sort((a, b) => {
        if (!activeOrigin) return Number(b.is_promoted) - Number(a.is_promoted);
        const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      });
  }, [activeOrigin, coursesWithDistance, fallbackSearchTerm, radius]);

  const markerCourses = useMemo(() => filteredCourses.filter(hasCoordinates), [filteredCourses]);
  const selectedCourse = filteredCourses.find((course) => course.id === selectedCourseId) ?? null;

  const applyAddressPoint = (point: Omit<ActiveLocation, "source">) => {
    const location: ActiveLocation = { ...point, source: "address" };
    setActiveSearchLocation(location);
    setSearchInput(location.label);
    setFallbackSearchTerm("");
    setAutocompleteOptions([]);
    setSelectedCourseId(null);
  };

  async function geocodeText(text: string) {
    const term = text.trim();
    setAutocompleteOptions([]);
    setSelectedCourseId(null);

    if (!term) {
      setActiveSearchLocation(null);
      setFallbackSearchTerm("");
      setRadius("all");
      return;
    }

    if (!hasGeoapifyKey) {
      setActiveSearchLocation(null);
      setFallbackSearchTerm(term);
      toast({
        title: "Thiếu cấu hình Geoapify API key",
        description: "VET sẽ tìm theo nội dung địa chỉ trong danh sách khóa học.",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const features = await fetchGeoapifyFeatures(buildGeocodeUrl(term));
      const point = features.map(getFeaturePoint).find(Boolean);
      if (!point) {
        setActiveSearchLocation(null);
        setFallbackSearchTerm(term);
        toast({
          title: "Không tìm thấy tọa độ khu vực này",
          description: "VET sẽ tìm theo nội dung địa chỉ.",
        });
        return;
      }

      applyAddressPoint(point);
      toast({ title: `Đang tìm lớp gần: ${point.label}` });
    } catch {
      setActiveSearchLocation(null);
      setFallbackSearchTerm(term);
      toast({
        title: "Không thể tìm tọa độ khu vực này",
        description: "VET sẽ tìm theo nội dung địa chỉ.",
      });
    } finally {
      setIsGeocoding(false);
    }
  }

  const requestCurrentLocation = () => {
    setIsLocationConsentOpen(true);
  };

  const confirmCurrentLocation = () => {
    setIsLocationConsentOpen(false);

    if (!navigator.geolocation) {
      toast({
        title: "Trình duyệt chưa hỗ trợ định vị",
        description: "Bạn có thể nhập khu vực thủ công để tìm lớp học gần bạn.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point: ActiveLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Vị trí hiện tại",
          source: "current",
        };

        let formattedAddress = "";
        if (hasGeoapifyKey) {
          try {
            const features = await fetchGeoapifyFeatures(buildReverseGeocodeUrl(point.lat, point.lng));
            formattedAddress = features[0] ? getFeatureLabel(features[0]) : "";
          } catch {
            formattedAddress = "";
          }
        }

        const nextLocation = { ...point, label: formattedAddress || point.label };
        setUserLocation(nextLocation);
        setActiveSearchLocation(nextLocation);
        setFallbackSearchTerm("");
        setSearchInput("");
        setAutocompleteOptions([]);
        setSelectedCourseId(null);
        setIsGettingLocation(false);
        toast({ title: "Đã dùng vị trí hiện tại để sắp xếp lớp học gần bạn." });
      },
      (locationError) => {
        setIsGettingLocation(false);
        toast({
          title: "Không thể lấy vị trí",
          description: getLocationErrorMessage(locationError),
          variant: locationError.code === locationError.PERMISSION_DENIED ? "destructive" : "default",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchInput.trim();
    if (activeSearchLocation?.source === "address" && normalize(activeSearchLocation.label) === normalize(term)) {
      setFallbackSearchTerm("");
      return;
    }
    void geocodeText(term);
  };

  const clearSearch = () => {
    setSearchInput("");
    setFallbackSearchTerm("");
    setAutocompleteOptions([]);
    setActiveSearchLocation(null);
    setRadius("all");
    setSelectedCourseId(null);
  };

  const activeStatusText =
    activeLocationSource === "current"
      ? activeOrigin?.label && activeOrigin.label !== "Vị trí hiện tại"
        ? `Bạn đang ở gần: ${activeOrigin.label}`
        : "Đang tìm lớp gần vị trí hiện tại"
      : activeLocationSource === "address"
        ? `Đang tìm lớp gần: ${activeOrigin?.label}`
        : fallbackSearchTerm
          ? `Đang tìm theo nội dung địa chỉ: ${fallbackSearchTerm}`
          : "Hiển thị các lớp offline trên bản đồ";

  const distancePrefix = activeLocationSource === "address" ? "Cách khu vực tìm kiếm" : "Cách bạn";
  const showUserMarker = activeLocationSource === "current" && userLocation;
  const showAddressMarker = activeLocationSource === "address" && activeOrigin;

  return (
    <MainLayout hideFooter>
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background lg:flex-row">
        <aside className="flex h-[48vh] min-h-0 w-full flex-col border-b bg-card lg:h-full lg:w-[430px] lg:border-b-0 lg:border-r">
          <div className="space-y-4 border-b p-4">
            <div className="flex items-center gap-2">
              <Link to="/search">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-foreground">Lớp học gần bạn</h1>
                <p className="text-xs text-muted-foreground">
                  Khám phá khóa học offline quanh khu vực bạn quan tâm.
                </p>
              </div>
            </div>

            {!hasGeoapifyKey && (
              <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Thiếu cấu hình Geoapify API key.</p>
                  <p>Thêm `VITE_GEOAPIFY_API_KEY` để dùng bản đồ, autocomplete và geocoding.</p>
                </div>
              </div>
            )}

            <form onSubmit={submitSearch} className="space-y-2">
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => {
                      setSearchInput(event.target.value);
                      if (!event.target.value.trim()) setFallbackSearchTerm("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setAutocompleteOptions([]);
                    }}
                    placeholder="Nhập quận, đường hoặc khu vực..."
                    className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                  {(isGeocoding || autocompleteLoading) && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {searchInput && !isGeocoding && !autocompleteLoading && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        setAutocompleteOptions([]);
                      }}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Xóa nội dung nhập"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {autocompleteOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[700] mt-2 max-h-72 overflow-y-auto rounded-xl border bg-popover shadow-elevated">
                    {autocompleteOptions.map((feature, index) => {
                      const label = getFeatureLabel(feature);
                      const point = getFeaturePoint(feature);
                      return (
                        <button
                          key={`${label}-${index}`}
                          type="button"
                          disabled={!point}
                          onClick={() => point && applyAddressPoint(point)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="line-clamp-2">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isGeocoding || !searchInput.trim()}
                  className="rounded-xl"
                >
                  {isGeocoding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Tìm khu vực
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!searchInput && !activeSearchLocation && !fallbackSearchTerm}
                  onClick={clearSearch}
                  className="rounded-xl"
                >
                  <X className="mr-2 h-4 w-4" />
                  Xóa tìm kiếm
                </Button>
              </div>
            </form>

            <div className="grid gap-3">
              <Button
                type="button"
                onClick={requestCurrentLocation}
                disabled={isGettingLocation}
                className="rounded-xl border-0 gradient-primary text-primary-foreground"
              >
                {isGettingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                {isGettingLocation ? "Đang lấy vị trí..." : "Dùng vị trí của tôi"}
              </Button>

              {isLocationConsentOpen && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm shadow-sm">
                  <p className="font-semibold text-foreground">
                    Cho phép VET dùng vị trí hiện tại để tìm lớp gần bạn?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    VET sẽ dùng vị trí của bạn để gợi ý các lớp học offline gần nhất. Bạn có thể từ chối và nhập khu vực thủ công.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setIsLocationConsentOpen(false)}
                    >
                      Không
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl border-0 gradient-primary text-primary-foreground"
                      onClick={confirmCurrentLocation}
                    >
                      Đồng ý
                    </Button>
                  </div>
                </div>
              )}

              {activeStatusText && (
                <div className="rounded-xl border bg-primary/5 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{activeStatusText}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {RADIUS_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      disabled={item.value !== "all" && !activeOrigin}
                      onClick={() => setRadius(item.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        radius === item.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {!activeOrigin && (
                  <p className="text-xs text-muted-foreground">
                    Bật vị trí hoặc nhập khu vực để lọc theo khoảng cách.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="space-y-2 p-5 text-sm">
                <p className="font-medium text-destructive">Không thể tải danh sách lớp học.</p>
                <p className="text-muted-foreground">{error instanceof Error ? error.message : "Vui lòng thử lại sau."}</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <MapPin className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium text-foreground">Chưa tìm thấy lớp học gần khu vực này.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Thử đổi từ khóa, nhập khu vực khác hoặc mở rộng bán kính tìm kiếm.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredCourses.map((course) => {
                  const courseHasCoordinates =
                    typeof course.latitude === "number" && typeof course.longitude === "number";

                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        if (!courseHasCoordinates) navigate(`/course/${course.id}`);
                      }}
                      className={`flex w-full gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${
                        selectedCourseId === course.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <img
                        src={course.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=200&fit=crop"}
                        alt={course.title}
                        className="h-20 w-20 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="line-clamp-2 text-sm font-semibold text-card-foreground">{course.title}</h2>
                          <Badge variant="outline" className="shrink-0 rounded-full border-primary/20 bg-primary/5 text-[10px] text-primary">
                            Offline
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{course.mentor?.name || "Mentor"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-warning text-warning" />
                            {course.rating}
                          </span>
                          {typeof course.distanceKm === "number" && (
                            <span className="flex items-center gap-1">
                              <Crosshair className="h-3 w-3" />
                              {distancePrefix} {course.distanceKm.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{course.location || "Chưa có địa chỉ"}</p>
                        <p className="mt-1 text-sm font-bold text-primary">{formatPrice(course.price)}</p>
                        {!courseHasCoordinates && (
                          <p className="mt-1 text-xs text-warning">Chưa có tọa độ, mở chi tiết để xem thêm.</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="relative min-h-[52vh] flex-1 bg-muted lg:min-h-0">
          <MapContainer center={DEFAULT_MAP_CENTER} zoom={DEFAULT_MAP_ZOOM} scrollWheelZoom className="h-full w-full">
            {hasGeoapifyKey && (
              <TileLayer
                attribution='&copy; <a href="https://www.geoapify.com/">Geoapify</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url={GEOAPIFY_TILE_URL}
              />
            )}
              <MapFocusController
                activeLocation={selectedCourse ? null : activeOrigin}
                visibleCourses={markerCourses}
                focusedCourse={selectedCourse}
              />

              {showUserMarker && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                  <Popup>
                    <p className="text-sm font-semibold">Vị trí của bạn</p>
                    <p className="mt-1 text-xs text-muted-foreground">{userLocation.label}</p>
                  </Popup>
                </Marker>
              )}

              {showAddressMarker && (
                <Marker position={[activeOrigin.lat, activeOrigin.lng]} icon={searchIcon}>
                  <Popup>
                    <p className="text-sm font-semibold">Khu vực đang tìm</p>
                    <p className="mt-1 text-xs text-muted-foreground">{activeOrigin.label}</p>
                  </Popup>
                </Marker>
              )}

              {markerCourses.map((course) => (
                <Marker
                  key={course.id}
                  position={[course.latitude, course.longitude]}
                  icon={course.id === selectedCourseId ? selectedCourseIcon : courseIcon}
                  eventHandlers={{ click: () => setSelectedCourseId(course.id) }}
                >
                  <Popup minWidth={230}>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-foreground">{course.title}</p>
                        <p className="text-xs text-muted-foreground">{course.mentor?.name || "Mentor"}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span>{course.rating}</span>
                        {typeof course.distanceKm === "number" && <span>· {course.distanceKm.toFixed(1)} km</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{course.location || "Chưa có địa chỉ"}</p>
                      <p className="font-bold text-primary">{formatPrice(course.price)}</p>
                      <Button size="sm" className="w-full rounded-xl" onClick={() => navigate(`/course/${course.id}`)}>
                        Xem chi tiết
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>

          {!hasGeoapifyKey && (
            <div className="absolute left-4 right-4 top-4 z-[500] rounded-2xl border border-warning/30 bg-card/95 p-4 text-sm shadow-card backdrop-blur md:left-auto md:max-w-md">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <h2 className="font-semibold text-foreground">Thiếu cấu hình Geoapify API key.</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Thêm `VITE_GEOAPIFY_API_KEY` vào `.env.local` để tải bản đồ Geoapify và dùng geocoding.
                </p>
                {import.meta.env.DEV && (
                  <Button className="mt-4 rounded-xl" variant="outline" onClick={() => navigate("/dev/map-config")}>
                    Xem cấu hình map
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2">
            <Badge className="bg-card px-4 py-2 text-card-foreground shadow-elevated">
              <MapPin className="mr-2 h-4 w-4 text-primary" />
              {markerCourses.length} lớp có marker · {filteredCourses.length} lớp trong danh sách
            </Badge>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
