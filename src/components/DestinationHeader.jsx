import { ArrowLeft, Compass, Search, LogOut } from "lucide-react";

const destinationIcons = { explore: Compass, search: Search };

export default function DestinationHeader({ title, subtitle, variant, onBack, onLogout }) {
  const Icon = destinationIcons[variant];
  return <header className={`destination-header${variant === "explore" ? " destination-header-explore" : ""}`}><button className="destination-header-back" type="button" onClick={onBack} aria-label="Back to feed" title="Back to feed"><ArrowLeft size={19} aria-hidden="true" /></button>{Icon && variant !== "explore" && <span className="destination-header-icon" aria-hidden="true"><Icon size={20} /></span>}<div className="destination-header-copy"><h1>{title}</h1><p>{subtitle}</p></div>{variant !== "explore" && <button className="destination-header-logout" type="button" onClick={onLogout} aria-label="Log out" title="Log out"><LogOut size={18} aria-hidden="true" /><span>Log out</span></button>}</header>;
}
