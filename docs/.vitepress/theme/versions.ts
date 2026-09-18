import { computed, ref } from 'vue'
import { inBrowser, useData } from 'vitepress'

// One entry per built docs version, as written to /versions.json by
// scripts/docs/build-versioned-docs.mjs. Fetched at runtime so that a new release
// shows up in every already-built (and cached) version without a rebuild.
export interface DocsVersion {
  label: string // "2.2.0" | "dev"
  link: string // absolute path incl. the site base
  latest?: boolean
  legacy?: boolean // README-only release from before the docs site
  released?: string // YYYY-MM-DD
}

const versions = ref<DocsVersion[] | null>(null)
let requested = false

export function use_versions() {
  const { theme } = useData()
  if (inBrowser && !requested) {
    requested = true
    fetch(theme.value.docsVersionsUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((list) => {
        if (Array.isArray(list)) versions.value = list
      })
      .catch(() => {
        // no versions.json (npm run docs:dev, plain docs:build): switcher shows the current version only
      })
  }
  const current = computed<string>(() => theme.value.docsVersion ?? '')
  const latest = computed<DocsVersion | undefined>(() => versions.value?.find((version) => version.latest))
  // build-time knowledge until versions.json has been loaded
  const isLatest = computed(() => (latest.value ? latest.value.label === current.value : theme.value.docsVersion === theme.value.docsLatest))
  return { versions, current, latest, isLatest }
}

export const display_version = (label: string) => (label === 'dev' ? 'dev' : `v${label}`)
