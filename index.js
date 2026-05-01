import { fetchGitHubData, fetchJSON, renderProjects } from "./global.js";

const [projects, githubData] = await Promise.all([
  fetchJSON("./lib/projects.json"),
  fetchGitHubData("JingwenGu0829"),
]);

const latestProjects = (projects ?? []).slice(0, 3);
const projectsContainer = document.querySelector(".projects");
const profileStats = document.querySelector("#profile-stats");

renderProjects(latestProjects, projectsContainer, "h3");

if (profileStats && githubData) {
  profileStats.innerHTML = `
    <dl>
      <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers</dt><dd>${githubData.followers}</dd>
      <dt>Following</dt><dd>${githubData.following}</dd>
    </dl>
  `;
} else if (profileStats) {
  profileStats.textContent = "GitHub profile stats are unavailable right now.";
}
