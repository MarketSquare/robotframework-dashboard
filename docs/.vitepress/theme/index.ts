import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { inBrowser, type Theme } from 'vitepress'
import VersionBanner from './VersionBanner.vue'
import VersionSwitcher from './VersionSwitcher.vue'
import './vars.css'

// mermaid needs a real DOM, so it's only ever imported/run client-side
async function renderMermaidDiagrams() {
  const blocks = document.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])')
  if (!blocks.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    // mermaid 12 defaults to a new layout engine and look that wraps flowchart labels into
    // narrow, clipped nodes; the classic dagre layout sizes nodes to their labels
    layout: 'dagre',
    look: 'classic',
    flowchart: { htmlLabels: true, wrappingWidth: 300 }
  })
  for (const block of blocks) {
    block.setAttribute('data-processed', 'true')
    const graphDefinition = block.textContent || ''
    const id = `mermaid-${Math.random().toString(36).slice(2)}`
    try {
      const { svg } = await mermaid.render(id, graphDefinition)
      block.innerHTML = svg
    } catch (error) {
      block.innerHTML = `<pre>Failed to render diagram: ${error}</pre>`
    }
  }
}

export default {
  ...DefaultTheme,
  // banner above the navbar on dev / old-version builds, version switcher in the
  // navbar; both read /versions.json at runtime (theme/versions.ts)
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => h(VersionBanner),
      'nav-bar-content-after': () => h(VersionSwitcher),
    }),
  enhanceApp({ router }) {
    if (inBrowser) {
      router.onAfterRouteChange = () => {
        // wait for the new page's DOM to be patched in before scanning for blocks
        requestAnimationFrame(() => renderMermaidDiagrams())
      }
    }
  }
} satisfies Theme