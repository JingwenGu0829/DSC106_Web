import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const DATA_URL = "data/california_city_annual_tas.csv";
const CALIFORNIA_URL = "data/california.geojson";
const CITY_SHAPES_URL = "data/california_city_places.geojson";

const scenarios = [
  {
    id: "SSP1-2.6",
    label: "Low",
    fullLabel: "Low emissions",
    note: "SSP1-2.6",
    description: "rapid climate action",
  },
  {
    id: "SSP2-4.5",
    label: "Middle",
    fullLabel: "Middle emissions",
    note: "SSP2-4.5",
    description: "moderate action",
  },
  {
    id: "SSP5-8.5",
    label: "High",
    fullLabel: "High emissions",
    note: "SSP5-8.5",
    description: "fossil-fuel-heavy",
  },
];

const cityOrder = ["San Francisco", "Sacramento", "Los Angeles", "San Diego"];
const labelOffsets = new Map([
  ["San Francisco", [-56, 2]],
  ["Sacramento", [14, -10]],
  ["Los Angeles", [16, 12]],
  ["San Diego", [16, 18]],
]);

const state = {
  scenario: "SSP5-8.5",
  year: 2050,
};

const els = {
  status: document.querySelector("#data-status"),
  scenarioButtons: document.querySelector("#scenario-buttons"),
  yearSlider: document.querySelector("#year-slider"),
  yearOutput: document.querySelector("#year-output"),
  summary: document.querySelector("#map-summary"),
  tooltip: document.querySelector("#p3-tooltip"),
};

const svg = d3.select("#california-climate-map");
const formatDeg = (value) =>
  Number.isFinite(value) ? `${d3.format("+.1f")(value)} C` : "No data";
const formatNoSign = (value) =>
  Number.isFinite(value) ? `${d3.format(".1f")(value)} C` : "No data";
const severityColor = d3
  .scaleSequential([-0.25, 6.5], d3.interpolateYlOrRd)
  .clamp(true);

let rows = [];
let california = null;
let cityShapes = null;
let cityMeta = [];
let valueIndex = new Map();

init();

async function init() {
  try {
    [rows, california, cityShapes] = await Promise.all([
      d3.csv(DATA_URL, d3.autoType),
      d3.json(CALIFORNIA_URL),
      d3.json(CITY_SHAPES_URL),
    ]);
    prepareData();
    buildScenarioButtons();
    els.yearSlider.addEventListener("input", (event) => {
      state.year = Number(event.target.value);
      update();
    });
    update();
    els.status.textContent = `${rows.length.toLocaleString()} annual city-pathway records loaded.`;
  } catch (error) {
    console.error(error);
    els.status.textContent = "Unable to load the California climate subset.";
  }
}

function prepareData() {
  rows = rows
    .filter((d) => scenarios.some((scenario) => scenario.id === d.scenario))
    .sort((a, b) =>
      d3.ascending(a.city, b.city) ||
      d3.ascending(a.scenario, b.scenario) ||
      d3.ascending(a.year, b.year),
    );

  valueIndex = new Map(
    rows.map((d) => [`${d.city}|${d.scenario}|${d.year}`, d]),
  );

  cityMeta = Array.from(
    d3.rollup(
      rows,
      (values) => {
        const first = values[0];
        return {
          city: first.city,
          label: `${first.city}, ${first.state}`,
          lat: first.lat,
          lon: first.lon,
          baseline: first.baseline_temp_c,
        };
      },
      (d) => d.city,
    ).values(),
  ).sort((a, b) => cityOrder.indexOf(a.city) - cityOrder.indexOf(b.city));

  cityShapes.features = cityShapes.features
    .filter((feature) => cityOrder.includes(feature.properties.BASENAME))
    .map(rewindFeature)
    .sort(
      (a, b) =>
        cityOrder.indexOf(a.properties.BASENAME) -
        cityOrder.indexOf(b.properties.BASENAME),
    );
}

function rewindFeature(feature) {
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) => ring.slice().reverse()),
      },
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) =>
          polygon.map((ring) => ring.slice().reverse()),
        ),
      },
    };
  }
  return feature;
}

function buildScenarioButtons() {
  els.scenarioButtons.innerHTML = "";
  for (const scenario of scenarios) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-button";
    button.dataset.scenario = scenario.id;
    button.innerHTML = `
      <strong>${scenario.label}</strong>
      <span>${scenario.note}</span>
      <small>${scenario.description}</small>
    `;
    button.addEventListener("click", () => {
      state.scenario = scenario.id;
      update();
    });
    els.scenarioButtons.append(button);
  }
}

function update() {
  els.yearSlider.value = state.year;
  els.yearOutput.value = state.year;
  els.yearOutput.textContent = state.year;
  updateScenarioButtons();
  drawMap();
  updateSummary();
}

function updateScenarioButtons() {
  els.scenarioButtons.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.scenario === state.scenario));
  });
}

