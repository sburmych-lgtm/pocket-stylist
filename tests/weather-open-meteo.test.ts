import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchWeather,
  _resetWeatherCache,
} from "../server/services/styling/weather.js";

/**
 * Open-Meteo weather service tests.
 *
 * The new service replaces OpenWeatherMap — it takes raw lat/lon, requires
 * no API key, and must always return *something* (mock fallback) so the
 * Lookbook / Styling endpoints never throw.
 */

type FetchImpl = typeof fetch;

function withFetchMock(mock: FetchImpl, body: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  return body().finally(() => {
    globalThis.fetch = original;
  });
}

const validResponse = {
  latitude: 50.45,
  longitude: 30.52,
  timezone: "Europe/Kiev",
  current: {
    temperature_2m: 18.4,
    weather_code: 3,
    precipitation: 0.0,
  },
  daily: {
    time: [
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
    ],
    temperature_2m_max: [21.0, 22.5, 23.1, 19.8, 24.6, 25.3, 20.1],
    temperature_2m_min: [13.4, 14.2, 12.8, 11.6, 15.0, 16.4, 13.1],
    weather_code: [3, 0, 61, 3, 0, 80, 2],
    precipitation_sum: [0.0, 0.0, 4.5, 0.2, 0.0, 7.1, 0.5],
  },
};

test("fetchWeather returns parsed data when lat/lon are valid and HTTP succeeds", async () => {
  _resetWeatherCache();
  const mockFetch: FetchImpl = async () =>
    new Response(JSON.stringify(validResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await withFetchMock(mockFetch, async () => {
    const data = await fetchWeather({ lat: 50.45, lon: 30.52 });

    assert.equal(data.tempC, 18.4, "tempC matches current.temperature_2m");
    assert.equal(data.condition, "Clouds", "weather_code 3 maps to Clouds");
    assert.equal(data.location, "Europe/Kiev");
    assert.equal(data.daily.length, 7);
    assert.equal(data.daily[0].date, "2026-06-18");
    assert.equal(data.daily[0].tempMax, 21.0);
    assert.equal(data.daily[0].tempMin, 13.4);
    assert.equal(data.daily[2].condition, "Rain", "weather_code 61 maps to Rain");
    assert.equal(data.daily[5].condition, "Showers", "weather_code 80 maps to Showers");
    assert.equal(data.daily[2].precipMm, 4.5);

    // Legacy compatibility fields
    assert.equal(data.temp, data.tempC, "legacy .temp alias");
    assert.ok(typeof data.icon === "string" && data.icon.length > 0);
  });
});

test("fetchWeather falls back to mock when lat/lon are missing", async () => {
  _resetWeatherCache();
  let fetchCalled = false;
  const mockFetch: FetchImpl = async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  };

  await withFetchMock(mockFetch, async () => {
    const data = await fetchWeather({});
    assert.equal(fetchCalled, false, "no network call when lat/lon missing");
    assert.equal(data.location, "Mock City");
    assert.equal(data.daily.length, 7, "mock still produces a 7-day plan");
    assert.ok(typeof data.tempC === "number");
    assert.ok(typeof data.condition === "string");
  });
});

test("fetchWeather falls back to mock when the HTTP call fails", async () => {
  _resetWeatherCache();
  const mockFetch: FetchImpl = async () =>
    new Response("upstream blew up", { status: 502 });

  await withFetchMock(mockFetch, async () => {
    const data = await fetchWeather({ lat: 50.45, lon: 30.52 });
    // Mock fallback signature — location is "Mock City"
    assert.equal(data.location, "Mock City");
    assert.equal(data.daily.length, 7);
    assert.ok(typeof data.tempC === "number");
  });
});
