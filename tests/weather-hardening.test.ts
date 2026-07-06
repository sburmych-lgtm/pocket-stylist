import test from "node:test";
import assert from "node:assert/strict";
import {
  _resetWeatherCache,
  fetchWeather,
} from "../server/services/styling/weather.js";

test("an upstream response with empty daily arrays falls back to a usable forecast", async () => {
  _resetWeatherCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        latitude: 49.84,
        longitude: 24.03,
        timezone: "Europe/Kyiv",
        current: {
          temperature_2m: 8,
          weather_code: 3,
          precipitation: 0,
        },
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          weather_code: [],
          precipitation_sum: [],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    const weather = await fetchWeather({ lat: 49.84, lon: 24.03 });

    assert.ok(weather.daily.length > 0, "forecast must never be empty");
  } finally {
    globalThis.fetch = originalFetch;
    _resetWeatherCache();
  }
});