function drawMap() {
  const width = 860;
  const height = 760;
  const margin = { top: 64, right: 36, bottom: 76, left: 36 };
  const scenario = getScenario(state.scenario);

  svg.selectAll("*").remove();

  const projection = d3
    .geoMercator()
    .fitExtent(
      [
        [margin.left, margin.top + 34],
        [width - margin.right, height - margin.bottom - 14],
      ],
      cityShapes,
    );
  const path = d3.geoPath(projection);

  svg
    .append("rect")
    .attr("class", "map-bg")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("rx", 18);

  svg
    .append("text")
    .attr("class", "map-title")
    .attr("x", 42)
    .attr("y", 42)
    .text(`${scenario.fullLabel} in ${state.year}`);

  svg
    .append("text")
    .attr("class", "map-subtitle-svg")
    .attr("x", 42)
    .attr("y", 66)
    .text(`${scenario.note}: ${scenario.description}; zoomed to the four California city boundaries`);

  svg
    .append("path")
    .datum(california)
    .attr("class", "state-outline")
    .attr("d", path);

  const cityLayer = svg.append("g");
  const cityFeatures = cityShapes.features.map((feature) => {
    const city = feature.properties.BASENAME;
    return {
      ...feature,
      climate: getValue(city, state.scenario, state.year),
      meta: cityMeta.find((d) => d.city === city),
    };
  });

  cityLayer
    .selectAll("path")
    .data(cityFeatures, (d) => d.properties.BASENAME)
    .join("path")
    .attr("class", "city-shape")
    .attr("d", path)
    .attr("fill", (d) => severityColor(d.climate?.temp_anomaly_c))
    .attr("stroke-width", (d) => {
      const value = d.climate?.temp_anomaly_c ?? 0;
      return 2.2 + Math.max(0, value) * 0.35;
    })
    .attr("tabindex", 0)
    .attr("role", "img")
    .attr(
      "aria-label",
      (d) =>
        `${d.properties.BASENAME}, ${scenario.fullLabel}, ${formatDeg(
          d.climate?.temp_anomaly_c,
        )} in ${state.year}`,
    )
    .on("pointermove", (event, d) => {
      showTooltip(event, d.meta.label, [
        ["Year", state.year],
        ["Future", scenario.fullLabel],
        ["Scenario", scenario.note],
        ["Warming", formatDeg(d.climate?.temp_anomaly_c)],
        ["Baseline", formatNoSign(d.meta.baseline)],
      ]);
    })
    .on("pointerleave", hideTooltip);

  svg
    .append("g")
    .selectAll("text")
    .data(cityMeta)
    .join("text")
    .attr("class", "city-label")
    .attr("x", (d) => projection([d.lon, d.lat])[0] + labelOffsets.get(d.city)[0])
    .attr("y", (d) => projection([d.lon, d.lat])[1] + labelOffsets.get(d.city)[1])
    .attr("text-anchor", (d) => (d.city === "San Francisco" ? "end" : "start"))
    .text((d) => d.city);

  drawLegend(width, height);
}

function drawLegend(width, height) {
  const legendWidth = 330;
  const legendHeight = 14;
  const x = width - legendWidth - 42;
  const y = height - 52;
  const gradientId = "severity-gradient";
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const [minValue, maxValue] = severityColor.domain();
  d3.range(0, 1.01, 0.1).forEach((t) => {
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", severityColor(minValue + t * (maxValue - minValue)));
  });

  svg
    .append("text")
    .attr("class", "legend-title")
    .attr("x", x)
    .attr("y", y - 12)
    .text("Warming severity above 1995-2014");

  svg
    .append("rect")
    .attr("x", x)
    .attr("y", y)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("rx", 7)
    .attr("fill", `url(#${gradientId})`);

  const legendScale = d3.scaleLinear().domain(severityColor.domain()).range([x, x + legendWidth]);
  svg
    .append("g")
    .attr("class", "axis legend-axis")
    .attr("transform", `translate(0,${y + legendHeight})`)
    .call(d3.axisBottom(legendScale).ticks(6).tickFormat((d) => `${d} C`))
    .call((g) => g.select(".domain").remove());
}

function updateSummary() {
  const scenario = getScenario(state.scenario);
  const values = cityMeta
    .map((city) => ({
      city: city.city,
      value: getValue(city.city, state.scenario, state.year)?.temp_anomaly_c,
    }))
    .filter((d) => Number.isFinite(d.value));
  const hottest = d3.greatest(values, (d) => d.value);
  const mean = d3.mean(values, (d) => d.value);

  els.summary.textContent = `${scenario.fullLabel} (${scenario.note}) in ${
    state.year
  }: average warming across these city boundaries is ${formatDeg(
    mean,
  )}; ${hottest.city} is highest at ${formatDeg(hottest.value)}.`;
}

function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id);
}

function getValue(city, scenario, year) {
  return valueIndex.get(`${city}|${scenario}|${year}`);
}

function showTooltip(event, title, rowsToShow) {
  els.tooltip.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <dl>
      ${rowsToShow
        .map(
          ([label, value]) =>
            `<dt>${escapeHtml(String(label))}</dt><dd>${escapeHtml(String(value))}</dd>`,
        )
        .join("")}
    </dl>
  `;
  els.tooltip.style.left = `${event.clientX}px`;
  els.tooltip.style.top = `${event.clientY}px`;
  els.tooltip.style.opacity = "1";
}

function hideTooltip() {
  els.tooltip.style.opacity = "0";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
