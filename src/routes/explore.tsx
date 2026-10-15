import { createFileRoute } from "@tanstack/react-router";
import { Explore } from "./index";
export const Route=createFileRoute("/explore")({head:()=>({meta:[{title:"Earth Explorer — Third Eye"},{name:"description",content:"Explore Earth in 3D or 2D with sample scientific layers."},{property:"og:title",content:"Earth Explorer — Third Eye"},{property:"og:description",content:"Explore Earth in 3D or 2D with sample scientific layers."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Explore});
