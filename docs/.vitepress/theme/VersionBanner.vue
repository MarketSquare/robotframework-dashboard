<script setup lang="ts">
import { watchEffect } from 'vue'
import { inBrowser, useData } from 'vitepress'
import { use_versions } from './versions'

const { theme } = useData()
const { current, latest, isLatest } = use_versions()

// The banner is fixed above the navbar; VitePress offsets its own fixed
// nav/sidebar by --vp-layout-top-height. config.mts sets it in <head> when the
// banner is known at build time; this class covers a build that *became* old
// later (a cached previous-latest build) once versions.json has been read.
watchEffect(() => {
  if (inBrowser) document.documentElement.classList.toggle('has-version-banner', !isLatest.value)
})
</script>

<template>
  <div v-if="!isLatest" class="version-banner">
    <span v-if="current === 'dev'">
      You are viewing the documentation of the <strong>unreleased development version</strong>.
    </span>
    <span v-else>
      You are viewing the documentation of <strong>v{{ current }}</strong>.
    </span>
    <a :href="theme.docsLatestLink" target="_self">
      Go to the latest release<template v-if="latest"> (v{{ latest.label }})</template> →
    </a>
  </div>
</template>

<style scoped>
/* fixed strip above the (also fixed) VitePress navbar; the height must match
   --vp-layout-top-height (see vars.css and the <head> style from config.mts) */
.version-banner {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: var(--vp-z-index-layout-top);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 12px;
  height: var(--vp-layout-top-height, 36px);
  padding: 0 24px;
  font-size: 14px;
  line-height: 18px;
  text-align: center;
  color: var(--vp-c-warning-1);
  /* warning-soft is translucent: paint it over the page background so scrolled content never shows through */
  background-color: var(--vp-c-bg);
  background-image: linear-gradient(var(--vp-c-warning-soft), var(--vp-c-warning-soft));
  border-bottom: 1px solid var(--vp-c-divider);
}

.version-banner a {
  font-weight: 600;
  text-decoration: underline;
  color: var(--vp-c-warning-1);
}
</style>
