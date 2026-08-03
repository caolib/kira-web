import { ref } from 'vue'

/**
 * Hero 展示方案：电影感设备展台（stage）
 */
const showcaseVariant = ref('stage')

export function useShowcaseVariant() {
  return { showcaseVariant }
}
