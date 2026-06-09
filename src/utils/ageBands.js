export function getAgeBand(age) {
  if (!age || age <= 0) return { bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0', label: '?' };
  
  if (age >= 18) {
    // Colore fisso per tutti gli adulti (es. un blu/grigio serio o un colore premium)
    return {
      bg: '#e0f2fe',
      border: '#7dd3fc',
      color: '#0369a1',
      label: '18+'
    };
  }

  const hue = Math.floor((age * 137.5) % 360);
  return {
    bg: `hsl(${hue}, 85%, 90%)`,
    border: `hsl(${hue}, 85%, 65%)`,
    color: `hsl(${hue}, 85%, 35%)`,
    label: `${age}y`
  };
}

export const AGE_BANDS = [10, 13, 16, 19, 22].map(age => getAgeBand(age));

