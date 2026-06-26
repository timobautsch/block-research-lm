import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const buttons = [...appSource.matchAll(/<button[\s\S]*?<\/button>/g)].map((match) => match[0]);
const buttonsWithoutAction = buttons.filter(
  (button) => !/onClick=|type="submit"|disabled=|disabled\}/.test(button),
);
const bannedMarkers = [...appSource.matchAll(/dummy|simulated|not implemented|coming soon|TODO/gi)].map(
  (match) => match[0],
);

if (buttonsWithoutAction.length > 0) {
  console.error(`Found ${buttonsWithoutAction.length} button(s) without an action:`);
  buttonsWithoutAction.forEach((button) => {
    console.error(`- ${button.split("\n")[0].trim()}`);
  });
  process.exit(1);
}

if (bannedMarkers.length > 0) {
  console.error(`Found banned incomplete-work marker(s): ${bannedMarkers.join(", ")}`);
  process.exit(1);
}

console.log(`Button audit passed: ${buttons.length} buttons, 0 without action.`);
