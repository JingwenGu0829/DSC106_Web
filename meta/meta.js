import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

const repoUrl = "https://github.com/JingwenGu0829/DSC106_Web";
const width = 1000;
const height = 560;
const margin = { top: 20, right: 28, bottom: 54, left: 58 };
const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

let data = await loadData();
let commits = processCommits(data);
let filteredCommits = commits;
let commitProgress = 100;

const fullTimeDomain = d3.extent(commits, (d) => d.datetime);
const timeScale = d3.scaleTime().domain(fullTimeDomain).range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);

const xScale = d3.scaleTime().range([usableArea.left, usableArea.right]);
const yScale = d3
  .scaleLinear()
  .domain([0, 24])
  .range([usableArea.bottom, usableArea.top]);
const rScale = d3.scaleSqrt().range([3, 28]);
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

renderCommitInfo(data, commits);
renderScatterPlot();
renderStory(commits);
onTimeSliderChange();
setupScroller();

async function loadData() {
  return await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(rows) {
  return d3
    .groups(rows, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const ret = {
        id: commit,
        url: `${repoUrl}/commit/${commit}`,
        author: first.author,
        date: first.date,
        time: first.time,
        timezone: first.timezone,
        datetime: first.datetime,
        hourFrac: first.datetime.getHours() + first.datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, "lines", {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function renderCommitInfo(rows, allCommits) {
  const visibleRows = filteredCommits.flatMap((d) => d.lines);
  const fileGroups = d3.groups(visibleRows, (d) => d.file);
  const longestFile = d3.greatest(fileGroups, (d) => d[1].length);
  const averageLineLength = d3.mean(visibleRows, (d) => d.length) ?? 0;

  const stats = [
    ["Visible LOC", visibleRows.length.toLocaleString()],
    ["Visible commits", filteredCommits.length.toLocaleString()],
    ["Visible files", fileGroups.length.toLocaleString()],
    ["Current LOC", rows.length.toLocaleString()],
    ["All commits", allCommits.length.toLocaleString()],
    ["Largest file", longestFile ? longestFile[0] : "None"],
    ["Largest file LOC", longestFile ? longestFile[1].length.toLocaleString() : "0"],
    ["Avg line length", `${averageLineLength.toFixed(1)} chars`],
  ];

  d3.select("#stats")
    .selectAll("dl")
    .data([stats])
    .join("dl")
    .attr("class", "stats")
    .selectAll("div")
    .data((d) => d)
    .join(
      (enter) => {
        const row = enter.append("div");
        row.append("dt");
        row.append("dd");
        return row;
      },
    )
    .call((rows) => {
      rows.select("dt").text((d) => d[0]);
      rows.select("dd").text((d) => d[1]);
    });
}

function renderScatterPlot() {
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("id", "commit-chart")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Scatter plot of commits by date and time of day");

  svg
    .append("g")
    .attr("class", "grid-lines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${usableArea.bottom})`);

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  svg.append("g").attr("class", "dots");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", usableArea.left)
    .attr("y", height - 10)
    .text("Commit date");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -usableArea.bottom)
    .attr("y", 18)
    .text("Time of day");

  updateScatterPlot(filteredCommits);
}

function updateScatterPlot(visibleCommits) {
  const svg = d3.select("#commit-chart");
  const safeCommits = visibleCommits.length ? visibleCommits : commits.slice(0, 1);
  const xDomain =
    safeCommits.length > 1 ? d3.extent(safeCommits, (d) => d.datetime) : fullTimeDomain;
  const maxLines = d3.max(safeCommits, (d) => d.totalLines) || 1;

  xScale.domain(xDomain);
  rScale.domain([0, maxLines]);

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(6)
    .tickFormat(d3.timeFormat("%b %-d"));
  const yAxis = d3
    .axisLeft(yScale)
    .tickValues([0, 6, 12, 18, 24])
    .tickFormat((d) => formatHour(d));
  const grid = d3
    .axisLeft(yScale)
    .tickValues([0, 6, 12, 18, 24])
    .tickSize(-usableArea.width)
    .tickFormat("");

  svg.select("g.x-axis").transition().duration(220).call(xAxis);
  svg.select("g.y-axis").transition().duration(220).call(yAxis);
  svg.select("g.grid-lines").transition().duration(220).call(grid);

  const sortedCommits = d3.sort(visibleCommits, (d) => -d.totalLines);

  svg
    .select("g.dots")
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "commit-dot")
          .attr("cx", (d) => xScale(d.datetime))
          .attr("cy", (d) => yScale(d.hourFrac))
          .attr("r", 0)
          .call((circle) => circle.append("title")),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .style("--r", (d) => rScale(d.totalLines))
    .classed("selected", false)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).classed("selected", true);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", updateTooltipPosition)
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).classed("selected", false);
      updateTooltipVisibility(false);
    })
    .select("title")
    .text((d) => `${d.id}: ${d.totalLines} lines`);

  d3.select("#selection-count").text(
    `${visibleCommits.length} of ${commits.length} commits shown`,
  );
}

