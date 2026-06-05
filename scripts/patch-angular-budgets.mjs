import { readFileSync, writeFileSync } from 'node:fs';

const angularJsonPath = new URL('../angular.json', import.meta.url);
const config = JSON.parse(readFileSync(angularJsonPath, 'utf8'));

let changed = false;

for (const project of Object.values(config.projects ?? {})) {
  const production = project?.architect?.build?.configurations?.production;
  if (!production?.budgets) {
    continue;
  }

  const nextBudgets = production.budgets.filter((budget) => budget.type !== 'anyComponentStyle');
  if (nextBudgets.length === production.budgets.length) {
    continue;
  }

  production.budgets = nextBudgets;
  changed = true;
}

if (changed) {
  writeFileSync(angularJsonPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log('[patch-angular-budgets] Removido budget anyComponentStyle do angular.json');
}
