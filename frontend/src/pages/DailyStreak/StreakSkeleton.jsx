import styles from "./DailyStreak.module.css";

export default function StreakSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.container} style={{ paddingTop: "1.5rem" }}>
        <div className={`${styles.skeleton} ${styles.skeletonHeader}`} />
        <div className={`${styles.skeleton} ${styles.skeletonHero}`} />
        <div className={styles.skeletonStatsRow}>
          <div className={`${styles.skeleton} ${styles.skeletonStat}`} />
          <div className={`${styles.skeleton} ${styles.skeletonStat}`} />
          <div className={`${styles.skeleton} ${styles.skeletonStat}`} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonUltimate}`} />
        <div className={styles.skeletonCardsGrid}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
          ))}
        </div>
      </div>
    </div>
  );
}