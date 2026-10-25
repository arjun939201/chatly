import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsDestination() {
  return (
    <section className="destination-page notification-destination-page" aria-labelledby="notifications-title">
      <div className="notification-content">
        <header className="notification-page-intro">
          <span className="notification-state-icon" aria-hidden="true"><Bell size={22} /></span>
          <div className="notification-intro-copy">
            <h1 id="notifications-title">Notifications</h1>
            <p>Your recent Chatly activity</p>
          </div>
        </header>
        <section className="notification-feed" aria-label="Recent activity">
          <div className="notification-feed-heading"><h2>Recent activity</h2><span><CheckCheck size={15}/> All caught up</span></div>
          <div className="notification-empty-state" role="status">
            <span className="notification-empty-icon" aria-hidden="true"><Bell size={21}/></span>
            <h3>No new activity</h3>
            <p>When someone interacts with your posts or profile, you’ll see it here.</p>
          </div>
        </section>
      </div>
    </section>
  );
}
