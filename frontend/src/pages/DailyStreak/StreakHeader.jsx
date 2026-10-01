import { ChevronLeft, Flame, Gem } from "lucide-react";
import styles from "./DailyStreak.module.css";

export default function StreakHeader({ currentStreak, wallet, onBack }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <button className={styles.backButton} onClick={onBack} aria-label="Go back">
          <ChevronLeft size={20} />
        </button>
        <div className={styles.headerTitle}>
          Daily Streak <Flame size={20} color="#f0b429" fill="#f0b429" />
        </div>
      </div>
      <div className={styles.gemBalance}>
        <Gem size={16} color="#a78bfa" />
        {wallet.ves}
      </div>
    </div>
  );
}