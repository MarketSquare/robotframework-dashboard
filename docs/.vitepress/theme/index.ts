import DefaultTheme from 'vitepress/theme'
import { inBrowser, type Theme } from 'vitepress'
import './vars.css'

// mermaid needs a real DOM, so it's only ever imported/run client-side
async function renderMermaidDiagrams() {
  const blocks = document.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])')
  if (!blocks.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
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
  enhanceApp({ router }) {
    if (inBrowser) {
      router.onAfterRouteChange = () => {
        // wait for the new page's DOM to be patched in before scanning for blocks
        requestAnimationFrame(() => renderMermaidDiagrams())
      }
    }
  }
} satisfies Theme