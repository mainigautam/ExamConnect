"use client";

import styles from "./ui.module.css";

export function evaluatePasswordChecks(password: string) {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "Special character (recommended)", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const requiredMet = checks.slice(0, 4).every((c) => c.met);
  const score = checks.filter((c) => c.met).length;

  let strengthLabel = "Weak";
  let color = "#dc2626";
  if (score >= 5 && password.length >= 10) {
    strengthLabel = "Strong";
    color = "#059669";
  } else if (score >= 4) {
    strengthLabel = "Good";
    color = "#2563eb";
  } else if (score >= 2) {
    strengthLabel = "Fair";
    color = "#d97706";
  }

  return {
    checks,
    requiredMet,
    score,
    percentage: Math.round((score / checks.length) * 100),
    strengthLabel,
    color,
  };
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const evalResult = evaluatePasswordChecks(password);

  return (
    <div className={styles.strengthWrap}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>Password Strength</span>
        <span style={{ color: evalResult.color }}>{evalResult.strengthLabel}</span>
      </div>
      <div className={styles.strengthBarTrack}>
        <div
          className={styles.strengthBarFill}
          style={{
            width: `${evalResult.percentage}%`,
            background: evalResult.color,
          }}
        />
      </div>
      <ul className={styles.strengthChecks}>
        {evalResult.checks.map((check) => (
          <li
            key={check.label}
            className={check.met ? styles.strengthMet : styles.strengthPending}
          >
            {check.met ? "✓ " : "• "}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
