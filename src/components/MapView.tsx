import React, { useEffect, useRef } from 'react';
import { Property, Language } from '../types';
import L from 'leaflet';

interface MapViewProps {
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
  language: Language;
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  language,
  center = [33.5731, -7.5898], // Default Casablanca
  zoom = 11,
  height = '500px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: L.latLng(center[0], center[1]),
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup if container is unmounted
    };
  }, []);

  // Update center when center prop changes or selectedProperty changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (selectedProperty) {
      mapInstanceRef.current.setView([selectedProperty.lat, selectedProperty.lng], 14, {
        animate: true
      });
    } else if (properties.length > 0) {
      // Fit bounds to all properties
      const bounds = L.latLngBounds(properties.map(p => [p.lat, p.lng]));
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [properties, selectedProperty]);

  // Redraw markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    properties.forEach(prop => {
      const isSelected = selectedProperty?.id === prop.id;
      
      const priceLabel = language === 'ar' 
        ? prop.priceFormattedAr 
        : language === 'en' && prop.priceFormattedEn 
        ? prop.priceFormattedEn 
        : prop.priceFormattedFr;

      const customHtml = `
        <div class="cursor-pointer transition-transform transform hover:scale-110 ${
          isSelected ? 'scale-110 z-50' : ''
        }">
          <div class="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1 ${
            isSelected ? 'bg-[#ff6f61] ring-4 ring-white ring-opacity-80' : 'bg-[#281715] hover:bg-[#ff6f61]'
          }">
            <span>${priceLabel}</span>
          </div>
          <div class="w-2 h-2 bg-[#281715] rotate-45 mx-auto -mt-1 ${isSelected ? '!bg-[#ff6f61]' : ''}"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-map-price-marker',
        html: customHtml,
        iconSize: [110, 36],
        iconAnchor: [55, 36]
      });

      const marker = L.marker([prop.lat, prop.lng], { icon: customIcon });

      marker.on('click', () => {
        onSelectProperty(prop);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [properties, selectedProperty, language, onSelectProperty]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-inner border border-[#f0e4e2] bg-[#fff8f7]">
      <div ref={mapContainerRef} style={{ height }} className="w-full z-10" />
      
      {/* Map Helper overlay badge */}
      <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold text-[#281715] shadow-sm border border-[#e8d5d3] flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#ff6f61] animate-pulse"></span>
        <span>{properties.length} {language === 'ar' ? 'عقار على الخريطة' : language === 'en' ? 'properties on map' : 'biens affichés'}</span>
      </div>
    </div>
  );
};
