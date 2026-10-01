import { Shield } from "lucide-react";
import styles from "./DailyStreak.module.css";

export default function CpaDemo() {
  return (
    <div className={styles.cpaOverlay}>
      <div className={styles.cpaCard}>
        <div className={styles.cpaIconWrap}>
          <Shield size={30} color="#fff" />
        </div>
        <p className={styles.cpaTitle}>Preparing your reward...</p>
        <p className={styles.cpaSubtitle}>Advertisement / Reward Verification</p>
        <p className={styles.cpaPlease}>Please wait...</p>
        <div className={styles.cpaDots}>
          <span className={styles.cpaDot} />
          <span className={styles.cpaDot} />
          <span className={styles.cpaDot} />
        </div>
      </div>
    </div>
  );
}