console.log("IT'S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const isLocal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";
const BASE_PATH = isLocal ? "/" : "/DSC106_Web/";

const pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "proj2/project2_report.html", title: "Proj2" },
  { url: "contact/", title: "Contact" },
  { url: "cv/", title: "CV" },
  { url: "https://github.com/JingwenGu0829", title: "GitHub" },
];

function resolveSitePath(path) {
  if (!path) {
    return "";
  }

  if (/^(https?:|data:|mailto:)/.test(path) || path.startsWith("/")) {
    return path;
  }

  return BASE_PATH + path.replace(/^\.\//, "");
}

function normalizePath(pathname) {
  const normalized = pathname.replace(/index\.html$/, "").replace(/\/$/, "");
  return normalized || "/";
}

function buildNavigation() {
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Primary");

  for (const page of pages) {
    let url = page.url;

    if (!url.startsWith("http")) {
      url = BASE_PATH + url;
    }

    const link = document.createElement("a");
    link.href = url;
    link.textContent = page.title;

    const isCurrentPage =
      link.host === location.host &&
      normalizePath(link.pathname) === normalizePath(location.pathname);

    link.classList.toggle("current", isCurrentPage);

    if (link.host !== location.host) {
      link.target = "_blank";
      link.rel = "noreferrer noopener";
    }

    nav.append(link);
  }

  document.body.prepend(nav);
}

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
    return null;
  }
}

export function renderProjects(projects, containerElement, headingLevel = "h2") {
  if (!containerElement) {
    return;
  }

  containerElement.innerHTML = "";

  const projectList = Array.isArray(projects) ? projects : [];
  const validHeading = /^h[1-6]$/i.test(headingLevel) ? headingLevel : "h2";

  if (projectList.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No projects to display yet.";
    containerElement.append(message);
    return;
  }

  for (const project of projectList) {
    const article = document.createElement("article");
    const heading = document.createElement(validHeading);
    const image = document.createElement("img");
    const details = document.createElement("div");
    const year = document.createElement("p");
    const description = document.createElement("p");

    heading.textContent = project.title || "Untitled project";

    image.src = resolveSitePath(project.image || "images/gadget-card.svg");
    image.alt = project.title ? `${project.title} project image` : "";

    year.className = "project-year";
    year.textContent = project.year || "Year pending";

    description.textContent =
      project.description || "Project description coming soon.";
    details.className = "project-details";
    details.append(description, year);

    article.append(heading, image, details);
    containerElement.append(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty("color-scheme", colorScheme);
}

function buildThemeSwitcher() {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `
      <label class="color-scheme">
        Theme:
        <select>
          <option value="light dark">Automatic</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    `,
  );

  const select = document.querySelector(".color-scheme select");

  select.addEventListener("input", (event) => {
    const colorScheme = event.target.value;
    setColorScheme(colorScheme);
    localStorage.colorScheme = colorScheme;
  });

  if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
    select.value = localStorage.colorScheme;
  } else {
    setColorScheme(select.value);
  }
}

buildNavigation();
buildThemeSwitcher();
