import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const DATA_URL = "data/us_major_city_annual_tas.csv";
const STATES_URL = "data/us-states.geojson";

const scenarios = [
  {
    id: "ssp126",
    label: "Low",
    fullLabel: "Low emissions",
    note: "SSP1-2.6",
    description: "rapid climate action",
  },
  {
    id: "ssp245",
    label: "Middle",
    fullLabel: "Middle emissions",
    note: "SSP2-4.5",
    description: "moderate action",
  },
  {
    id: "ssp585",
    label: "High",
    fullLabel: "High emissions",
    note: "SSP5-8.5",
    description: "fossil-fuel-heavy",
  },
];

const state = {
  scenario: "ssp585",
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

const svg = d3.select("#us-climate-map");
const formatDeg = (value) =>
  Number.isFinite(value) ? `${d3.format("+.1f")(value)} C` : "No data";
const formatNoSign = (value) =>
  Number.isFinite(value) ? `${d3.format(".1f")(value)} C` : "No data";
const severityColor = d3
  .scaleSequential([0, 10], d3.interpolateYlOrRd)
  .clamp(true);
const radiusScale = d3.scaleSqrt().domain([0, 10]).range([4, 34]).clamp(true);

let rows = [];
let states = null;
let cityMeta = [];
let valueIndex = new Map();

init();

async function init() {
  try {
    [rows, states] = await Promise.all([
      d3.csv(DATA_URL, d3.autoType),
      d3.json(STATES_URL),
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
    els.status.textContent = "Unable to load the U.S. climate subset.";
  }
}

function prepareData() {
  rows = rows
    .filter((d) => scenarios.some((scenario) => scenario.id === d.experiment_id))
    .sort((a, b) =>
      d3.ascending(a.city, b.city) ||
      d3.ascending(a.experiment_id, b.experiment_id) ||
      d3.ascending(a.year, b.year),
    );

  valueIndex = new Map(
    rows.map((d) => [`${d.city}|${d.experiment_id}|${d.year}`, d]),
  );

  cityMeta = Array.from(
    d3.rollup(
      rows,
      (values) => {
        const first = values[0];
        return {
          city: first.city,
          state: first.state,
          label: `${first.city}, ${first.state}`,
          lat: first.lat,
          lon: first.lon,
          baseline: first.baseline_temp_c,
        };
      },
      (d) => d.city,
    ).values(),
  ).sort((a, b) => d3.ascending(a.city, b.city));

  const excluded = new Set(["Alaska", "Hawaii", "Puerto Rico"]);
  states.features = states.features.filter((feature) => !excluded.has(feature.properties.name));
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
  const margin = { top: 66, right: 34, bottom: 78, left: 34 };
  const scenario = getScenario(state.scenario);

  svg.selectAll("*").remove();

  const projection = d3
    .geoAlbersUsa()
    .fitExtent(
      [
        [margin.left, margin.top + 30],
        [width - margin.right, height - margin.bottom - 18],
      ],
      states,
    );
  const path = d3.geoPath(projection);

  const cityValues = cityMeta
    .map((city) => ({
      ...city,
      climate: getValue(city.city, state.scenario, state.year),
      xy: projection([city.lon, city.lat]),
    }))
    .filter((d) => d.xy && d.climate);

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
    .text("Color and radius both increase with projected warming severity");

  svg
    .append("g")
    .selectAll("path")
    .data(states.features)
    .join("path")
    .attr("class", "state-outline")
    .attr("d", path);

  const bubbles = svg
    .append("g")
    .attr("class", "bubble-layer")
    .selectAll("circle")
    .data(cityValues, (d) => d.city)
    .join("circle")
    .attr("class", "city-bubble")
    .attr("cx", (d) => d.xy[0])
    .attr("cy", (d) => d.xy[1])
    .attr("r", (d) => radiusScale(Math.max(0, d.climate.temp_anomaly_c)))
    .attr("fill", (d) => severityColor(d.climate.temp_anomaly_c))
    .attr("stroke", (d) => severityColor(d.climate.temp_anomaly_c))
    .attr("tabindex", 0)
    .attr("role", "img")
    .attr(
      "aria-label",
      (d) =>
        `${d.label}, ${scenario.fullLabel}, ${formatDeg(
          d.climate.temp_anomaly_c,
        )} in ${state.year}`,
    )
    .on("pointermove", (event, d) => {
      showTooltip(event, d.label, [
        ["Year", state.year],
        ["Future", scenario.fullLabel],
        ["Scenario", scenario.note],
        ["Warming", formatDeg(d.climate.temp_anomaly_c)],
        ["Baseline", formatNoSign(d.baseline)],
      ]);
    })
    .on("pointerleave", hideTooltip);

  bubbles
    .clone(true)
    .lower()
    .attr("class", "city-halo")
    .attr("r", (d) => radiusScale(Math.max(0, d.climate.temp_anomaly_c)) * 1.55);

  const labeled = d3
    .sort(cityValues, (a, b) => d3.descending(a.climate.temp_anomaly_c, b.climate.temp_anomaly_c))
    .slice(0, 5);

  svg
    .append("g")
    .selectAll("text")
    .data(labeled, (d) => d.city)
    .join("text")
    .attr("class", "city-label")
    .attr("x", (d) => d.xy[0] + radiusScale(Math.max(0, d.climate.temp_anomaly_c)) + 4)
    .attr("y", (d) => d.xy[1] + 4)
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

  const sizeValues = [2, 5, 8];
  const sizeLegend = svg
    .append("g")
    .attr("class", "size-legend")
    .attr("transform", `translate(${x - 190},${y - 4})`);

  sizeLegend
    .append("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", -8)
    .text("Circle size");

  sizeLegend
    .selectAll("circle")
    .data(sizeValues)
    .join("circle")
    .attr("cx", (_, i) => i * 50 + 16)
    .attr("cy", 12)
    .attr("r", (d) => radiusScale(d) * 0.55)
    .attr("fill", "rgb(255 190 80 / 0.35)")
    .attr("stroke", "rgb(255 230 160 / 0.85)");

  sizeLegend
    .selectAll("text.value")
    .data(sizeValues)
    .join("text")
    .attr("class", "legend-title value")
    .attr("x", (_, i) => i * 50 + 16)
    .attr("y", 44)
    .attr("text-anchor", "middle")
    .text((d) => `${d} C`);
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
  }: average warming across ${values.length} major cities is ${formatDeg(
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
