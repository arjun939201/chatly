
import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";

// CSS cascade contract:
// 1. styles.css and professional-ui.css are legacy/base compatibility layers.
// 2. feature and auth polish files remain scoped compatibility overrides.
// 3. design-tokens.css owns shared tokens and theme bridges.
// 4. 2026 shell, feed/chat, and destination files own new UI refinements.
// Keep this order stable until legacy selectors are migrated and regression-tested.
import "./styles.css";
import "./professional-ui.css";
import "./components/FeedHeader.css";
import "./booster-polish.css";
import "./auth-polish.css";
import "./design-tokens.css";
import "./app-shell-2026.css";
import "./feed-chat-2026.css";
import "./destinations-2026.css";
import "./ui-shell-polish-2026.css";
import "./ui-feed-polish-2026.css";
import "./ui-chat-polish-2026.css";
import "./ui-profile-polish-2026.css";
import "./ui-discovery-polish-2026.css";
import "./ui-notifications-polish-2026.css";
import "./ui-settings-polish-2026.css";
import "./ui-interactions-polish-2026.css";
import "./ui-responsive-polish-2026.css";
import "./feed-scroll-fix.css";
import "./ui-layout-refinement-2026.css";
import "./ui-experience-2026.css";
import "./admin-control-center.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
