function getFontColor() {
  const bodyElement = document.body;
  const styles = window.getComputedStyle(bodyElement);
  return styles.color;
}

export function styleIcon() {
  const icon = document.getElementById("github-corner");
  const svg = icon.querySelector("svg");

  const textColor = getFontColor();
  svg.style.fill = textColor;

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  svg.style.color = isDark ? "#151513" : "#fff";
}
