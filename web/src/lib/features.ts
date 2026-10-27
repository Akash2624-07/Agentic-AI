const WEATHER_FEATURES = ['temp', 'atemp', 'hum', 'windspeed', 'weathersit'];
const CALENDAR_FEATURES = ['season', 'mnth', 'hr', 'holiday', 'weekday', 'workingday'];

export function featureColor(feature: string) {
  let index = WEATHER_FEATURES.indexOf(feature);
  if (index < 0) index = CALENDAR_FEATURES.indexOf(feature);
  if (index < 0) index = 7;
  return `var(--s${index + 1})`;
}

const FEATURE_LABELS: Record<string, string> = {
  temp: 'temp',
  atemp: 'atemp (feels-like)',
  hum: 'hum (humidity)',
  windspeed: 'windspeed',
  weathersit: 'weathersit',
  season: 'season',
  mnth: 'month',
  hr: 'hour',
  holiday: 'holiday',
  weekday: 'weekday',
  workingday: 'workingday',
};

export const featureLabel = (feature: string) => FEATURE_LABELS[feature] ?? feature;
