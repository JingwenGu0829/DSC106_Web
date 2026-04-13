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
  { url: "contact/", title: "Contact" },
  { url: "cv/", title: "CV" },
  { url: "https://github.com/JingwenGu0829", title: "GitHub" },
];

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
