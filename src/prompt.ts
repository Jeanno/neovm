import * as readline from "readline/promises";

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function closePrompt(): void {
  rl?.close();
  rl = null;
}

export async function ask(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await getRL().question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await getRL().question(`${question} ${hint}: `);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === "") return defaultYes;
  return trimmed === "y" || trimmed === "yes";
}

export async function select(question: string, items: string[], defaultIndex = 0): Promise<number> {
  console.log(question);
  for (let i = 0; i < items.length; i++) {
    const marker = i === defaultIndex ? ">" : " ";
    console.log(`  ${marker} ${i + 1}. ${items[i]}`);
  }
  const answer = await getRL().question(`Choose [${defaultIndex + 1}]: `);
  const trimmed = answer.trim();
  if (trimmed === "") return defaultIndex;
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1 || num > items.length) {
    console.log("Invalid choice, using default.");
    return defaultIndex;
  }
  return num - 1;
}
