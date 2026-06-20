// footprint.js – Carbon emission calculations
// Emission factors are based on typical values (kg CO₂ per unit)
// Source: EPA/DEFRA public datasets

const EMISSION_FACTORS = {
  // Transport: average passenger car emissions per km
  transport: 0.192, // kg CO2 per km

  // Home energy: average electricity emission factor (global avg)
  energy: 0.475, // kg CO2 per kWh

  // Diet factors (average daily footprint per diet type)
  diet: {
    vegetarian: 2.5, // kg CO2 per day
    average: 3.8,
    meatlover: 5.0,
  },
};

/**
 * Calculate the carbon footprint for a single day based on user inputs.
 * @param {Object} activity - { transport: number, energy: number, diet: string }
 * @returns {number} Total CO₂ in kilograms.
 */
function calculateFootprint(activity) {
  const { transport = 0, energy = 0, diet = "average" } = activity;

  // Validate inputs – coercing to numbers and guarding against NaN
  const transportKm = Number(transport) || 0;
  const energyKwh = Number(energy) || 0;
  const dietType = diet in EMISSION_FACTORS.diet ? diet : "average";

  const transportEmissions = transportKm * EMISSION_FACTORS.transport;
  const energyEmissions = energyKwh * EMISSION_FACTORS.energy;
  const dietEmissions = EMISSION_FACTORS.diet[dietType];

  const total = transportEmissions + energyEmissions + dietEmissions;
  return Number(total.toFixed(2)); // round to 2 decimals
}

/**
 * Generate personalized tips based on activity data.
 * Returns an array of tip strings.
 */
function generateTips(activity) {
  const tips = [];
  if (activity.transport > 10) {
    tips.push("Consider car‑pooling or using public transport for trips over 10 km.");
  }
  if (activity.energy > 12) {
    tips.push("Turn off unnecessary lights and appliances to reduce electricity use.");
  }
  if (activity.diet === "meatlover") {
    tips.push("Replace one meat‑heavy meal a week with a plant‑based alternative.");
  }
  if (tips.length === 0) {
    tips.push("Great job! Your activities are already low‑impact.");
  }
  return tips;
}

export { calculateFootprint, generateTips, EMISSION_FACTORS };
