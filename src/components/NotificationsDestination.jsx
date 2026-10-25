import { Bell } from "lucide-react";

export default function NotificationsDestination() {
  return (
    <section className="destination-page notification-destination-page" aria-label="Notification activity">
      <div className="notification-content">
        <section className="notification-feed" aria-label="Recent activity">
          <div className="notification-feed-heading">
            <h2>Activity</h2>
          </div>
          <div className="notification-empty-state" role="status">
            <span className="notification-empty-icon" aria-hidden="true"><Bell size={21} /></span>
            <h3>You’re all caught up</h3>
            <p>When someone interacts with your posts or profile, you’ll see it here.</p>
          </div>
        </section>
      </div>
    </section>
  );
}
