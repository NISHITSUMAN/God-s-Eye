import area from "@turf/area";
import bbox from "@turf/bbox";
import circle from "@turf/circle";
import type { Feature, Geometry, Polygon, Position } from "geojson";
export type DrawTool = "point" | "rectangle" | "polygon" | "circle";
export interface AOI { name:string; feature:Feature<Geometry>; areaKm2:number; bounds:number[]; center:{lat:number;lng:number} }
export interface AnalysisResult { id:string; aoi:AOI; datasets:string[]; start:string; end:string; kind:string; provenance:"sample" }
export const ANALYSIS_CATALOG = ["Change Detection","Difference","Ratio","Anomaly","Trend","Temporal Comparison","Deformation","Soil Moisture","Classification","Surface Change","Before / After","Fire Analysis","Flood Analysis","Landslide Analysis","Agriculture Analysis"];
export function makeAOI(feature:Feature<Geometry>, name="Selected area"):AOI {
 const bounds=bbox(feature); const [west=0,south=0,east=0,north=0]=bounds;
 return {name,feature,areaKm2:area(feature)/1e6,bounds,center:{lng:(west+east)/2,lat:(south+north)/2}};
}
export function rectangleAOI(a:Position,b:Position) { const [x=0,y=0]=a;const [u=0,v=0]=b;return makeAOI({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[[x,y],[u,y],[u,v],[x,v],[x,y]]] }},"Rectangle AOI"); }
export function circleAOI(center:Position,radiusKm:number) {return makeAOI(circle(center,Math.max(.1,radiusKm),{steps:64,units:"kilometers"}),"Circle AOI");}
export function polygonAOI(points:Position[]) { const first=points[0];if(!first || points.length<3) throw new Error("At least three vertices are required.");return makeAOI({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[...points,first]]}} as Feature<Polygon>,"Polygon AOI"); }
export function validateGeometry(value:unknown):Feature<Geometry> {
 if(!value || typeof value!=="object") throw new Error("No valid geographic geometry was found.");
 const record=value as Record<string,unknown>;
 if(record['type']==="FeatureCollection") {const features=record['features'];if(!Array.isArray(features)||!features[0]) throw new Error("The file contains no features.");return validateGeometry(features[0]);}
 if(record['type']==="Feature") return {type:"Feature",properties:{},geometry:validateGeometry(record['geometry']).geometry};
 if(!["Point","Polygon","MultiPolygon","LineString"].includes(String(record['type']))) throw new Error("Supported geometry: point, polygon, multipolygon, or line.");
 const coords=record['coordinates'];let count=0;
 function check(item:unknown):void {if(!Array.isArray(item)) throw new Error("Coordinates must be arrays.");if(typeof item[0]==="number"){const [lng,lat]=item;if(typeof lng!=="number"||typeof lat!=="number"||!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lng)>180||Math.abs(lat)>90) throw new Error("Coordinates must be valid longitude and latitude.");count++;return;}item.forEach(check);}
 check(coords);if(count>10000) throw new Error("Area files are limited to 10,000 vertices.");
 return {type:"Feature",properties:{},geometry:record as unknown as Geometry};
}
