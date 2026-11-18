/** Register the market-gap-advisor skill. The skill delegates to the existing plugin_market and plugin_manager tools. */
import { readFile } from 'node:fs/promises'

export const name = 'market-gap-advisor'
export const inject = ['skills']

const DESCRIPTION = 'Find installable plugins in the plugin indexes the user configured when a request needs a capability DSH lacks, or when a task failed because a capability is missing, and ask before installing. Requires the plugin_market tool. Never for ordinary tasks, browsing, discussion, quoted wishes, or when a built-in feature or official plugin already covers the need. Installs are third-party code and change the whole profile.'

export async function apply(ctx) {
  const content = await readFile(new URL('./skills/market-gap.md', import.meta.url), 'utf8')
  ctx.skills.register({
    name: 'market-gap-advisor',
    description: DESCRIPTION,
    content,
    invocation: { modelInvocable: true, userInvocable: false },
    // This is a runtime skill contributed by a local plugin, not a skill bundled with DSH.
    source: 'runtime',
    provider: 'market-gap-advisor',
  })
}
