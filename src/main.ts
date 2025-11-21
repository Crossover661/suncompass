// src/main.ts
import { subsolarPoint } from "./core/suncalc";

function updateSubsolarPoint() {
  const [lat, lon] = subsolarPoint(); // uses "now" internally

  const ssp = document.getElementById("position");
  if (!ssp) {
    console.warn("Element with id='position' not found");
    return;
  }

  ssp.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function startSubsolarUpdates() {
  // Align to the next integer second
  const now = new Date();
  const delay = 1000 - now.getMilliseconds();

  setTimeout(() => {
    updateSubsolarPoint();
    // Then update every 1000 ms
    setInterval(updateSubsolarPoint, 1000);
  }, delay);
}

window.addEventListener("DOMContentLoaded", () => {
  startSubsolarUpdates();
});