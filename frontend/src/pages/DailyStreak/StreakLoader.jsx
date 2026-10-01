import { Flame } from "lucide-react";
import styles from "./DailyStreak.module.css";

export default function StreakLoader() {
  return (
    <div className={styles.loaderScreen}>
      <div className={styles.loaderLogo}>
        <Flame size={34} color="#ffd666" fill="#ffd666" />
      </div>
      <div className={styles.loaderText}>Loading your streak...</div>
    </div>
  );
}