import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp } from "@/lib/store";
import { circleAOI, makeAOI, polygonAOI, rectangleAOI, type DrawTool } from "@/lib/analysis";
import type { Position } from "geojson";
export default function AreaMap({tool}:{tool:DrawTool|null}) {
 const el=useRef<HTMLDivElement>(null);const mapRef=useRef<maplibregl.Map|null>(null);const points=useRef<Position[]>([]);const toolRef=useRef(tool);const aoi=useApp(s=>s.aoi);const [ready,setReady]=useState(false);
 useEffect(()=>{toolRef.current=tool;points.current=[];if(mapRef.current) mapRef.current.getCanvas().style.cursor=tool?"crosshair":"grab";},[tool]);
 useEffect(()=>{if(!el.current)return;const view=useApp.getState().view;const map=new maplibregl.Map({container:el.current,center:[view.lng,view.lat],zoom:4,style:{version:8,sources:{base:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],tileSize:256,attribution:"Esri, Maxar, Earthstar Geographics"}},layers:[{id:"base",type:"raster",source:"base"}]}});mapRef.current=map;
 map.on('load',()=>{const color=getComputedStyle(document.documentElement).getPropertyValue('--earth-selection').trim();map.addSource('aoi',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'aoi-fill',type:'fill',source:'aoi',paint:{'fill-color':color,'fill-opacity':.15}});map.addLayer({id:'aoi-line',type:'line',source:'aoi',paint:{'line-color':color,'line-width':2}});map.addLayer({id:'aoi-point',type:'circle',source:'aoi',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':color,'circle-radius':6}});setReady(true);});
 map.on('click',e=>{const t=toolRef.current;if(!t)return;const p:Position=[e.lngLat.lng,e.lngLat.lat];if(t==='point'){useApp.getState().setAOI(makeAOI({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}},'Point AOI'));return;}points.current.push(p);if(t==='rectangle'&&points.current.length===2){const first=points.current[0];if(first)useApp.getState().setAOI(rectangleAOI(first,p));points.current=[];}if(t==='circle'&&points.current.length===2){const first=points.current[0];if(first){const km=Math.hypot((p[0]??0)-(first[0]??0),(p[1]??0)-(first[1]??0))*111;useApp.getState().setAOI(circleAOI(first,km));}points.current=[];}if(t==='polygon'&&points.current.length>=3)useApp.getState().setAOI(polygonAOI(points.current));});
 map.on('moveend',()=>{const c=map.getCenter();useApp.getState().syncView({lat:c.lat,lng:c.lng,altitude:Math.pow(2,4-map.getZoom())/4});});return()=>{map.remove();mapRef.current=null;};},[]);
 useEffect(()=>{const map=mapRef.current;if(!map||!ready)return;(map.getSource('aoi') as maplibregl.GeoJSONSource).setData(aoi?.feature??{type:'FeatureCollection',features:[]});},[aoi,ready]);
 return <div className="relative h-[460px] min-h-[320px] border-y border-border"><div ref={el} className="absolute inset-0"/>{tool&&<div className="absolute left-3 top-3 glass px-3 py-2 text-xs">{tool==='polygon'?'POLYGON · select vertices':tool==='point'?'SELECT POINT':`${tool.toUpperCase()} · select two points`}</div>}</div>;
}
