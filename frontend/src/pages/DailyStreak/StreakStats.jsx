import { Calendar, CheckCircle2, Star } from "lucide-react";
import styles from "./DailyStreak.module.css";

function formatNextReward(nextReward) {
  if (!nextReward) return "—";
  const prefix = nextReward.currency === "VES" ? "+" : "";
  const suffix = nextReward.currency === "VES" ? " VEs" : "";
  const amountDisplay = nextReward.currency === "INR" ? `₹${nextReward.amount}` : `${nextReward.amount}`;
  return `${prefix}${amountDisplay}${suffix}`;
}

export default function StreakStats({ streak }) {
  return (
    <div className={styles.statsRow}>
      <div className={styles.statCard}>
        <div className={`${styles.statIconWrap} ${styles.statIconPurple}`}>
          <Calendar size={18} color="#a78bfa" />
        </div>
        <div>
          <div className={styles.statLabel}>Total Rewards</div>
          <div className={styles.statValue}>{streak.totalRewards}</div>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={`${styles.statIconWrap} ${styles.statIconGreen}`}>
          <CheckCircle2 size={18} color="#4ade80" />
        </div>
        <div>
          <div className={styles.statLabel}>Checked In</div>
          <div className={styles.statValue}>{streak.checkedIn}</div>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={`${styles.statIconWrap} ${styles.statIconGold}`}>
          <Star size={18} color="#f0b429" />
        </div>
        <div>
          <div className={styles.statLabel}>Next Reward</div>
          <div className={styles.statValue}>{formatNextReward(streak.nextReward)}</div>
        </div>
      </div>
    </div>
  );
}