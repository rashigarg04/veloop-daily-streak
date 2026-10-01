import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getStreak, getStreakStatusOnly, claimStreak } from "../../services/streakApi";
import StreakLoader from "./StreakLoader";
import StreakSkeleton from "./StreakSkeleton";
import StreakHeader from "./StreakHeader";
import HeroBanner from "./HeroBanner";
import StreakStats from "./StreakStats";
import UltimateReward from "./UltimateReward";
import RewardCard from "./RewardCard";
import CpaDemo from "./CpaDemo";
import Toast from "./Toast";
import { friendlyClaimError } from "./claimErrors";
import styles from "./DailyStreak.module.css";

const MIN_CPA_DURATION_MS = 1800;

export default function DailyStreakPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loader");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [claimingDay, setClaimingDay] = useState(null);
  const [showCpaDemo, setShowCpaDemo] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((type, message) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadFull = useCallback(() => getStreak().then(setData), []);

  useEffect(() => {
    const loaderTimer = setTimeout(() => setPhase("skeleton"), 900);

    loadFull()
      .then(() => setTimeout(() => setPhase("ready"), 500))
      .catch((err) => setError(err.message));

    return () => clearTimeout(loaderTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTimerFinished() {
    // Timer hitting 0 visually never grants anything by itself (PDF #48).
    // We just ask the backend for the real, authoritative state.
    getStreakStatusOnly()
      .then(setData)
      .catch(() => {});
  }

  async function handleClaim(day) {
    setClaimingDay(day);
    setShowCpaDemo(true);
    const startedAt = Date.now();

    try {
      const result = await claimStreak({ day });

      // Keep the CPA demo visible for a minimum time so it doesn't flash,
      // even if the backend responds instantly. The backend's response is
      // already final by this point — this delay is purely cosmetic.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_CPA_DURATION_MS) {
        await new Promise((r) => setTimeout(r, MIN_CPA_DURATION_MS - elapsed));
      }

      await loadFull();

      const amountLabel =
        result.reward.currency === "INR" ? `₹${result.reward.amount} gift card` : `+${result.reward.amount} VEs`;
      pushToast("success", `Day ${result.claim.day} claimed! You earned ${amountLabel}.`);
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_CPA_DURATION_MS) {
        await new Promise((r) => setTimeout(r, MIN_CPA_DURATION_MS - elapsed));
      }

      pushToast("error", friendlyClaimError(err));

      // A reset or an already-claimed response means our local view is stale
      // regardless of what we optimistically expected, so always re-sync.
      await loadFull().catch(() => {});
    } finally {
      setShowCpaDemo(false);
      setClaimingDay(null);
    }
  }

  if (error) {
    return (
      <div style={{ color: "#fff", padding: "2rem", textAlign: "center" }}>
        <p>{error}</p>
        <button className="btn btn-outline-light btn-sm mt-2" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (phase === "loader") return <StreakLoader />;
  if (phase === "skeleton" || !data) return <StreakSkeleton />;

  return (
    <div className={styles.page}>
      {showCpaDemo && <CpaDemo />}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.container}>
        <StreakHeader
          currentStreak={data.streak.currentStreak}
          wallet={data.wallet}
          onBack={() => navigate(-1)}
        />
        <HeroBanner />
        <StreakStats streak={data.streak} />
        <UltimateReward ultimateReward={data.streak.ultimateReward} />
        <p className={styles.comeBack}>✦ Come back tomorrow for more rewards! ✦</p>

        <div className={styles.cardsGrid}>
          {data.rewards.map((card) => (
            <RewardCard
              key={card.day}
              card={card}
              onClaim={handleClaim}
              claiming={claimingDay === card.day}
              onTimerFinished={handleTimerFinished}
            />
          ))}
        </div>
      </div>
    </div>
  );
}