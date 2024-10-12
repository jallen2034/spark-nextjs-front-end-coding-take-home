// Define bounds for the Lower Mainland (northwest and southeast corners).
import { Property, ResaleDataFromAPI } from "@/app/map/types";
import {
  Feature, GeoJSONFeatureCollection, NewWindowPointers, SlidingWindowPointers,
} from "@/app/shared-components/react-mapbox/types";
import { RefObject } from "react";
import { MapRef } from "react-map-gl";
import bbox from "@turf/bbox";
import { MapMouseEvent } from "mapbox-gl"; // Import the bbox utility to calculate bounding boxes.

const lowerMainlandBounds: [number, number, number, number] = [
  -123.6,
  49.0, // Southwest bound (longitude, latitude)
  -121.8,
  49.6, // Northeast bound (longitude, latitude) - Extended
];

/* Helper function to take in our CSV data from the API on page load
 * and convert it into  an array of markers to render on the map. */
const generateGeoJsonDataFromMemoizedRecords = (
  memoizedRecords: ResaleDataFromAPI,
  selectedPropertyId: string | null,
): GeoJSONFeatureCollection => {
  const features: Feature[] = memoizedRecords.map((property: Property) => {
    const { longitude, latitude, id }: Property = property;

    // Determine icon size based on whether the property is selected
    const isSelected: boolean = selectedPropertyId === id;

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      properties: {
        ...property,
        isSelected,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  };
};

// Helper function to take the ref to the map and zoom the map to the selected property.
const zoomToSelectedProperty = (
  selectedFeature: Feature,
  mapRef: RefObject<MapRef>,
): void => {
  if (selectedFeature && mapRef.current) {
    // @ts-expect-error: todo: fix this TS error with bbox wanting a correct Feature type def.
    const [minLng, minLat, maxLng, maxLat] = bbox(selectedFeature);
    
    // Fit the map to the bounding box.
    mapRef.current.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 40, duration: 1000 },
    );
  }
};

/* Calculates new indices for a sliding window of visible features based on the index of the clicked property in the features array.
 * This function adjusts the currently displayed features in the UI when a property is clicked on the map, ensuring that the selected
 * feature is included within the visible range. If the clicked property falls within the indices (0-9) of the current window,
 * the window remains unchanged. If the clicked property is located outside this range, the window shifts to include it; for instance,
 * if the clicked property is at index 24, the window will move to display properties from indices 20 to 29.
 * This approach is used instead of rendering all properties in the list (over 4000 in total), which would lead to performance issues
 * in the UI. By maintaining a sliding window of visible features, we optimize rendering and ensure a smoother user experience. */
const calculateWindowLocationWhenMarkerClicked = (
  id: string | null,
  features: Feature[],
  maxVisibleFeatures: number
): NewWindowPointers | undefined => {
  // Find the index of the clicked marker in the features list.
  const clickedFeatureIndex: number = features.findIndex(
    (feature: Feature) => feature.properties.id === id
  );
  
  if (clickedFeatureIndex === -1) return; // Feature not found
  
  // Calculate new indices  in the sliding window.
  const newLeftIdx: number = Math.max(
    Math.floor(clickedFeatureIndex / maxVisibleFeatures) * maxVisibleFeatures,
    0
  );
  
  const newRightIdx: number = Math.min(
    newLeftIdx + maxVisibleFeatures - 1,
    features.length - 1
  );
  
  return { newLeftIdx, newRightIdx };
};

const setupMapListeners = (
  map: MapRef,
  setSelectedPropertyToLocateOnMap: (id: string) => void
) => {
  const handleMarkerClickListener = (e: MapMouseEvent): void => {
    if (!e.features) return;
    const properties: Property = e.features[0].properties as Property;
    const { id }: Property = properties;
    setSelectedPropertyToLocateOnMap(id); // Set the clicked marker's ID to be the selected property on the map.
  };
  
  const handleMouseHoverListener = (): void => {
    map.getCanvas().style.cursor = "pointer"; // Change cursor to pointer
  };
  
  const handleMouseLeaveListener = (): void => {
    map.getCanvas().style.cursor = ""; // Reset cursor style.
    // @ts-ignore
    map.off("mouseenter", "unclustered-point"); // Clean up mouse enter listener.
    // @ts-ignore
    map.off("mouseleave", "unclustered-point"); // Clean up mouse leave listener.
  };
  
  // Attach event listeners to the map ref.
  map.on("click", "unclustered-point", handleMarkerClickListener);
  map.on("mouseenter", "unclustered-point", handleMouseHoverListener);
  map.on("mouseleave", "unclustered-point", handleMouseLeaveListener);
  
  // Return cleanup function
  return () => {
    // @ts-ignore
    map.off("click", "unclustered-point");
    // @ts-ignore
    map.off("mouseenter", "unclustered-point");
    // @ts-ignore
    map.off("mouseleave", "unclustered-point");
  };
};

export {
  lowerMainlandBounds,
  generateGeoJsonDataFromMemoizedRecords,
  zoomToSelectedProperty,
  setupMapListeners,
  calculateWindowLocationWhenMarkerClicked
};
