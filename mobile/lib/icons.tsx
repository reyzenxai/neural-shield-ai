import React from "react";
import { Feather, Ionicons } from "@expo/vector-icons";

type FeatherName = React.ComponentProps<typeof Feather>["name"];
type IonName     = React.ComponentProps<typeof Ionicons>["name"];
type P = { size?: number; color?: string; strokeWidth?: number; fill?: string };

function makeFeather(name: FeatherName) {
  return function Icon({ size = 24, color = "#fff" }: P) {
    return <Feather name={name} size={size} color={color} />;
  };
}

function makeIon(name: IonName) {
  return function Icon({ size = 24, color = "#fff" }: P) {
    return <Ionicons name={name} size={size} color={color} />;
  };
}

export const Shield        = makeFeather("shield");
export const ShieldCheck   = makeFeather("shield");
export const ShieldAlert   = makeFeather("alert-circle");
export const Clock         = makeFeather("clock");
export const User          = makeFeather("user");
export const Mail          = makeFeather("mail");
export const Lock          = makeFeather("lock");
export const ArrowRight    = makeFeather("arrow-right");
export const ArrowLeft     = makeFeather("arrow-left");
export const Chrome        = makeFeather("chrome");
export const MessageSquare = makeFeather("message-square");
export const Phone         = makeFeather("phone");
export const Link2         = makeFeather("link");
export const CreditCard    = makeFeather("credit-card");
export const ImageIcon     = makeFeather("image");
export const Zap           = makeFeather("zap");
export const Share2        = makeFeather("share-2");
export const AlertTriangle = makeFeather("alert-triangle");
export const CheckCircle   = makeFeather("check-circle");
export const XCircle       = makeFeather("x-circle");
export const Search        = makeFeather("search");
export const ChevronRight  = makeFeather("chevron-right");
export const LogOut        = makeFeather("log-out");
export const Settings      = makeFeather("settings");
export const Bell          = makeFeather("bell");
export const HelpCircle    = makeFeather("help-circle");
export const Star          = makeFeather("star");
export const Activity      = makeFeather("activity");
export const Wifi          = makeFeather("wifi");
export const Home          = makeFeather("home");
export const X             = makeFeather("x");
export const BarChart2     = makeFeather("bar-chart-2");
export const TrendingUp    = makeFeather("trending-up");
export const Calendar      = makeFeather("calendar");
export const Crown         = makeIon("diamond-outline");
export const QrCode        = makeIon("qr-code-outline");
export const Flag          = makeFeather("flag");
export const MapPin        = makeFeather("map-pin");
export const Edit3         = makeFeather("edit-3");
export const ChevronDown   = makeFeather("chevron-down");
export const Eye           = makeFeather("eye");
export const EyeOff        = makeFeather("eye-off");
export const RefreshCw     = makeFeather("refresh-cw");
export const Send          = makeFeather("send");
export const Globe         = makeFeather("globe");
export const Download      = makeFeather("download");
export const Trash2        = makeFeather("trash-2");
export const Users         = makeFeather("users");
