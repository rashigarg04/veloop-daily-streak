import { Gift } from "lucide-react";
import styles from "./DailyStreak.module.css";

export default function HeroBanner() {
  return (
    <div className={styles.hero}>
      <div className={styles.heroIcon}>
        <Gift size={32} color="#fff" />
      </div>
      <div>
        <p className={styles.heroTextTitle}>
          Login Daily &amp; Earn
          <span className={styles.heroTextHighlight}>Bigger Rewards!</span>
        </p>
        <p className={styles.heroSubtext}>
          Maintain your streak and unlock <span className="highlight">exciting rewards</span> every day.
        </p>
      </div>
    </div>
  );
}