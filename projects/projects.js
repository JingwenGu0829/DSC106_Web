import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects } from "../global.js";

const projects = await fetchJSON("../lib/projects.json");
const projectList = projects ?? [];
const projectsContainer = document.querySelector(".projects");
const projectsTitle = document.querySelector(".projects-title");
const searchInput = document.querySelector(".searchBar");
const resetYearButton = document.querySelector(".reset-year-filter");
const svg = d3.select("#projects-pie-plot");
const legend = d3.select(".legend");

const colors = d3.scaleOrdinal(d3.schemeTableau10);
colors.domain(getYearData(projectList).map((d) => d.label));

let query = "";
let selectedYear = null;

function getYearData(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => String(d.year),
  );

  return rolledData
    .map(([year, count]) => ({ label: year, value: count }))
    .sort((a, b) => d3.descending(Number(a.label), Number(b.label)));
}

function getSearchFilteredProjects() {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return projectList;
  }

  return projectList.filter((project) => {
    const values = Object.values(project).join("\n").toLowerCase();
    return values.includes(normalizedQuery);
  });
}

function getVisibleProjects(searchFilteredProjects) {
  if (!selectedYear) {
    return searchFilteredProjects;
  }

  return searchFilteredProjects.filter(
    (project) => String(project.year) === selectedYear,
  );
}

function updateProjectCount(visibleProjects) {
  if (!projectsTitle) {
    return;
  }

  const projectWord = visibleProjects.length === 1 ? "Project" : "Projects";

  if (query.trim() || selectedYear) {
    projectsTitle.textContent = `${visibleProjects.length} Matching ${projectWord}`;
  } else {
    projectsTitle.textContent = `${projectList.length} ${projectWord}`;
  }
}

function updateResetButton() {
  if (!resetYearButton) {
    return;
  }

  resetYearButton.disabled = !selectedYear;
  resetYearButton.textContent = selectedYear
    ? `Show all years`
    : "Showing all years";
}

function toggleSelectedYear(year) {
  selectedYear = selectedYear === year ? null : year;
  applyFilters();
}

function resetSelectedYear() {
  selectedYear = null;
  applyFilters();
}

function handleYearKeydown(event, year) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  toggleSelectedYear(year);
}

function renderPieChart(projectsGiven) {
  const data = getYearData(projectsGiven);

  svg.selectAll("*").remove();
  legend.selectAll("*").remove();

  if (data.length === 0) {
    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("class", "plot-empty")
      .text("No matches");

    legend
      .append("li")
      .attr("class", "legend-item empty-message")
      .text("No matching years");
    return;
  }

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcData = sliceGenerator(data);

  svg
    .selectAll("path")
    .data(arcData)
    .join("path")
    .attr("d", arcGenerator)
    .attr("fill", (d) => colors(d.data.label))
    .attr("style", (d) => `--color:${colors(d.data.label)}`)
    .attr("class", (d) => (d.data.label === selectedYear ? "selected" : null))
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr(
      "aria-label",
      (d) =>
        `${d.data.value} ${d.data.value === 1 ? "project" : "projects"} from ${
          d.data.label
        }`,
    )
    .attr("aria-pressed", (d) => d.data.label === selectedYear)
    .on("click", (event, d) => toggleSelectedYear(d.data.label))
    .on("keydown", (event, d) => handleYearKeydown(event, d.data.label));

  legend
    .selectAll("li")
    .data(data)
    .join("li")
    .attr(
      "class",
      (d) => `legend-item${d.label === selectedYear ? " selected" : ""}`,
    )
    .attr("style", (d) => `--color:${colors(d.label)}`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-pressed", (d) => d.label === selectedYear)
    .on("click", (event, d) => toggleSelectedYear(d.label))
    .on("keydown", (event, d) => handleYearKeydown(event, d.label))
    .html(
      (d) =>
        `<span class="swatch"></span><span>${d.label}</span><em>(${d.value})</em>`,
    );
}

function applyFilters() {
  const searchFilteredProjects = getSearchFilteredProjects();

  if (
    selectedYear &&
    !searchFilteredProjects.some((project) => String(project.year) === selectedYear)
  ) {
    selectedYear = null;
  }

  const visibleProjects = getVisibleProjects(searchFilteredProjects);

  renderProjects(visibleProjects, projectsContainer, "h2");
  renderPieChart(searchFilteredProjects);
  updateProjectCount(visibleProjects);
  updateResetButton();
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    query = event.target.value;
    applyFilters();
  });
}

if (resetYearButton) {
  resetYearButton.addEventListener("click", resetSelectedYear);
}

applyFilters();
