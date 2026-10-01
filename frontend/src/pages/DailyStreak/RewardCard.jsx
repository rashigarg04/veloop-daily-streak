import { useEffect, useState } from "react";
import { Lock, Check, X, ChevronRight } from "lucide-react";
import styles from "./DailyStreak.module.css";
import { ASSET_ICON, formatRewardAmount, formatRewardSubtitle } from "./rewardAssets";

function useCountdown(nextClaimAt, onFinished) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!nextClaimAt) {
      setLabel("");
      return;
    }

    function tick() {
      const diff = new Date(nextClaimAt).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("00:00:00");
        onFinished?.();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextClaimAt]);

  return label;
}

export default function RewardCard({ card, onClaim, claiming, onTimerFinished }) {
  const { day, status, isToday, isUltimate, badge, reward, nextClaimAt } = card;
  const countdown = useCountdown(nextClaimAt, onTimerFinished);

  const cardClass = [
    styles.card,
    isToday ? styles.cardToday : "",
    status === "CLAIMED" ? styles.cardClaimed : "",
    isUltimate ? styles.cardUltimate : "",
  ]
    .filter(Boolean)
    .join(" ");

  let badgeNode = null;
  if (isToday) badgeNode = <span className={`${styles.cardBadge} ${styles.badgeToday}`}>Today</span>;
  else if (status === "CLAIMED") badgeNode = <span className={`${styles.cardBadge} ${styles.badgeClaimed}`}>✓</span>;
  else if (badge) badgeNode = <span className={`${styles.cardBadge} ${badge === "VIP" ? styles.badgeVip : styles.badgeDefault}`}>{badge}</span>;

  return (
    <div className={cardClass}>
      {badgeNode}
      <div className={styles.cardDay}>Day {day}</div>
      <div className={styles.cardIcon}>{ASSET_ICON[reward.assetType]}</div>
      <div className={styles.cardTitle}>{reward.title}</div>
      <div className={`${styles.cardAmount} ${reward.currency === "INR" ? styles.cardAmountGift : styles.cardAmountVes}`}>
        {formatRewardAmount(reward)}
      </div>
      <div className={styles.cardCurrency}>{formatRewardSubtitle(reward)}</div>

      {status === "LOCKED" && countdown && (
        <div className={styles.countdown}>{countdown}</div>
      )}

      {status === "CLAIMED" && (
        <button className={`${styles.cardAction} ${styles.actionClaimed}`} disabled>
          <Check size={14} /> Claimed
        </button>
      )}

      {status === "AVAILABLE" && (
        <button
          className={`${styles.cardAction} ${styles.actionClaim}`}
          onClick={() => onClaim(day)}
          disabled={claiming}
        >
          {claiming ? "Claiming..." : (<>Claim Reward <ChevronRight size={14} /></>)}
        </button>
      )}

      {status === "LOCKED" && (
        <button className={`${styles.cardAction} ${styles.actionLocked}`} disabled>
          <Lock size={13} /> Locked
        </button>
      )}

      {status === "MISSED" && (
        <button className={`${styles.cardAction} ${styles.actionMissed}`} disabled>
          <X size={13} /> Missed
        </button>
      )}
    </div>
  );
}