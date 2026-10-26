import { ArrowLeft, Compass, Search } from "lucide-react";

const destinationIcons = { explore: Compass, search: Search };

export default function DestinationHeader({ title, subtitle, variant, onBack }) {
  const Icon = destinationIcons[variant];
  return (
    <header className={`destination-header${variant === "explore" ? " destination-header-explore" : variant === "notifications" ? " destination-header-notifications" : ""}`}>
      <button className="destination-header-back" type="button" onClick={onBack} aria-label="Back to feed" title="Back to feed">
        <ArrowLeft size={19} aria-hidden="true" />
      </button>
      {Icon && variant !== "explore" && <span className="destination-header-icon" aria-hidden="true"><Icon size={20} /></span>}
      <div className="destination-header-copy">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
