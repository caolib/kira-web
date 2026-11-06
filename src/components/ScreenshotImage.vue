<script setup>
defineProps({ shot: { type: Object, required: true } })
</script>

<template>
  <img
    :src="shot.src"
    :alt="shot.title"
    :width="shot.width"
    :height="shot.height"
    :data-screenshot-id="shot.id"
    :data-theme-light="shot.light?.src"
    :data-theme-dark="shot.dark?.src"
    :data-dim-dark="shot.dimInDark ? '' : undefined"
  />
</template>
