<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { display_version, use_versions, type DocsVersion } from './versions'

const CHANGELOG = 'https://github.com/marketsquare/robotframework-dashboard/releases'

const { versions, current, latest } = use_versions()
const open = ref(false)
const root = ref<HTMLElement>()

type MinorGroup = [minor: string, items: DocsVersion[]]

// "1.8" -> [1.8.2, 1.8.1, 1.8.0]; the list is newest first already
function by_minor(list: DocsVersion[]): MinorGroup[] {
  const groups = new Map<string, DocsVersion[]>()
  for (const version of list) {
    const minor = version.label.split('.').slice(0, 2).join('.')
    if (!groups.has(minor)) groups.set(minor, [])
    groups.get(minor)!.push(version)
  }
  return [...groups.entries()]
}

const dev = computed(() => versions.value?.find((version) => version.label === 'dev'))
const releases = computed(() => by_minor((versions.value ?? []).filter((version) => !version.legacy && version.label !== 'dev')))
const legacy = computed(() => by_minor((versions.value ?? []).filter((version) => version.legacy)))

function on_document_click(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false
}
function on_keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', on_document_click)
  document.addEventListener('keydown', on_keydown)
})
onUnmounted(() => {
  document.removeEventListener('click', on_document_click)
  document.removeEventListener('keydown', on_keydown)
})
</script>

<template>
  <div ref="root" class="VersionSwitcher">
    <button type="button" class="button" :aria-expanded="open" aria-haspopup="true" aria-label="Switch documentation version" @click="open = !open">
      <span class="text">{{ display_version(current) }}</span>
      <span class="vpi-chevron-down icon" />
    </button>

    <!-- links point at sibling builds outside this VitePress app: target keeps them away from the router -->
    <div v-show="open" class="menu">
      <div class="pinned">
        <a v-if="dev" :href="dev.link" target="_self" class="pin" :class="{ current: dev.label === current }">
          dev <small>unreleased</small>
        </a>
        <a v-if="latest" :href="latest.link" target="_self" class="pin" :class="{ current: latest.label === current }">
          v{{ latest.label }} <small>latest</small>
        </a>
        <a :href="CHANGELOG" target="_blank" rel="noreferrer" class="pin">Changelog <span class="vpi-arrow-right link-icon" /></a>
      </div>

      <div v-if="releases.length" class="section">
        <div class="title">Releases</div>
        <div v-for="[minor, items] in releases" :key="minor" class="row">
          <span class="minor">{{ minor }}</span>
          <span class="chips">
            <a v-for="version in items" :key="version.label" :href="version.link" target="_self" class="chip" :class="{ current: version.label === current }" :title="version.released">
              {{ version.label }}
            </a>
          </span>
        </div>
      </div>

      <div v-if="legacy.length" class="section">
        <div class="title">Older releases <small>README only</small></div>
        <div v-for="[minor, items] in legacy" :key="minor" class="row">
          <span class="minor">{{ minor }}</span>
          <span class="chips">
            <a v-for="version in items" :key="version.label" :href="version.link" target="_self" class="chip" :class="{ current: version.label === current }" :title="version.released">
              {{ version.label }}
            </a>
          </span>
        </div>
      </div>

      <div v-if="!versions" class="section">
        <div class="title">Other versions are listed on the published site</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* trigger styled like VitePress' own VPFlyout nav buttons */
.VersionSwitcher {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--vp-nav-height);
}

.button {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: var(--vp-nav-height);
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.button:hover,
.button[aria-expanded='true'] {
  color: var(--vp-c-brand-1);
}

.icon {
  margin-left: 4px;
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.menu {
  position: absolute;
  top: calc(var(--vp-nav-height) - 8px);
  right: 0;
  z-index: 100;
  width: 380px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - var(--vp-nav-height) - var(--vp-layout-top-height, 0px) - 24px);
  overflow-y: auto;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  text-align: left;
}

@media (max-width: 767px) {
  /* the trigger sits at the very right edge: anchor the panel to the viewport instead */
  .menu {
    position: fixed;
    top: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) - 8px);
    right: 16px;
    left: 16px;
    width: auto;
    max-width: none;
  }
}

.pinned {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.pin {
  flex: 1 1 auto;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  transition: background-color 0.25s, color 0.25s;
}

.pin small,
.title small {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.pin:hover {
  background-color: var(--vp-c-default-soft);
  color: var(--vp-c-brand-1);
}

.link-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-left: 2px;
  vertical-align: -1px;
  fill: currentColor;
  transform: rotate(-45deg);
}

.section {
  padding-top: 10px;
}

.title {
  padding: 0 2px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 0;
}

.minor {
  flex: 0 0 34px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  text-align: right;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  padding: 1px 8px;
  border-radius: 6px;
  background-color: var(--vp-c-default-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 20px;
  color: var(--vp-c-text-1);
  transition: background-color 0.25s, color 0.25s;
}

.chip:hover {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.current {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
</style>