function renderTooltipContent(commit) {
  d3.select("#commit-link").attr("href", commit.url).text(commit.id);
  d3.select("#commit-date").text(
    commit.datetime.toLocaleString("en", { dateStyle: "long" }),
  );
  d3.select("#commit-time-detail").text(
    commit.datetime.toLocaleString("en", { timeStyle: "short" }),
  );
  d3.select("#commit-lines").text(`${commit.totalLines.toLocaleString()} lines`);
}

function updateTooltipVisibility(isVisible) {
  d3.select("#commit-tooltip").attr("hidden", isVisible ? null : true);
}

function updateTooltipPosition(event) {
  d3.select("#commit-tooltip")
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 14}px`);
}

function renderStory(allCommits) {
  d3.select("#scatter-story")
    .selectAll(".step")
    .data(allCommits, (d) => d.id)
    .join("div")
    .attr("class", "step")
    .html((d, i) => {
      const fileCount = d3.rollups(
        d.lines,
        (D) => D.length,
        (line) => line.file,
      ).length;
      const date = d.datetime.toLocaleString("en", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const commitLabel =
        i === 0 ? "the first commit in this story" : `commit ${d.id}`;

      return `
        <p class="eyebrow">Commit ${i + 1} of ${allCommits.length}</p>
        <h3>${date}</h3>
        <p>
          This step reveals <a href="${d.url}" target="_blank" rel="noreferrer noopener">${commitLabel}</a>,
          which accounts for ${d.totalLines.toLocaleString()} lines across
          ${fileCount.toLocaleString()} ${fileCount === 1 ? "file" : "files"}.
        </p>
      `;
    });
}

function setupScroller() {
  const scroller = scrollama();

  scroller
    .setup({
      container: "#scrolly-1",
      step: "#scrolly-1 .step",
      offset: 0.55,
    })
    .onStepEnter((response) => {
      const commit = response.element.__data__;
      d3.selectAll("#scrolly-1 .step").classed("is-active", false);
      d3.select(response.element).classed("is-active", true);
      setVisibleCommitTime(commit.datetime);
    });

  window.addEventListener("resize", () => scroller.resize());
}

function onTimeSliderChange() {
  const slider = d3.select("#commit-progress");

  commitProgress = Number(slider.property("value"));
  commitMaxTime = timeScale.invert(commitProgress);
  setVisibleCommitTime(commitMaxTime, false);
}

function setVisibleCommitTime(maxTime, syncSlider = true) {
  commitMaxTime = maxTime;
  commitProgress = timeScale(commitMaxTime);
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  if (syncSlider) {
    d3.select("#commit-progress").property("value", commitProgress);
  }

  d3.select("#commit-time").text(
    commitMaxTime.toLocaleString("en", {
      dateStyle: "long",
      timeStyle: "short",
    }),
  );

  renderCommitInfo(data, commits);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
}

function updateFileDisplay(visibleCommits) {
  const lines = visibleCommits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => d3.descending(a.lines.length, b.lines.length));

  const filesContainer = d3
    .select("#files")
    .selectAll("div.file-row")
    .data(files, (d) => d.name)
    .join((enter) => {
      const fileRow = enter.append("div").attr("class", "file-row");
      const dt = fileRow.append("dt");
      dt.append("code");
      dt.append("small");
      fileRow.append("dd");
      return fileRow;
    });

  filesContainer.select("dt > code").text((d) => d.name);
  filesContainer
    .select("dt > small")
    .text((d) => `${d.lines.length.toLocaleString()} lines`);

  filesContainer
    .select("dd")
    .selectAll("div.loc")
    .data((d) => d.lines, (line) => `${line.file}-${line.line}`)
    .join("div")
    .attr("class", "loc")
    .attr("title", (d) => `${d.file}:${d.line}`)
    .style("--color", (d) => colorScale(d.type || "other"));

  d3.select("#file-count").text(
    `${files.length.toLocaleString()} files, ${lines.length.toLocaleString()} visible lines`,
  );
}

d3.select("#commit-progress").on("input", onTimeSliderChange);

function formatHour(hour) {
  if (hour === 0 || hour === 24) {
    return "12 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}
