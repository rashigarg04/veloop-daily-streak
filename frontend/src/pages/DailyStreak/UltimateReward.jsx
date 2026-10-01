import { Lock } from "lucide-react";
import styles from "./DailyStreak.module.css";
import { ASSET_ICON } from "./rewardAssets";

export default function UltimateReward({ ultimateReward }) {
  const isUnlocked = ultimateReward.status === "CLAIMED";

  return (
    <div className={styles.ultimate}>
      <div className={styles.ultimateLeft}>
        <div className={styles.ultimateCrown}>
          <span style={{ fontSize: "2.4rem" }}>{ASSET_ICON[ultimateReward.assetType]}</span>
        </div>
        <div>
          <p className={styles.ultimateLabel}>Ultimate Reward</p>
          <p className={styles.ultimateAmount}>₹{ultimateReward.amount}</p>
          <p className={styles.ultimateSubtitle}>🅰️ {ultimateReward.subtitle}</p>
        </div>
      </div>
      <div className={styles.ultimateRight}>
        {!isUnlocked && (
          <div className={styles.ultimateLockIcon}>
            <Lock size={18} color="#a78bfa" />
          </div>
        )}
        <span>
          {isUnlocked ? "Unlocked!" : <>Unlock on <span className={styles.ultimateUnlockDay}>Day {ultimateReward.unlockDay}</span></>}
        </span>
      </div>
    </div>
  );
}